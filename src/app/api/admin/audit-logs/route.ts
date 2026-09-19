import { NextResponse } from "next/server";
import { initServer, db } from "../../../../lib/Database/main.db";
import type { RowDataPacket } from "mysql2";
import requireAdmin from "../../../../utils/Permission/requireAdmin.backend.util";

interface AuditLogRow extends RowDataPacket {
  id: string;
  user_id: string | null;
  account_id: string | null;
  action: string;
  entity_type: string;
  description: string;
  created_at: string;
}

interface CountRow extends RowDataPacket {
  count: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);

    const page = Math.max(
      1,
      parseInt(searchParams.get("page") ?? "1", 10) || 1,
    );
    const limitRaw = parseInt(
      searchParams.get("limit") ?? String(DEFAULT_LIMIT),
      10,
    );
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT),
    );

    await initServer();
    const pool = db();

    const [countRows] = await pool.execute<CountRow[]>(
      "SELECT COUNT(*) AS count FROM audit_logs",
    );
    const total = countRows[0]?.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Clamp page to last page if the caller requested beyond range.
    const safePage = Math.min(page, totalPages);
    const safeOffset = (safePage - 1) * limit;

    const [rows] = await pool.execute<AuditLogRow[]>(
      `SELECT id, user_id, account_id, action, entity_type, description, created_at
       FROM audit_logs
       ORDER BY created_at DESC, id DESC
       LIMIT ${limit} OFFSET ${safeOffset}`,
    );

    return NextResponse.json({
      ok: true,
      logs: rows,
      page: safePage,
      limit,
      total,
      totalPages,
    });
  } catch (err) {
    console.error("GET /api/admin/audit-logs failed:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
