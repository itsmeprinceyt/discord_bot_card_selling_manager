/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../lib/Database/main.db";
import { getRedis } from "../../../../../../lib/Redis/redis.config";
import { RedisKeyService } from "../../../../../../services/RedisKey.service";

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
  card_id: string;
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
    const limit = 100;

    const pool = await getPool();

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

    const redis = await getRedis();

    // --- 1. SEARCH SINGLE CARD ---
    if (cardCode) {
      const trimmed = cardCode.trim().toLowerCase();
      const { redis_key, redis_ttl } = RedisKeyService.cardSingle(
        accountId,
        trimmed,
      );

      try {
        const cached = await redis.get<string>(redis_key);
        if (cached) {
          const parsed =
            typeof cached === "string" ? JSON.parse(cached) : cached;
          return NextResponse.json({ ok: true, ...parsed });
        }
      } catch (e) {
        console.error("card_single cache read failed:", e);
      }

      const [cards] = await pool.execute<CardRow[]>(
        `SELECT id, card_code, price_tier, currency_type, status, traded_for, created_at 
         FROM cards WHERE card_code = ? AND account_id = ? LIMIT 1`,
        [trimmed, accountId],
      );

      if (cards.length === 0) {
        return NextResponse.json(
          { ok: false, error: "Card not found" },
          { status: 404 },
        );
      }

      const card = cards[0];

      const [orders] = await pool.execute<OrderRow[]>(
        `SELECT o.id, o.card_id, o.queue_position, b.discord_id 
         FROM orders o 
         JOIN buyers b ON o.buyer_id = b.id
         WHERE o.card_id = ? AND o.status = 'WAITING'
         ORDER BY o.queue_position ASC`,
        [card.id],
      );

      const payload = {
        card: {
          ...card,
          orders: orders.map((o) => ({
            id: o.id,
            queue_position: o.queue_position,
            buyer: { discord_id: o.discord_id },
          })),
        },
      };

      try {
        await redis.set(redis_key, JSON.stringify(payload), { ex: redis_ttl });
      } catch (e) {
        console.error("card_single cache write failed:", e);
      }

      return NextResponse.json({ ok: true, ...payload });
    }

    // --- 2. LIST CARDS (no cache) ---
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
    const total = Number(countRes[0].total);
    const pages = Math.max(1, Math.ceil(total / limit));
    const clampedPage = Math.min(page, pages);
    const clampedOffset = (clampedPage - 1) * limit;

    const [cards] = await pool.execute<CardRow[]>(
      `SELECT id, card_code, price_tier, currency_type, status, traded_for, created_at 
       FROM cards WHERE ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, clampedOffset],
    );

    // ── Batched orders fetch (1 query for all cards on this page) ────────
    if (cards.length > 0) {
      const cardIds = cards.map((c) => c.id);
      const placeholders = cardIds.map(() => "?").join(",");

      const [allOrders] = await pool.execute<OrderRow[]>(
        `SELECT o.id, o.card_id, o.queue_position, b.discord_id
         FROM orders o
         JOIN buyers b ON o.buyer_id = b.id
         WHERE o.card_id IN (${placeholders}) AND o.status = 'WAITING'
         ORDER BY o.card_id, o.queue_position ASC`,
        cardIds,
      );

      // Group orders by card_id
      const ordersByCard = new Map<string, OrderRow[]>();
      for (const o of allOrders) {
        if (!ordersByCard.has(o.card_id)) ordersByCard.set(o.card_id, []);
        ordersByCard.get(o.card_id)!.push(o);
      }

      for (const card of cards) {
        const orders = ordersByCard.get(card.id) ?? [];
        card.orders = orders.map((o) => ({
          id: o.id,
          queue_position: o.queue_position,
          buyer: { discord_id: o.discord_id },
        })) as any;
      }
    }

    return NextResponse.json({
      ok: true,
      cards,
      total,
      pages,
      page: clampedPage,
    });
  } catch (err) {
    console.error("GET cards failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch cards" },
      { status: 500 },
    );
  }
}
