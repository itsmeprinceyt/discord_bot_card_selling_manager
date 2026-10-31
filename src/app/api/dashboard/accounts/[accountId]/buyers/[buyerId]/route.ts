import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../../lib/Database/main.db";
import { generateULID } from "../../../../../../../utils/generateULID.util";
import { invalidateBulkOrderMutationCaches } from "../../../../../../../services/RedisKey.service";

interface BuyerRow extends RowDataPacket {
  id: string;
  discord_id: string;
}

interface OrderRow extends RowDataPacket {
  id: string;
  card_id: string;
  card_code: string;
  queue_position: number;
  status: string;
}

/**
 * PATCH /api/dashboard/accounts/[accountId]/buyers/[buyerId]
 *
 * Body: { discord_id: string }
 *
 * Transfers all WAITING (non-deleted) orders held by the source buyer
 * (`buyerId`) to the buyer identified by `discord_id`. Creates the target
 * buyer if it doesn't yet exist.
 *
 * Rules implemented:
 *  1. If target already holds a WAITING order for the same card, the
 *     source's order for that card is DELETED — the target keeps its slot
 *     (this is required by `uq_order_buyer_card`). Because queue_position
 *     of the surviving row is untouched, if that surviving row was the only
 *     remaining order for the card it becomes #1 (active) automatically.
 *  2. Otherwise, the source's order is reassigned to the target, keeping
 *     queue_position (a waitlisted order stays waitlisted under the target;
 *     an active order stays active).
 *  3. If the source buyer has zero rows left in `orders` (including
 *     soft-deleted ones), the source buyer row is deleted.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ accountId: string; buyerId: string }> },
) {
  try {
    const { accountId, buyerId } = await params;
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => null);
    const newDiscordIdRaw = body?.discord_id;
    const newDiscordId =
      typeof newDiscordIdRaw === "string" ? newDiscordIdRaw.trim() : "";

    if (!newDiscordId) {
      return NextResponse.json(
        { ok: false, error: "New Discord ID is required" },
        { status: 400 },
      );
    }
    if (!/^\d+$/.test(newDiscordId)) {
      return NextResponse.json(
        { ok: false, error: "Discord ID must be numeric" },
        { status: 400 },
      );
    }

    const pool = await getPool();

    // Verify account ownership
    const [accounts] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM accounts WHERE id = ? AND user_id = ? LIMIT 1",
      [accountId, userId],
    );
    if (accounts.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Account not found" },
        { status: 404 },
      );
    }

    // Load source buyer (scoped to this account)
    const [sourceRows] = await pool.execute<BuyerRow[]>(
      "SELECT id, discord_id FROM buyers WHERE id = ? AND account_id = ? LIMIT 1",
      [buyerId, accountId],
    );
    if (sourceRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Buyer not found" },
        { status: 404 },
      );
    }
    const sourceBuyer = sourceRows[0];

    if (sourceBuyer.discord_id === newDiscordId) {
      return NextResponse.json(
        { ok: false, error: "New Discord ID is identical to the current one" },
        { status: 400 },
      );
    }

    const conn = await pool.getConnection();
    let targetBuyerId: string;
    let targetCreated = false;
    let reassigned = 0;
    let dropped = 0;

    // Track every card we touched so we can bust their card_single caches.
    const touchedCardCodes = new Set<string>();

    try {
      await conn.beginTransaction();

      // ── Find or create the target buyer ──────────────────────────────
      // uq_buyer_discord_account guarantees at most one match.
      const [targetRows] = await conn.execute<BuyerRow[]>(
        "SELECT id, discord_id FROM buyers WHERE discord_id = ? AND account_id = ? LIMIT 1",
        [newDiscordId, accountId],
      );

      if (targetRows.length > 0) {
        targetBuyerId = targetRows[0].id;
      } else {
        targetBuyerId = generateULID({
          prefix: "byr",
          separator: "_",
          maxLength: 40,
        });
        await conn.execute(
          "INSERT INTO buyers (id, account_id, discord_id) VALUES (?, ?, ?)",
          [targetBuyerId, accountId, newDiscordId],
        );
        targetCreated = true;
      }

      // ── Load source WAITING (non-deleted) orders + card codes ────────
      // Soft-deleted orders are intentionally NOT transferred — they stay
      // attached to the source buyer as historical records.
      const [sourceOrders] = await conn.execute<OrderRow[]>(
        `SELECT o.id, o.card_id, c.card_code, o.queue_position, o.status
         FROM orders o
         JOIN cards  c ON c.id = o.card_id
         WHERE o.buyer_id = ?
           AND o.account_id = ?
           AND o.status = 'WAITING'
           AND o.deleted = FALSE
         FOR UPDATE`,
        [sourceBuyer.id, accountId],
      );

      for (const order of sourceOrders) {
        touchedCardCodes.add(order.card_code);

        // uq_order_buyer_card means at most one conflicting row.
        const [conflicts] = await conn.execute<RowDataPacket[]>(
          `SELECT id, card_id, queue_position, status
           FROM orders
           WHERE buyer_id = ?
             AND card_id = ?
             AND account_id = ?
             AND status = 'WAITING'
             AND deleted = FALSE
           LIMIT 1
           FOR UPDATE`,
          [targetBuyerId, order.card_id, accountId],
        );

        if (conflicts.length > 0) {
          // Target is already queued for this card — deleting the source
          // row is required to respect uq_order_buyer_card AND matches the
          // "target wins the slot" rule. If the surviving target row was
          // the only remaining entry for this card, it becomes #1 (active)
          // with no extra work.
          await conn.execute(
            "DELETE FROM orders WHERE id = ? AND account_id = ?",
            [order.id, accountId],
          );
          dropped++;
        } else {
          // Safe to reassign. queue_position is preserved so waitlisted
          // (queue_position > 1) orders remain waitlisted under the target,
          // and active (queue_position = 1) orders remain active.
          await conn.execute(
            "UPDATE orders SET buyer_id = ? WHERE id = ? AND account_id = ?",
            [targetBuyerId, order.id, accountId],
          );
          reassigned++;
        }
      }

      // ── Delete source buyer if it has zero rows in orders left ───────
      // Counting ALL statuses (including soft-deleted) so we don't wipe
      // historical records by cascade-deleting the buyer.
      const [remaining] = await conn.execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM orders WHERE buyer_id = ? AND account_id = ?",
        [sourceBuyer.id, accountId],
      );
      const remainingCount = Number(
        (remaining[0] as { total: number | string }).total,
      );

      if (remainingCount === 0) {
        await conn.execute(
          "DELETE FROM buyers WHERE id = ? AND account_id = ?",
          [sourceBuyer.id, accountId],
        );
      }

      // ── Audit log ────────────────────────────────────────────────────
      // action='UPDATE', entity_type='BUYER' are both valid ENUM values.
      await conn.execute(
        `INSERT INTO audit_logs
           (id, user_id, account_id, action, entity_type, description)
         VALUES (?, ?, ?, 'UPDATE', 'BUYER', ?)`,
        [
          generateULID({ prefix: "log", separator: "_", maxLength: 40 }),
          userId,
          accountId,
          `Transferred buyer ${sourceBuyer.discord_id} → ${newDiscordId}: ` +
            `${reassigned} reassigned, ${dropped} dropped (target already queued)`,
        ],
      );

      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    // ── Cache invalidation ─────────────────────────────────────────────
    // Busts: accountOverview + buyer_single for both discord IDs +
    // card_single for every card code we touched.
    try {
      await invalidateBulkOrderMutationCaches(
        accountId,
        [sourceBuyer.discord_id, newDiscordId],
        touchedCardCodes,
      );
    } catch (cacheErr) {
      console.error("buyer transfer cache invalidation failed:", cacheErr);
    }

    return NextResponse.json({
      ok: true,
      targetBuyerId,
      targetCreated,
      reassigned,
      dropped,
    });
  } catch (err) {
    console.error("PATCH buyer transfer failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to transfer buyer" },
      { status: 500 },
    );
  }
}
