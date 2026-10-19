/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../../lib/Database/main.db";
import { generateULID } from "../../../../../../../utils/generateULID.util";

/**
 * Per-order action endpoint.
 *
 * Body:
 *   { action: "complete" }
 *   { action: "cancel" }
 *   { action: "cancel-first" }
 *
 * - complete      → mark order COMPLETED, mark its card TRADED (with
 *                   `traded_for` derived from the card row), cancel any
 *                   other WAITING orders for the same card (the card was
 *                   traded to this buyer, so the waitlist is moot).
 * - cancel        → mark order CANCELLED (only if currently WAITING), then
 *                   shift down subsequent WAITING orders so positions stay
 *                   contiguous.
 * - cancel-first  → same as cancel; kept as a distinct action for the "Cancel
 *                   First" button on the card page.
 *
 * The former `orders.completed_cards` column has been dropped —
 * `cards.traded_for` is the only place the trade description lives now,
 * and it is populated from the card row server-side, not from the client.
 *
 * Safety guards:
 *   • COMPLETED orders cannot be touched (must use /undo).
 *   • CANCELLED orders cannot be touched.
 *   • Only WAITING orders are eligible for either action.
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

    // ── Fetch order + card details (for traded_for derivation) ──────────
    const [orders] = await pool.execute<RowDataPacket[]>(
      `SELECT o.id, o.card_id, o.status, o.queue_position,
              c.card_code, c.price_tier, c.currency_type
       FROM orders o
       JOIN cards c ON o.card_id = c.id
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
      // Derive the trade description from the card row — the client no
      // longer sends `completed_cards`, and `orders.completed_cards` no
      // longer exists. `cards.traded_for` remains as the record of trade.
      const tradedFor = `${order.card_code} (${order.price_tier} ${
        order.currency_type || "silver"
      })`;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const [completeRes]: any = await conn.execute(
          `UPDATE orders
           SET status = 'COMPLETED',
               completed_at = NOW()
           WHERE id = ? AND account_id = ? AND status = 'WAITING'`,
          [orderId, accountId],
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

        await conn.execute(
          `INSERT INTO audit_logs (id, user_id, account_id, action, entity_type, description)
           VALUES (?, ?, ?, 'ORDER_COMPLETED', 'ORDER', ?)`,
          [
            generateULID({ prefix: "log", separator: "_", maxLength: 40 }),
            userId,
            accountId,
            `Order ${orderId} marked as completed (card traded)`,
          ],
        );

        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      return NextResponse.json({ ok: true });
    }

    // ── Cancel / cancel-first: cancel only if WAITING, then promote ─────
    if (action === "cancel" || action === "cancel-first") {
      const conn = await pool.getConnection();
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

        // Shift down subsequent WAITING orders to keep positions contiguous
        await conn.execute(
          `UPDATE orders
           SET queue_position = queue_position - 1
           WHERE card_id = ? AND account_id = ?
             AND status = 'WAITING'
             AND queue_position > ?`,
          [order.card_id, accountId, order.queue_position],
        );

        await conn.execute(
          `INSERT INTO audit_logs (id, user_id, account_id, action, entity_type, description)
           VALUES (?, ?, ?, 'ORDER_CANCELLED', 'ORDER', ?)`,
          [
            generateULID({ prefix: "log", separator: "_", maxLength: 40 }),
            userId,
            accountId,
            action === "cancel-first"
              ? `First-position order ${orderId} cancelled`
              : `Order ${orderId} cancelled`,
          ],
        );

        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      return NextResponse.json({ ok: true });
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
