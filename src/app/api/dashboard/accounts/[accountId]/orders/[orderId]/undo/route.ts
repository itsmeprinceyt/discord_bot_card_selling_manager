import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../../../lib/Database/main.db";
import { invalidateOrderMutationCaches } from "../../../../../../../../services/RedisKey.service";

/**
 * Undo a completed order.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ accountId: string; orderId: string }> },
) {
  try {
    const { accountId, orderId } = await params;
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId)
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );

    const pool = await getPool();

    const [accounts] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM accounts WHERE id = ? AND user_id = ? LIMIT 1",
      [accountId, userId],
    );
    if (accounts.length === 0)
      return NextResponse.json(
        { ok: false, error: "Account not found" },
        { status: 404 },
      );

    // Fetch order details (card_id + buyer discord + card code) for cache bust
    const [orders] = await pool.execute<RowDataPacket[]>(
      `SELECT o.card_id, b.discord_id, c.card_code
       FROM orders o
       JOIN buyers b ON o.buyer_id = b.id
       JOIN cards c ON o.card_id = c.id
       WHERE o.id = ? AND o.account_id = ? AND o.status = 'COMPLETED'
       LIMIT 1`,
      [orderId, accountId],
    );
    if (orders.length === 0)
      return NextResponse.json(
        { ok: false, error: "Order not found" },
        { status: 404 },
      );

    const cardId = orders[0].card_id;
    const discordId = orders[0].discord_id;
    const cardCode = orders[0].card_code;

    await pool.execute(
      "UPDATE orders SET status = 'WAITING', completed_at = NULL, deleted = FALSE WHERE id = ? AND account_id = ?",
      [orderId, accountId],
    );

    await pool.execute(
      "UPDATE cards SET status = 'PENDING', traded_at = NULL, traded_for = NULL WHERE id = ? AND account_id = ?",
      [cardId, accountId],
    );

    try {
      await invalidateOrderMutationCaches(accountId, discordId, cardCode);
    } catch (e) {
      console.error("undo cache invalidate failed:", e);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Undo order failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to undo" },
      { status: 500 },
    );
  }
}
