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

    cleanupOldCompletedOrders();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const search = searchParams.get("search") || "";
    const showDeleted = searchParams.get("showDeleted") !== "false";
    const hideCompleted = searchParams.get("hideCompleted") === "true";

    const limit = 20;
    const offset = (page - 1) * limit;

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
    // Default: ALL statuses (WAITING / CANCELLED / COMPLETED).
    // `hideCompleted=true` filters COMPLETED out.
    let whereClause = "o.account_id = ?";
    const queryParams: any[] = [accountId];

    if (!showDeleted) {
      whereClause += " AND o.deleted = FALSE";
    }

    if (hideCompleted) {
      whereClause += " AND o.status != 'COMPLETED'";
    }

    if (search) {
      whereClause += " AND (b.discord_id LIKE ? OR c.card_code LIKE ?)";
      queryParams.push(`%${search}%`, `%${search.toUpperCase()}%`);
    }

    // Count Total
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

    // Fetch Data — completed_cards column has been dropped from orders
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
    });
  } catch (err) {
    console.error("GET orders failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch" },
      { status: 500 },
    );
  }
}
