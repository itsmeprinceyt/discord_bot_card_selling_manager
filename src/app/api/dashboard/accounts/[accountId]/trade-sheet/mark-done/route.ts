import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../../lib/Database/main.db";
import { generateULID } from "../../../../../../../utils/generateULID.util";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  try {
    const { accountId } = await params;
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId)
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );

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
    if (accounts.length === 0)
      return NextResponse.json(
        { ok: false, error: "Account not found" },
        { status: 404 },
      );

    const conn = await pool.getConnection();
    let completedCount = 0;

    try {
      await conn.beginTransaction();

      for (const orderId of order_ids) {
        // 1. Get order details
        const [orders] = await conn.execute<RowDataPacket[]>(
          `SELECT o.id, o.card_id, c.card_code, c.price_tier, c.currency_type 
           FROM orders o JOIN cards c ON o.card_id = c.id 
           WHERE o.id = ? AND o.account_id = ? AND o.status = 'WAITING'`,
          [orderId, accountId],
        );

        if (orders.length === 0) continue;
        const order = orders[0];

        // 2. Mark order as completed
        await conn.execute(
          `UPDATE orders 
           SET status = 'COMPLETED', completed_at = NOW(), deleted = ? 
           WHERE id = ?`,
          [delete_from_discord ? 1 : 0, orderId],
        );
        completedCount++;

        // 3. Mark card as traded
        await conn.execute(
          `UPDATE cards 
           SET status = 'TRADED', traded_at = NOW(), traded_for = ? 
           WHERE id = ?`,
          [
            `${order.card_code} (${order.price_tier} ${order.currency_type})`,
            order.card_id,
          ],
        );

        // 4. Cancel other waitlisted orders for this card
        await conn.execute(
          `UPDATE orders 
           SET status = 'CANCELLED' 
           WHERE card_id = ? AND account_id = ? AND id != ? AND status = 'WAITING'`,
          [order.card_id, accountId, orderId],
        );
      }

      // 5. Add Audit Log
      const description = delete_from_discord
        ? `Marked ${completedCount} orders as done and deleted from Discord`
        : `Marked ${completedCount} orders as done`;

      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, account_id, action, entity_type, description) 
         VALUES (?, ?, ?, 'UPDATE', 'ORDER', ?)`,
        [
          generateULID({ prefix: "log", separator: "_", maxLength: 40 }),
          userId,
          accountId,
          description,
        ],
      );

      await conn.commit();
      return NextResponse.json({ ok: true, completed: completedCount });
    } catch (e) {
      await conn.rollback();
      throw e;
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
