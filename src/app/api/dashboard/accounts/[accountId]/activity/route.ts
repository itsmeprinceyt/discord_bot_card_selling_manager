/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../lib/Database/main.db";
import { AuditLogSingleServerRow } from "../../../../../../types/AuditLog/auditLog.types";

export async function GET(
  req: Request,
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

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const actionFilter = searchParams.get("action");
    const entityFilter = searchParams.get("entity_type");

    const limit = 20;
    const offset = (page - 1) * limit;

    const pool = await getPool();

    // Verify Ownership
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

    // Build Query Filters
    let whereClause = "a.account_id = ?";

    const queryParams: any[] = [accountId];

    if (actionFilter) {
      whereClause += " AND a.action = ?";
      queryParams.push(actionFilter);
    }

    if (entityFilter) {
      whereClause += " AND a.entity_type = ?";
      queryParams.push(entityFilter);
    }

    // 1. Get Total Count
    const [countResult] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM audit_logs a WHERE ${whereClause}`,
      queryParams,
    );
    const total = countResult[0].total;
    const pages = Math.ceil(total / limit);

    // 2. Fetch Data
    const [logs] = await pool.execute<AuditLogSingleServerRow[]>(
      `SELECT 
        a.id, 
        a.action, 
        a.entity_type, 
        a.description, 
        a.created_at,
        u.name AS user_name
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE ${whereClause}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset],
    );

    return NextResponse.json({ ok: true, logs, total, pages });
  } catch (err) {
    console.error("GET activity logs failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch logs" },
      { status: 500 },
    );
  }
}
