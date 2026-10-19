import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";

import { authOptions } from "../../../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../../../lib/Database/main.db";

/**
 * Undo a completed order.
 *
 * Reverts the order back to WAITING and its card back to PENDING, clearing
 * the trade metadata (`traded_at`, `traded_for`) on the card. The former
 * `orders.completed_cards` column has been dropped, so it is no longer
 * cleared here.
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

    // Verify ownership
    const [accounts] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM accounts WHERE id = ? AND user_id = ? LIMIT 1",
      [accountId, userId],
    );
    if (accounts.length === 0)
      return NextResponse.json(
        { ok: false, error: "Account not found" },
        { status: 404 },
      );

    // Fetch order to get card_id
    const [orders] = await pool.execute<RowDataPacket[]>(
      "SELECT card_id FROM orders WHERE id = ? AND account_id = ? AND status = 'COMPLETED'",
      [orderId, accountId],
    );
    if (orders.length === 0)
      return NextResponse.json(
        { ok: false, error: "Order not found" },
        { status: 404 },
      );

    const cardId = orders[0].card_id;

    // 1. Revert Order (completed_cards no longer exists on this table)
    await pool.execute(
      "UPDATE orders SET status = 'WAITING', completed_at = NULL, deleted = FALSE WHERE id = ? AND account_id = ?",
      [orderId, accountId],
    );

    // 2. Revert Card
    await pool.execute(
      "UPDATE cards SET status = 'PENDING', traded_at = NULL, traded_for = NULL WHERE id = ? AND account_id = ?",
      [cardId, accountId],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Undo order failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to undo" },
      { status: 500 },
    );
  }
}
