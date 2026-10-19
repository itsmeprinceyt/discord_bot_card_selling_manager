import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../../lib/Database/main.db";
import { generateULID } from "../../../../../../../utils/generateULID.util";
import { invalidateBulkOrderMutationCaches } from "../../../../../../../services/RedisKey.service";

/**
 * Marks a card as TRADED and completes the first buyer in its queue.
 *
 * - Completes the FIRST WAITING order (lowest queue_position).
 * - Sets deleted = TRUE on completed order if delete_from_discord.
 * - Writes traded_for derived server-side from card row.
 * - Cancels every OTHER waiting order for the same card.
 * - Busts cache for every affected buyer + the card + overview.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  try {
    const { accountId } = await params;
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { card_id, completed_cards, delete_from_discord } = body ?? {};

    if (!card_id) {
      return NextResponse.json(
        { ok: false, error: "card_id is required" },
        { status: 400 },
      );
    }

    const pool = await getPool();

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

    let cardCode = "";
    const affectedDiscordIds = new Set<string>();

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Load card
      const [cards] = await conn.execute<RowDataPacket[]>(
        `SELECT card_code, price_tier, currency_type, status
         FROM cards
         WHERE id = ? AND account_id = ?
         LIMIT 1`,
        [card_id, accountId],
      );
      if (cards.length === 0) {
        await conn.rollback();
        return NextResponse.json(
          { ok: false, error: "Card not found" },
          { status: 404 },
        );
      }
      const card = cards[0];
      cardCode = card.card_code;

      if (card.status !== "PENDING") {
        await conn.rollback();
        return NextResponse.json(
          {
            ok: false,
            error: `Card is already ${card.status} and cannot be marked as traded again`,
          },
          { status: 400 },
        );
      }

      // 2. Load ALL waiting orders for this card (pos1 + waitlist)
      const [waitingOrders] = await conn.execute<RowDataPacket[]>(
        `SELECT o.id, o.queue_position, b.discord_id
         FROM orders o
         JOIN buyers b ON o.buyer_id = b.id
         WHERE o.card_id = ? AND o.account_id = ? AND o.status = 'WAITING'
         ORDER BY o.queue_position ASC`,
        [card_id, accountId],
      );

      const pos1 = waitingOrders[0];
      let completedDesc = "";

      if (pos1) {
        completedDesc = pos1.discord_id;

        await conn.execute(
          `UPDATE orders
           SET status = 'COMPLETED',
               completed_at = NOW(),
               deleted = ?
           WHERE id = ? AND account_id = ? AND status = 'WAITING'`,
          [delete_from_discord ? 1 : 0, pos1.id, accountId],
        );

        await conn.execute(
          `UPDATE orders
           SET status = 'CANCELLED'
           WHERE card_id = ? AND account_id = ?
             AND id != ? AND status = 'WAITING'`,
          [card_id, accountId, pos1.id],
        );
      }

      // Collect all affected buyers (pos1 completed + waitlist cancelled)
      for (const w of waitingOrders) {
        affectedDiscordIds.add(w.discord_id);
      }

      // 3. Derive traded_for server-side
      const derivedTradedFor = `${card.card_code} (${card.price_tier} ${
        card.currency_type || "silver"
      })`;
      const tradedFor =
        typeof completed_cards === "string" && completed_cards.trim().length > 0
          ? completed_cards.trim()
          : derivedTradedFor;

      await conn.execute(
        `UPDATE cards
         SET status = 'TRADED',
             traded_for = ?,
             traded_at = NOW()
         WHERE id = ? AND account_id = ?`,
        [tradedFor, card_id, accountId],
      );

      // 4. Audit log
      const description = delete_from_discord
        ? `Card ${card.card_code} marked as traded and deleted from Discord${
            completedDesc ? ` to <@${completedDesc}>` : ""
          } - Traded for: ${tradedFor}`
        : `Card ${card.card_code} marked as traded${
            completedDesc ? ` to <@${completedDesc}>` : ""
          } - Traded for: ${tradedFor}`;

      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, account_id, action, entity_type, description)
         VALUES (?, ?, ?, 'CARD_TRADED', 'CARD', ?)`,
        [
          generateULID({ prefix: "log", separator: "_", maxLength: 40 }),
          userId,
          accountId,
          description,
        ],
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    // Bust caches AFTER commit (best effort).
    try {
      await invalidateBulkOrderMutationCaches(accountId, affectedDiscordIds, [
        cardCode,
      ]);
    } catch (e) {
      console.error("mark-traded cache invalidate failed:", e);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Mark traded failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to mark card as traded" },
      { status: 500 },
    );
  }
}
