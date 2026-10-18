import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../../lib/Database/main.db";
import { generateULID } from "../../../../../../../utils/generateULID.util";
import {
  GameType,
  getValidCurrencies,
} from "../../../../../../../utils/Dashboard/accountLabels"; // Adjust path if needed

interface BuyerRow extends RowDataPacket {
  id: string;
}
interface CardRow extends RowDataPacket {
  id: string;
  status: string;
  currency_type: string;
  price_tier: number;
}
interface OrderRow extends RowDataPacket {
  id: string;
  status: string;
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

    const body = await req.json();
    const { rawText, currency_type } = body;

    if (!rawText) {
      return NextResponse.json(
        { ok: false, error: "No data provided" },
        { status: 400 },
      );
    }

    const pool = await getPool();

    const [accounts] = await pool.execute<RowDataPacket[]>(
      "SELECT game_type FROM accounts WHERE id = ? AND user_id = ? LIMIT 1",
      [accountId, userId],
    );
    if (accounts.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Account not found" },
        { status: 404 },
      );
    }

    const gameType = accounts[0].game_type as GameType;
    const validCurrencies = getValidCurrencies(gameType);
    const finalCurrency = validCurrencies.includes(currency_type)
      ? currency_type
      : validCurrencies[0];

    const result = {
      imported: 0,
      duplicates: 0,
      errors: 0,
      skipped: 0,
      errorDetails: [] as string[],
    };

    const lines = rawText
      .split("\n")
      .map((l: string) => l.trim())
      .filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(/\s+/);

      if (parts.length !== 3) {
        result.errors++;
        result.errorDetails.push(`Line ${i + 1}: Invalid format "${line}"`);
        continue;
      }

      const [discord_id, card_code_raw, price_tier_raw] = parts;
      const card_code = card_code_raw.toLowerCase();
      const price_tier = parseInt(price_tier_raw, 10);

      if (isNaN(price_tier) || price_tier <= 0) {
        result.errors++;
        result.errorDetails.push(
          `Line ${i + 1}: Invalid price tier "${price_tier_raw}"`,
        );
        continue;
      }

      if (!discord_id.match(/^\d+$/)) {
        result.errors++;
        result.errorDetails.push(
          `Line ${i + 1}: Invalid Discord ID "${discord_id}"`,
        );
        continue;
      }

      try {
        const [buyers] = await pool.execute<BuyerRow[]>(
          "SELECT id FROM buyers WHERE discord_id = ? AND account_id = ? LIMIT 1",
          [discord_id, accountId],
        );
        let buyerId = buyers[0]?.id;

        if (!buyerId) {
          buyerId = generateULID({
            prefix: "byr",
            separator: "_",
            maxLength: 40,
          });
          await pool.execute(
            "INSERT INTO buyers (id, account_id, discord_id) VALUES (?, ?, ?)",
            [buyerId, accountId, discord_id],
          );
        }

        const [cards] = await pool.execute<CardRow[]>(
          "SELECT id, status, currency_type, price_tier FROM cards WHERE card_code = ? AND account_id = ? LIMIT 1",
          [card_code, accountId],
        );
        const card = cards[0];
        let cardId = card?.id;

        if (!card) {
          cardId = generateULID({
            prefix: "crd",
            separator: "_",
            maxLength: 40,
          });
          await pool.execute(
            "INSERT INTO cards (id, account_id, card_code, price_tier, currency_type, status) VALUES (?, ?, ?, ?, ?, 'PENDING')",
            [cardId, accountId, card_code, price_tier, finalCurrency],
          );
        } else if (card.status === "TRADED") {
          result.skipped++;
          result.errorDetails.push(
            `Line ${i + 1}: Card ${card_code} is already TRADED - skipped`,
          );
          continue;
        } else {
          await pool.execute(
            "UPDATE cards SET currency_type = ?, price_tier = ?, status = ? WHERE id = ?",
            [
              finalCurrency,
              price_tier,
              card.status === "CANCELLED" ? "PENDING" : card.status,
              cardId,
            ],
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
            const qPos =
              lastOrders.length > 0 ? lastOrders[0].queue_position + 1 : 1;

            await pool.execute(
              "UPDATE orders SET status = 'WAITING', queue_position = ? WHERE id = ?",
              [qPos, existingOrder.id],
            );
            result.imported++;
            continue;
          }
          result.duplicates++;
          continue;
        }

        const [lastOrders] = await pool.execute<OrderRow[]>(
          "SELECT queue_position FROM orders WHERE card_id = ? AND status = 'WAITING' ORDER BY queue_position DESC LIMIT 1",
          [cardId],
        );
        const newQPos =
          lastOrders.length > 0 ? lastOrders[0].queue_position + 1 : 1;

        const orderId = generateULID({
          prefix: "ord",
          separator: "_",
          maxLength: 40,
        });
        await pool.execute(
          "INSERT INTO orders (id, account_id, buyer_id, card_id, queue_position, status) VALUES (?, ?, ?, ?, ?, 'WAITING')",
          [orderId, accountId, buyerId, cardId, newQPos],
        );

        result.imported++;
      } catch (err) {
        console.error(`Bulk import error line ${i + 1}:`, err);
        result.errors++;
        result.errorDetails.push(`Line ${i + 1}: Unexpected database error`);
      }
    }

    if (result.imported > 0) {
      const desc = `Bulk import: ${result.imported} imported, ${result.duplicates} duplicates, ${result.skipped} skipped, ${result.errors} errors`;
      await pool.execute(
        `INSERT INTO audit_logs (id, user_id, account_id, action, entity_type, description) 
         VALUES (?, ?, ?, 'CREATE', 'ORDER', ?)`,
        [
          generateULID({ prefix: "log", separator: "_", maxLength: 40 }),
          userId,
          accountId,
          desc,
        ],
      );
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Bulk import failed:", err);
    return NextResponse.json(
      { ok: false, error: "Bulk import failed" },
      { status: 500 },
    );
  }
}
