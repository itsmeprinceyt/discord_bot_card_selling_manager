/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../../lib/Database/main.db";
import { generateULID } from "../../../../../../../utils/generateULID.util";
import { getRedis } from "../../../../../../../lib/Redis/redis.config";
import { RedisKeyService } from "../../../../../../../services/RedisKey.service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ accountId: string; cardId: string }> },
) {
  try {
    const { accountId, cardId } = await params;
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { price_tier, currency_type } = body ?? {};

    const pool = await getPool();

    const [cards] = await pool.execute<RowDataPacket[]>(
      "SELECT card_code, price_tier, currency_type FROM cards WHERE id = ? AND account_id = ? LIMIT 1",
      [cardId, accountId],
    );
    if (cards.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Card not found" },
        { status: 404 },
      );
    }
    const card = cards[0];

    const hasPrice =
      price_tier !== undefined && price_tier !== null && price_tier !== "";
    const parsedPrice = hasPrice ? Number(price_tier) : null;

    if (hasPrice && (!Number.isFinite(parsedPrice!) || parsedPrice! <= 0)) {
      return NextResponse.json(
        { ok: false, error: "Price tier must be a positive number" },
        { status: 400 },
      );
    }

    const hasCurrency =
      typeof currency_type === "string" && currency_type.trim().length > 0;

    const updateFields: string[] = [];
    const updateParams: any[] = [];

    if (hasPrice) {
      updateFields.push("price_tier = ?");
      updateParams.push(parsedPrice);
    }
    if (hasCurrency) {
      updateFields.push("currency_type = ?");
      updateParams.push(currency_type);
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Nothing to update" },
        { status: 400 },
      );
    }

    updateParams.push(cardId, accountId);
    await pool.execute(
      `UPDATE cards SET ${updateFields.join(", ")} WHERE id = ? AND account_id = ?`,
      updateParams,
    );

    const oldPrice = Number(card.price_tier);
    const oldCurrency = card.currency_type;
    const newPrice = hasPrice ? parsedPrice : oldPrice;
    const newCurrency = hasCurrency ? currency_type : oldCurrency;

    const changes: string[] = [];
    if (hasPrice && oldPrice !== newPrice) {
      changes.push(`price ${oldPrice} → ${newPrice}`);
    }
    if (hasCurrency && oldCurrency !== newCurrency) {
      changes.push(`currency ${oldCurrency} → ${newCurrency}`);
    }

    if (changes.length > 0) {
      await pool.execute(
        `INSERT INTO audit_logs (id, user_id, account_id, action, entity_type, description)
         VALUES (?, ?, ?, 'UPDATE', 'CARD', ?)`,
        [
          generateULID({ prefix: "log", separator: "_", maxLength: 40 }),
          userId,
          accountId,
          `Card ${card.card_code} updated: ${changes.join(", ")}`,
        ],
      );
    }

    // Bust card_single cache — price/currency part of the cached payload.
    try {
      const redis = await getRedis();
      await redis.del(
        RedisKeyService.cardSingle(accountId, card.card_code).redis_key,
      );
    } catch (e) {
      console.error("card price update cache invalidate failed:", e);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Update card failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to update card" },
      { status: 500 },
    );
  }
}
