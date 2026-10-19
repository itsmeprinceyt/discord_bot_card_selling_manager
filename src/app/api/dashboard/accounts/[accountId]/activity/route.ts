/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../lib/Database/main.db";
import { getRedis } from "../../../../../../lib/Redis/redis.config";
import { RedisKeyService } from "../../../../../../services/RedisKey.service";
import { AuditLogSingleServerRow } from "../../../../../../types/AuditLog/auditLog.types";

interface AuditLogsPayload {
  logs: AuditLogSingleServerRow[];
  total: number;
  pages: number;
}

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

    // Verify Ownership — always hit DB, cache must never bypass auth.
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

    const { redis_key: logsKey, redis_ttl: logsTtl } =
      RedisKeyService.auditLogs(accountId, page, actionFilter, entityFilter);

    const redis = await getRedis();

    // ── Cache read ──────────────────────────────────────────────────────
    try {
      const cached = await redis.get<string>(logsKey);
      if (cached) {
        const parsed =
          typeof cached === "string"
            ? (JSON.parse(cached) as AuditLogsPayload)
            : (cached as AuditLogsPayload);
        return NextResponse.json({ ok: true, ...parsed });
      }
    } catch (cacheErr) {
      console.error("GET audit logs cache read failed:", cacheErr);
    }

    // ── Cache miss → hit DB ─────────────────────────────────────────────
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
    const total = Number(countResult[0].total);
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

    const payload: AuditLogsPayload = { logs, total, pages };

    // ── Cache write ─────────────────────────────────────────────────────
    try {
      await redis.set(logsKey, JSON.stringify(payload), { ex: logsTtl });
    } catch (cacheErr) {
      console.error("GET audit logs cache write failed:", cacheErr);
    }

    return NextResponse.json({ ok: true, ...payload });
  } catch (err) {
    console.error("GET activity logs failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch logs" },
      { status: 500 },
    );
  }
}
