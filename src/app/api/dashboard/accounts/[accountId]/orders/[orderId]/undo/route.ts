/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../../../lib/Database/main.db";
import { invalidateOrderMutationCaches } from "../../../../../../../../services/RedisKey.service";

/**
 * Undo a completed order.
 *
 * Semantics: `complete` cancels every other WAITING order on the card and
 * flips it to TRADED, so by the time undo runs there are no other waiters
 * left. Undo simply puts the buyer back at queue_position = 1 and flips
 * the card back to PENDING.
 *
 * Guard: if the card already has a WAITING order (i.e. it was re-sold
 * after the complete), refuse the undo — restoring a stale #1 would
 * create a duplicate position and silently corrupt the queue. The user
 * should undo immediately, or clean up the card manually.
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

    // Fetch order + card + buyer details needed for the restore + cache bust.
    const [orders] = await pool.execute<RowDataPacket[]>(
      `SELECT o.card_id, o.status AS order_status,
              c.card_code,
              b.discord_id
       FROM orders o
       JOIN cards  c ON o.card_id  = c.id
       JOIN buyers b ON o.buyer_id = b.id
       WHERE o.id = ? AND o.account_id = ?
       LIMIT 1`,
      [orderId, accountId],
    );
    if (orders.length === 0)
      return NextResponse.json(
        { ok: false, error: "Order not found" },
        { status: 404 },
      );

    const order = orders[0];
    if (order.order_status !== "COMPLETED") {
      return NextResponse.json(
        { ok: false, error: "Order is not completed" },
        { status: 400 },
      );
    }

    const cardId = order.card_id as string;
    const cardCode = order.card_code as string;
    const discordId = order.discord_id as string;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Guard: if the card already has a WAITING order, the card has moved
      // on since this complete (re-sold, re-queued) and restoring a stale
      // #1 would collide. Refuse rather than corrupt the queue.
      const [existing]: any = await conn.execute(
        `SELECT id FROM orders
         WHERE card_id = ? AND account_id = ? AND status = 'WAITING'
         LIMIT 1
         FOR UPDATE`,
        [cardId, accountId],
      );
      if (existing.length > 0) {
        await conn.rollback();
        return NextResponse.json(
          {
            ok: false,
            error:
              "Cannot undo: this card already has an active order. Undo was only valid while the card had no other waiters.",
          },
          { status: 409 },
        );
      }

      // Flip the completed order back to WAITING at position #1.
      await conn.execute(
        `UPDATE orders
         SET status = 'WAITING',
             completed_at = NULL,
             deleted = FALSE,
             queue_position = 1
         WHERE id = ? AND account_id = ? AND status = 'COMPLETED'`,
        [orderId, accountId],
      );

      // Flip the card back to PENDING (only if it's still TRADED).
      await conn.execute(
        `UPDATE cards
         SET status = 'PENDING',
             traded_at = NULL,
             traded_for = NULL
         WHERE id = ? AND account_id = ? AND status = 'TRADED'`,
        [cardId, accountId],
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

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
