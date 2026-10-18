/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../lib/Database/main.db";

interface CardRow extends RowDataPacket {
  id: string;
  card_code: string;
  price_tier: number;
  currency_type: string;
  status: "PENDING" | "TRADED" | "CANCELLED";
  traded_for: string | null;
  created_at: string;
  orders?: OrderRow[];
}

interface OrderRow extends RowDataPacket {
  id: string;
  queue_position: number;
  discord_id: string;
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
    const cardCode = searchParams.get("card_code");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
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

    // --- 1. SEARCH SINGLE CARD ---
    if (cardCode) {
      const [cards] = await pool.execute<CardRow[]>(
        `SELECT id, card_code, price_tier, currency_type, status, traded_for, created_at 
         FROM cards WHERE card_code = ? AND account_id = ? LIMIT 1`,
        [cardCode.trim(), accountId],
      );

      if (cards.length === 0) {
        return NextResponse.json(
          { ok: false, error: "Card not found" },
          { status: 404 },
        );
      }

      const card = cards[0];

      // Fetch its waiting orders
      const [orders] = await pool.execute<OrderRow[]>(
        `SELECT o.id, o.queue_position, b.discord_id 
         FROM orders o 
         JOIN buyers b ON o.buyer_id = b.id
         WHERE o.card_id = ? AND o.status = 'WAITING'
         ORDER BY o.queue_position ASC`,
        [card.id],
      );

      // Format to match frontend expectations
      card.orders = orders.map((o) => ({
        id: o.id,
        queue_position: o.queue_position,
        buyer: { discord_id: o.discord_id },
      })) as any;

      return NextResponse.json({ ok: true, card });
    }

    // --- 2. LIST CARDS (Paginated) ---
    let whereClause = "account_id = ?";
    const queryParams: any[] = [accountId];

    if (search) {
      whereClause += " AND card_code LIKE ?";
      queryParams.push(`%${search}%`);
    }
    if (status) {
      whereClause += " AND status = ?";
      queryParams.push(status);
    }

    const [countRes] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM cards WHERE ${whereClause}`,
      queryParams,
    );
    const total = countRes[0].total;
    const pages = Math.ceil(total / limit);

    const [cards] = await pool.execute<CardRow[]>(
      `SELECT id, card_code, price_tier, currency_type, status, traded_for, created_at 
       FROM cards WHERE ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset],
    );

    // Populate orders for each card
    for (const card of cards) {
      const [orders] = await pool.execute<OrderRow[]>(
        `SELECT o.id, o.queue_position, b.discord_id 
         FROM orders o 
         JOIN buyers b ON o.buyer_id = b.id
         WHERE o.card_id = ? AND o.status = 'WAITING'
         ORDER BY o.queue_position ASC`,
        [card.id],
      );
      card.orders = orders.map((o) => ({
        id: o.id,
        queue_position: o.queue_position,
        buyer: { discord_id: o.discord_id },
      })) as any;
    }

    return NextResponse.json({ ok: true, cards, total, pages });
  } catch (err) {
    console.error("GET cards failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch cards" },
      { status: 500 },
    );
  }
}
