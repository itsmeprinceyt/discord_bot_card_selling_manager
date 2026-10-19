import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../../lib/Database/main.db";
import { generateULID } from "../../../../../../../utils/generateULID.util";

/**
 * Bulk mark-done from the Trade Sheet.
 *
 * For every selected order that is still WAITING:
 *   - Sets status = COMPLETED, completed_at = NOW()
 *   - Sets `deleted = TRUE` if `delete_from_discord = true`
 *   - Marks the associated card as TRADED with `traded_for` = "<card_code> (<tier> <currency>)"
 *   - Cancels every OTHER waiting order for the same card
 *
 * The former `orders.completed_cards` column has been dropped —
 * `cards.traded_for` is the only place the trade description lives now.
 *
 * Writes a single aggregate audit log entry.
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
    const { order_ids, delete_from_discord } = body;

    if (!order_ids || order_ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No order IDs provided" },
        { status: 400 },
      );
    }

    const pool = await getPool();

    // Ownership check
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

    const conn = await pool.getConnection();
    let completedCount = 0;

    try {
      await conn.beginTransaction();

      for (const orderId of order_ids) {
        // 1. Load order details (only if it's still WAITING)
        const [orders] = await conn.execute<RowDataPacket[]>(
          `SELECT o.id, o.card_id, c.card_code, c.price_tier, c.currency_type
           FROM orders o
           JOIN cards c ON o.card_id = c.id
           WHERE o.id = ? AND o.account_id = ? AND o.status = 'WAITING'
           LIMIT 1`,
          [orderId, accountId],
        );

        if (orders.length === 0) continue;
        const order = orders[0];

        // 2. Build the "traded for" description once, use everywhere
        const tradedFor = `${order.card_code} (${order.price_tier} ${
          order.currency_type || "silver"
        })`;

        // 3. Complete the order — note: no `completed_cards` column anymore
        await conn.execute(
          `UPDATE orders
           SET status = 'COMPLETED',
               completed_at = NOW(),
               deleted = ?
           WHERE id = ? AND account_id = ? AND status = 'WAITING'`,
          [delete_from_discord ? 1 : 0, orderId, accountId],
        );
        completedCount++;

        // 4. Mark card as TRADED — trade description lives here
        await conn.execute(
          `UPDATE cards
           SET status = 'TRADED',
               traded_at = NOW(),
               traded_for = ?
           WHERE id = ? AND account_id = ? AND status = 'PENDING'`,
          [tradedFor, order.card_id, accountId],
        );

        // 5. Cancel any other waiting orders for the same card
        await conn.execute(
          `UPDATE orders
           SET status = 'CANCELLED'
           WHERE card_id = ? AND account_id = ?
             AND id != ? AND status = 'WAITING'`,
          [order.card_id, accountId, orderId],
        );
      }

      // 6. Aggregate audit log
      const description = delete_from_discord
        ? `Marked ${completedCount} order(s) as completed and deleted from Discord`
        : `Marked ${completedCount} order(s) as completed`;

      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, account_id, action, entity_type, description)
         VALUES (?, ?, ?, 'ORDER_COMPLETED', 'ORDER', ?)`,
        [
          generateULID({ prefix: "log", separator: "_", maxLength: 40 }),
          userId,
          accountId,
          description,
        ],
      );

      await conn.commit();
      return NextResponse.json({ ok: true, completed: completedCount });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("Mark done failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to mark orders as done" },
      { status: 500 },
    );
  }
}
