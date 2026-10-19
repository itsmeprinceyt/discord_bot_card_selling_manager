/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../lib/Database/main.db";
import { getRedis } from "../../../../../../lib/Redis/redis.config";
import { RedisKeyService } from "../../../../../../services/RedisKey.service";

interface BuyerRow extends RowDataPacket {
  id: string;
  discord_id: string;
  created_at: string;
  orders_count?: number;
}

interface OrderRow extends RowDataPacket {
  order_id: string;
  queue_position: number;
  status: string;
  card_id: string;
  card_code: string;
  price_tier: number;
  currency_type: string;
}

interface CountRow extends RowDataPacket {
  total: number;
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
    const discordId = searchParams.get("discord_id");
    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = 20;
    const offset = (page - 1) * limit;

    const pool = await getPool();

    // Verify ownership — always hit DB, cache never bypasses auth.
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

    // --- 1. SEARCH SINGLE BUYER ---
    if (discordId) {
      const trimmed = discordId.trim();
      const { redis_key, redis_ttl } = RedisKeyService.buyerSingle(
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
        console.error("buyer_single cache read failed:", e);
      }

      const [buyers] = await pool.execute<BuyerRow[]>(
        "SELECT id, discord_id, created_at FROM buyers WHERE discord_id = ? AND account_id = ? LIMIT 1",
        [trimmed, accountId],
      );
      if (buyers.length === 0) {
        return NextResponse.json(
          { ok: false, error: "Buyer not found" },
          { status: 404 },
        );
      }

      const buyer = buyers[0];

      const [orders] = await pool.execute<OrderRow[]>(
        `SELECT 
          o.id AS order_id, 
          o.queue_position, 
          o.status,
          c.id AS card_id,
          c.card_code, 
          c.price_tier, 
          c.currency_type
         FROM orders o
         JOIN cards c ON o.card_id = c.id
         WHERE o.buyer_id = ? AND o.account_id = ? AND o.status = 'WAITING'
         ORDER BY c.price_tier ASC, o.queue_position ASC`,
        [buyer.id, accountId],
      );

      const payload = {
        buyer: {
          id: buyer.id,
          discord_id: buyer.discord_id,
          created_at: buyer.created_at,
          orders: orders.map((o) => ({
            id: o.order_id,
            queue_position: o.queue_position,
            status: o.status,
            card: {
              id: o.card_id,
              card_code: o.card_code,
              price_tier: o.price_tier,
              currency_type: o.currency_type,
            },
          })),
        },
      };

      try {
        await redis.set(redis_key, JSON.stringify(payload), { ex: redis_ttl });
      } catch (e) {
        console.error("buyer_single cache write failed:", e);
      }

      return NextResponse.json({ ok: true, ...payload });
    }

    // --- 2. LIST BUYERS (Paginated) ---
    const { redis_key, redis_ttl } = RedisKeyService.buyersList(
      accountId,
      page,
      search,
    );

    try {
      const cached = await redis.get<string>(redis_key);
      if (cached) {
        const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
        return NextResponse.json({ ok: true, ...parsed });
      }
    } catch (e) {
      console.error("buyers_list cache read failed:", e);
    }

    let whereClause = "b.account_id = ?";
    const filterParams: any[] = [accountId];
    if (search) {
      whereClause += " AND b.discord_id LIKE ?";
      filterParams.push(`%${search}%`);
    }

    const [countRes] = await pool.execute<CountRow[]>(
      `SELECT COUNT(*) as total FROM buyers b WHERE ${whereClause}`,
      filterParams,
    );
    const total = Number(countRes[0].total);
    const pages = Math.max(1, Math.ceil(total / limit));

    const [buyers] = await pool.execute<BuyerRow[]>(
      `SELECT b.id, b.discord_id, b.created_at,
              COUNT(CASE WHEN o.status = 'WAITING' AND o.deleted = FALSE THEN 1 END) as orders_count
       FROM buyers b
       LEFT JOIN orders o ON b.id = o.buyer_id AND o.account_id = b.account_id
       WHERE ${whereClause}
       GROUP BY b.id, b.discord_id, b.created_at
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      [...filterParams, limit, offset],
    );

    const payload = { buyers, total, pages };

    try {
      await redis.set(redis_key, JSON.stringify(payload), { ex: redis_ttl });
    } catch (e) {
      console.error("buyers_list cache write failed:", e);
    }

    return NextResponse.json({ ok: true, ...payload });
  } catch (err) {
    console.error("GET buyers failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch buyers" },
      { status: 500 },
    );
  }
}
