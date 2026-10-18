import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../../lib/Database/main.db";
import { generateULID } from "../../../../../../../utils/generateULID.util";

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

    // Cancel order
    await pool.execute(
      "UPDATE orders SET status = 'CANCELLED' WHERE id = ? AND account_id = ?",
      [orderId, accountId],
    );

    await pool.execute(
      `INSERT INTO audit_logs (id, user_id, account_id, action, entity_type, description) 
       VALUES (?, ?, ?, 'UPDATE', 'ORDER', 'Order cancelled via trade sheet')`,
      [
        generateULID({ prefix: "log", separator: "_", maxLength: 40 }),
        userId,
        accountId,
      ],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Cancel order failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to cancel order" },
      { status: 500 },
    );
  }
}
