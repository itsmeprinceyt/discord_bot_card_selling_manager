/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../lib/Database/main.db";

interface OrderRow extends RowDataPacket {
  id: string;
  queue_position: number;
  status: string;
  completed_at: string | null;
  created_at: string;
  deleted: number;
  buyer_discord_id: string;
  card_code: string;
  price_tier: number;
  currency_type: string;
}

interface CountRow extends RowDataPacket {
  total: number;
}

const VALID_STATUSES = ["all", "WAITING", "CANCELLED", "COMPLETED"] as const;
type StatusFilter = (typeof VALID_STATUSES)[number];

async function cleanupOldCompletedOrders() {
  try {
    const pool = await getPool();

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const cutoffStr = sixMonthsAgo.toISOString().slice(0, 19).replace("T", " ");

    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM orders 
       WHERE status = 'COMPLETED' 
         AND completed_at < ?`,
      [cutoffStr],
    );

    if (result.affectedRows > 0) {
      console.log(
        `[Global Cleanup] Silently deleted ${result.affectedRows} completed orders older than 6 months.`,
      );
    }
  } catch (err) {
    console.error("Global cleanup failed:", err);
  }
}

/* --------------------------------- GET --------------------------------- */
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

    // Await so the DELETE finishes before we COUNT / SELECT.
    await cleanupOldCompletedOrders();

    const { searchParams } = new URL(req.url);
    const requestedPage = Math.max(
      1,
      parseInt(searchParams.get("page") || "1", 10),
    );
    const search = searchParams.get("search") || "";

    const rawStatus = searchParams.get("status") || "all";
    const statusFilter: StatusFilter = (
      VALID_STATUSES as readonly string[]
    ).includes(rawStatus)
      ? (rawStatus as StatusFilter)
      : "all";

    const showDeleted = searchParams.get("showDeleted") !== "false";

    const limit = 100;

    const pool = await getPool();

    // Verify ownership
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

    // ── Build WHERE ───────────────────────────────────────────────────────
    let whereClause = "o.account_id = ?";
    const queryParams: any[] = [accountId];

    if (statusFilter !== "all") {
      whereClause += " AND o.status = ?";
      queryParams.push(statusFilter);
    }

    if (!showDeleted) {
      whereClause += " AND o.deleted = FALSE";
    }

    if (search) {
      whereClause += " AND (b.discord_id LIKE ? OR c.card_code LIKE ?)";
      queryParams.push(`%${search}%`, `%${search.toUpperCase()}%`);
    }

    // Count Total (with current filters — deleted rows are excluded when
    // showDeleted=false, so total/pages shrink immediately after a delete)
    const [countResult] = await pool.execute<CountRow[]>(
      `SELECT COUNT(*) as total 
       FROM orders o
       JOIN buyers b ON o.buyer_id = b.id
       JOIN cards c ON o.card_id = c.id
       WHERE ${whereClause}`,
      queryParams,
    );
    const total = countResult[0].total;
    const pages = Math.max(1, Math.ceil(total / limit));

    // Clamp the requested page so that if the caller was on a page that no
    // longer exists (e.g. last rows on page 1 got deleted), we return the
    // last valid page instead of an empty slice.
    const page = Math.min(requestedPage, pages);
    const offset = (page - 1) * limit;

    // Fetch Data
    const [rows] = await pool.execute<OrderRow[]>(
      `SELECT 
        o.id,
        o.queue_position,
        o.status,
        o.completed_at,
        o.created_at,
        o.deleted,
        b.discord_id AS buyer_discord_id,
        c.card_code,
        c.price_tier,
        c.currency_type
       FROM orders o
       JOIN buyers b ON o.buyer_id = b.id
       JOIN cards c ON o.card_id = c.id
       WHERE ${whereClause}
       ORDER BY COALESCE(o.completed_at, o.created_at) DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset],
    );

    const formattedOrders = rows.map((row) => ({
      id: row.id,
      queue_position: row.queue_position,
      status: row.status,
      completed_at: row.completed_at,
      created_at: row.created_at,
      deleted: Boolean(row.deleted),
      buyer: { discord_id: row.buyer_discord_id },
      card: {
        card_code: row.card_code,
        price_tier: row.price_tier,
        currency_type: row.currency_type,
      },
    }));

    return NextResponse.json({
      ok: true,
      orders: formattedOrders,
      total,
      pages,
      page, // echo back the clamped page the frontend should display
    });
  } catch (err) {
    console.error("GET orders failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch" },
      { status: 500 },
    );
  }
}
