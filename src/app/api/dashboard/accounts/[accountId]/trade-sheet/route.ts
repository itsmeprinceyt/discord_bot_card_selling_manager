import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../lib/Database/main.db";

interface OrderRow extends RowDataPacket {
  order_id: string;
  queue_position: number;
  discord_id: string;
  card_code: string;
  price_tier: number;
  currency_type: string;
}

interface Tier {
  price_tier: number;
  currency_type: string;
  card_codes: string[];
  order_ids: string[];
}

interface BuyerGroup {
  discord_id: string;
  cards: Tier[];
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

    // Fetch Trade Sheet Orders
    const [orders] = await pool.execute<OrderRow[]>(
      `SELECT 
        o.id AS order_id,
        o.queue_position,
        b.discord_id,
        c.card_code,
        c.price_tier,
        c.currency_type
       FROM orders o
       JOIN buyers b ON o.buyer_id = b.id
       JOIN cards c ON o.card_id = c.id
       WHERE o.account_id = ? 
         AND o.status = 'WAITING' 
         AND o.queue_position = 1
         AND o.deleted = FALSE
       ORDER BY b.discord_id ASC, c.price_tier ASC`,
      [accountId],
    );

    // Group by Buyer
    const byBuyerMap = new Map<string, BuyerGroup>();

    for (const order of orders) {
      const did = order.discord_id;
      if (!byBuyerMap.has(did)) {
        byBuyerMap.set(did, {
          discord_id: did,
          cards: [],
        });
      }

      const buyer = byBuyerMap.get(did)!;
      const tierEntry = buyer.cards.find(
        (c) =>
          c.price_tier === order.price_tier &&
          c.currency_type === order.currency_type,
      );

      if (tierEntry) {
        tierEntry.card_codes.push(order.card_code);
        tierEntry.order_ids.push(order.order_id);
      } else {
        buyer.cards.push({
          price_tier: order.price_tier,
          currency_type: order.currency_type,
          card_codes: [order.card_code],
          order_ids: [order.order_id],
        });
      }
    }

    const byBuyer = Array.from(byBuyerMap.values());

    // Sort cards within buyer by price_tier
    for (const buyer of byBuyer) {
      buyer.cards.sort((a, b) => a.price_tier - b.price_tier);
    }

    return NextResponse.json({ ok: true, byBuyer, orders });
  } catch (err) {
    console.error("GET trade-sheet failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch data" },
      { status: 500 },
    );
  }
}
