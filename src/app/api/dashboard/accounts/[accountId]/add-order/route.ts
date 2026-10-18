import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { getPool } from "../../../../../../lib/Database/main.db";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { generateULID } from "../../../../../../utils/generateULID.util";
import {
  GameType,
  getValidCurrencies,
} from "../../../../../../utils/Dashboard/accountLabels";

interface AccountRow extends RowDataPacket {
  id: string;
  game_type: GameType;
}

interface BuyerRow extends RowDataPacket {
  id: string;
}

interface CardRow extends RowDataPacket {
  id: string;
  status: "PENDING" | "TRADED" | "CANCELLED";
  currency_type: string;
  price_tier: number;
}

interface OrderRow extends RowDataPacket {
  id: string;
  status: "WAITING" | "CANCELLED" | "COMPLETED";
  queue_position: number;
}

export async function POST(
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

    const body = await req.json().catch(() => ({}));
    const { discord_id, card_code, price_tier, currency_type } = body;

    const trimDiscord = String(discord_id ?? "").trim();
    const trimCode = String(card_code ?? "")
      .trim()
      .toLowerCase();
    const tier = Number(price_tier);

    if (!trimDiscord || !trimCode || !tier) {
      return NextResponse.json(
        { ok: false, error: "All fields are required" },
        { status: 400 },
      );
    }
    if (tier <= 0) {
      return NextResponse.json(
        { ok: false, error: "Price tier must be a positive number" },
        { status: 400 },
      );
    }

    const pool = await getPool();

    const [accounts] = await pool.execute<AccountRow[]>(
      "SELECT id, game_type FROM accounts WHERE id = ? AND user_id = ? LIMIT 1",
      [accountId, userId],
    );
    if (accounts.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Account not found" },
        { status: 404 },
      );
    }
    const account = accounts[0];

    const validCurrencies = getValidCurrencies(account.game_type);
    let finalCurrency = currency_type || validCurrencies[0];

    if (!validCurrencies.includes(finalCurrency)) {
      finalCurrency = validCurrencies[0];
    }

    const [buyers] = await pool.execute<BuyerRow[]>(
      "SELECT id FROM buyers WHERE discord_id = ? AND account_id = ? LIMIT 1",
      [trimDiscord, accountId],
    );
    let buyerId = buyers[0]?.id;

    if (!buyerId) {
      buyerId = generateULID({ prefix: "byr", separator: "_", maxLength: 40 });
      await pool.execute(
        "INSERT INTO buyers (id, account_id, discord_id) VALUES (?, ?, ?)",
        [buyerId, accountId, trimDiscord],
      );
    }

    const [cards] = await pool.execute<CardRow[]>(
      "SELECT id, status, currency_type, price_tier FROM cards WHERE card_code = ? AND account_id = ? LIMIT 1",
      [trimCode, accountId],
    );
    const card = cards[0];
    let cardId = card?.id;

    if (!card) {
      cardId = generateULID({ prefix: "crd", separator: "_", maxLength: 40 });
      await pool.execute(
        "INSERT INTO cards (id, account_id, card_code, price_tier, currency_type, status) VALUES (?, ?, ?, ?, ?, 'PENDING')",
        [cardId, accountId, trimCode, tier, finalCurrency],
      );
    } else if (card.status === "TRADED") {
      return NextResponse.json(
        {
          ok: false,
          error: `Card ${trimCode} is already marked as TRADED and cannot accept new orders.`,
        },
        { status: 400 },
      );
    } else if (card.status === "CANCELLED") {
      await pool.execute(
        "UPDATE cards SET status = 'PENDING', currency_type = ?, price_tier = ? WHERE id = ?",
        [finalCurrency, tier, cardId],
      );
    }

    const [existingOrders] = await pool.execute<OrderRow[]>(
      "SELECT id, status, queue_position FROM orders WHERE buyer_id = ? AND card_id = ? LIMIT 1",
      [buyerId, cardId],
    );
    const existingOrder = existingOrders[0];

    if (existingOrder) {
      if (existingOrder.status === "CANCELLED") {
        const [lastOrders] = await pool.execute<OrderRow[]>(
          "SELECT queue_position FROM orders WHERE card_id = ? AND status = 'WAITING' ORDER BY queue_position DESC LIMIT 1",
          [cardId],
        );
        const queuePosition =
          lastOrders.length > 0 ? lastOrders[0].queue_position + 1 : 1;

        await pool.execute(
          "UPDATE orders SET status = 'WAITING', queue_position = ? WHERE id = ?",
          [queuePosition, existingOrder.id],
        );

        return NextResponse.json({
          ok: true,
          order: existingOrder,
          queue_position: queuePosition,
          reactivated: true,
        });
      }

      return NextResponse.json(
        {
          ok: false,
          error: `Buyer <@${trimDiscord}> already has an active order for card ${trimCode}`,
        },
        { status: 400 },
      );
    }

    const [lastOrders] = await pool.execute<OrderRow[]>(
      "SELECT queue_position FROM orders WHERE card_id = ? AND status = 'WAITING' ORDER BY queue_position DESC LIMIT 1",
      [cardId],
    );
    const queuePosition =
      lastOrders.length > 0 ? lastOrders[0].queue_position + 1 : 1;

    const orderId = generateULID({
      prefix: "ord",
      separator: "_",
      maxLength: 40,
    });

    await pool.execute(
      "INSERT INTO orders (id, account_id, buyer_id, card_id, queue_position, status) VALUES (?, ?, ?, ?, ?, 'WAITING')",
      [orderId, accountId, buyerId, cardId, queuePosition],
    );

    return NextResponse.json({
      ok: true,
      order: { id: orderId },
      queue_position: queuePosition,
    });
  } catch (err) {
    console.error("POST order failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to create order" },
      { status: 500 },
    );
  }
}
