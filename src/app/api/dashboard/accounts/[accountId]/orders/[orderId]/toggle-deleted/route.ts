/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../../../lib/Database/main.db";
import { invalidateOrderMutationCaches } from "../../../../../../../../services/RedisKey.service";

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

    // Fetch affected buyer + card BEFORE update
    const [info] = await pool.execute<RowDataPacket[]>(
      `SELECT b.discord_id, c.card_code
       FROM orders o
       JOIN buyers b ON o.buyer_id = b.id
       JOIN cards c ON o.card_id = c.id
       WHERE o.id = ? AND o.account_id = ?
       LIMIT 1`,
      [orderId, accountId],
    );

    const [result]: any = await pool.execute(
      "UPDATE orders SET deleted = NOT deleted WHERE id = ? AND account_id = ? AND status = 'COMPLETED'",
      [orderId, accountId],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Order could not be toggled. Only completed orders can be toggled.",
        },
        { status: 400 },
      );
    }

    if (info.length > 0) {
      try {
        await invalidateOrderMutationCaches(
          accountId,
          info[0].discord_id,
          info[0].card_code,
        );
      } catch (e) {
        console.error("toggle-deleted cache invalidate failed:", e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Toggle deleted failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to toggle" },
      { status: 500 },
    );
  }
}
