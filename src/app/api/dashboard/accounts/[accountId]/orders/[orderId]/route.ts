/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../../lib/Database/main.db";
import { generateULID } from "../../../../../../../utils/generateULID.util";
import { invalidateOrderMutationCaches } from "../../../../../../../services/RedisKey.service";

/**
 * Per-order action endpoint.
 *
 * Body:
 *   { action: "complete", delete_from_discord?: boolean }
 *   { action: "cancel" }
 *   { action: "cancel-first" }
 *
 * - complete      → mark order COMPLETED (+ deleted if delete_from_discord),
 *                   mark its card TRADED (with `traded_for` derived from the
 *                   card row), cancel any other WAITING orders for the same
 *                   card (the card was traded to this buyer, so the waitlist
 *                   is moot).
 * - cancel        → mark order CANCELLED (only if currently WAITING), shift
 *                   down subsequent WAITING orders so positions stay
 *                   contiguous, then delete the card entirely if it now has
 *                   no WAITING orders left and is still PENDING.
 * - cancel-first  → same as cancel; kept as a distinct action for the "Cancel
 *                   First" button on the card page.
 *
 * `delete_from_discord` semantics (orders.deleted column):
 *   - true  → deleted = TRUE  (bot will remove the completed order row from Discord)
 *   - false → deleted = FALSE (order kept, still visible as a completed order)
 *
 * Cache invalidation:
 *   After any successful mutation we bust the buyer_single, card_single, and
 *   account_overview Redis entries so subsequent GETs (including the frontend
 *   `refresh()` call) don't serve stale data.
 *
 * NOTE: orders has UNIQUE(buyer_id, card_id). A completed + flagged order
 * still occupies that (buyer, card) slot — same as a CANCELLED order does.
 * If the same buyer later wants the same card again, the (buyer, card)
 * slot must be freed (order row hard-deleted, or the constraint relaxed).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ accountId: string; orderId: string }> },
) {
  try {
    const { accountId, orderId } = await params;
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body ?? {};
    const deleteFromDiscord: boolean = Boolean(body?.delete_from_discord);

    if (!action) {
      return NextResponse.json(
        { ok: false, error: "action is required" },
        { status: 400 },
      );
    }

    const pool = await getPool();

    // ── Ownership check ─────────────────────────────────────────────────
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

    // ── Fetch order + card + buyer details ──────────────────────────────
    const [orders] = await pool.execute<RowDataPacket[]>(
      `SELECT o.id, o.card_id, o.status, o.queue_position,
              c.card_code, c.price_tier, c.currency_type,
              b.discord_id
       FROM orders o
       JOIN cards  c ON o.card_id  = c.id
       JOIN buyers b ON o.buyer_id = b.id
       WHERE o.id = ? AND o.account_id = ?
       LIMIT 1`,
      [orderId, accountId],
    );
    if (orders.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Order not found" },
        { status: 404 },
      );
    }

    const order = orders[0];

    // ── Safety guards: never touch COMPLETED / CANCELLED ────────────────
    if (order.status === "COMPLETED") {
      return NextResponse.json(
        {
          ok: false,
          error: "Order is already completed. Use undo to revert it.",
        },
        { status: 400 },
      );
    }

    if (order.status === "CANCELLED") {
      return NextResponse.json(
        { ok: false, error: "Order is already cancelled" },
        { status: 400 },
      );
    }

    // ── Complete: mark order done, mark card traded, cancel waitlist ────
    if (action === "complete") {
      const tradedFor = `${order.card_code} (${order.price_tier} ${
        order.currency_type || "silver"
      })`;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // `deleted` is set here based on delete_from_discord.
        const [completeRes]: any = await conn.execute(
          `UPDATE orders
           SET status = 'COMPLETED',
               completed_at = NOW(),
               deleted = ?
           WHERE id = ? AND account_id = ? AND status = 'WAITING'`,
          [deleteFromDiscord ? 1 : 0, orderId, accountId],
        );

        if (completeRes.affectedRows === 0) {
          await conn.rollback();
          return NextResponse.json(
            { ok: false, error: "Order is not waiting" },
            { status: 400 },
          );
        }

        // Mark card as traded (only if still PENDING; idempotent otherwise)
        await conn.execute(
          `UPDATE cards
           SET status = 'TRADED',
               traded_at = NOW(),
               traded_for = ?
           WHERE id = ? AND account_id = ? AND status = 'PENDING'`,
          [tradedFor, order.card_id, accountId],
        );

        // Cancel every other WAITING order for the same card
        await conn.execute(
          `UPDATE orders
           SET status = 'CANCELLED'
           WHERE card_id = ? AND account_id = ?
             AND id != ? AND status = 'WAITING'`,
          [order.card_id, accountId, orderId],
        );

        const auditDesc = deleteFromDiscord
          ? `Order ${orderId} marked as completed (card traded) and flagged for Discord deletion`
          : `Order ${orderId} marked as completed (card traded)`;

        await conn.execute(
          `INSERT INTO audit_logs (id, user_id, account_id, action, entity_type, description)
           VALUES (?, ?, ?, 'ORDER_COMPLETED', 'ORDER', ?)`,
          [
            generateULID({ prefix: "log", separator: "_", maxLength: 40 }),
            userId,
            accountId,
            auditDesc,
          ],
        );

        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      // Bust buyer_single + card_single + account_overview for this mutation
      // so the frontend's follow-up GET (refresh) doesn't serve stale data.
      await invalidateOrderMutationCaches(
        accountId,
        order.discord_id,
        order.card_code,
      );

      return NextResponse.json({ ok: true });
    }

    // ── Cancel / cancel-first ───────────────────────────────────────────
    if (action === "cancel" || action === "cancel-first") {
      const conn = await pool.getConnection();
      let cardDeleted = false;

      try {
        await conn.beginTransaction();

        const [cancelRes]: any = await conn.execute(
          `UPDATE orders
           SET status = 'CANCELLED'
           WHERE id = ? AND account_id = ? AND status = 'WAITING'`,
          [orderId, accountId],
        );

        if (cancelRes.affectedRows === 0) {
          await conn.rollback();
          return NextResponse.json(
            { ok: false, error: "Order is not waiting" },
            { status: 400 },
          );
        }

        await conn.execute(
          `UPDATE orders
           SET queue_position = queue_position - 1
           WHERE card_id = ? AND account_id = ?
             AND status = 'WAITING'
             AND queue_position > ?`,
          [order.card_id, accountId, order.queue_position],
        );

        const [deleteRes]: any = await conn.execute(
          `DELETE c FROM cards c
           WHERE c.id = ? AND c.account_id = ? AND c.status = 'PENDING'
             AND NOT EXISTS (
               SELECT 1 FROM orders o
               WHERE o.card_id = c.id AND o.status = 'WAITING'
             )`,
          [order.card_id, accountId],
        );

        cardDeleted = deleteRes.affectedRows > 0;

        const baseDesc =
          action === "cancel-first"
            ? `First-position order ${orderId} cancelled`
            : `Order ${orderId} cancelled`;

        const auditDesc = cardDeleted
          ? `${baseDesc}; orphaned card ${order.card_code} deleted (no remaining buyers)`
          : baseDesc;

        await conn.execute(
          `INSERT INTO audit_logs (id, user_id, account_id, action, entity_type, description)
           VALUES (?, ?, ?, 'ORDER_CANCELLED', 'ORDER', ?)`,
          [
            generateULID({ prefix: "log", separator: "_", maxLength: 40 }),
            userId,
            accountId,
            auditDesc,
          ],
        );

        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      // Bust buyer_single + card_single + account_overview for this mutation.
      await invalidateOrderMutationCaches(
        accountId,
        order.discord_id,
        order.card_code,
      );

      return NextResponse.json({
        ok: true,
        card_deleted: cardDeleted,
        card_code: cardDeleted ? order.card_code : undefined,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid action" },
      { status: 400 },
    );
  } catch (err) {
    console.error("Order action failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to process order action" },
      { status: 500 },
    );
  }
}
