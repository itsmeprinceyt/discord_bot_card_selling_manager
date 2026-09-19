import { NextResponse } from "next/server";
import { initServer, db } from "../../../../lib/Database/main.db";
import type { RowDataPacket } from "mysql2";
import requireAdmin from "../../../../utils/Permission/requireAdmin.backend.util";

interface CountRow extends RowDataPacket {
  count: number;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  try {
    await initServer();
    const pool = db();

    const [userRows] = await pool.execute<CountRow[]>(
      "SELECT COUNT(*) AS count FROM users",
    );
    const [adminRows] = await pool.execute<CountRow[]>(
      "SELECT COUNT(*) AS count FROM users WHERE is_admin = TRUE",
    );
    const [accountRows] = await pool.execute<CountRow[]>(
      "SELECT COUNT(*) AS count FROM accounts",
    );

    return NextResponse.json({
      ok: true,
      users: userRows[0]?.count ?? 0,
      admins: adminRows[0]?.count ?? 0,
      accounts: accountRows[0]?.count ?? 0,
    });
  } catch (err) {
    console.error("GET /api/admin/stats failed:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
