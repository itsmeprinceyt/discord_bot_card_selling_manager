import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { authOptions } from "../../../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../../../lib/Database/main.db";

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

    // Toggle deleted status — only for COMPLETED orders.
    const [result] = await pool.execute<ResultSetHeader>(
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Toggle deleted failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to toggle" },
      { status: 500 },
    );
  }
}
