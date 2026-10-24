import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { RowDataPacket } from "mysql2/promise";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../lib/Database/main.db";

interface NameRow extends RowDataPacket {
  name: string;
}

export async function GET(
  _req: Request,
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

    const pool = await getPool();
    const [rows] = await pool.execute<NameRow[]>(
      "SELECT name FROM accounts WHERE id = ? AND user_id = ? LIMIT 1",
      [accountId, userId],
    );
    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Account not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, name: rows[0].name });
  } catch (err) {
    console.error("GET /api/accounts/[accountId]/name failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch name" },
      { status: 500 },
    );
  }
}
