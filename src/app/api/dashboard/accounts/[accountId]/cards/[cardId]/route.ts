/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../../lib/Database/main.db";
import { generateULID } from "../../../../../../../utils/generateULID.util";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ accountId: string; cardId: string }> },
) {
  try {
    const { accountId, cardId } = await params;
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId)
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );

    const body = await req.json();
    const { price_tier, currency_type } = body;

    const pool = await getPool();

    // Fetch old card
    const [cards] = await pool.execute<RowDataPacket[]>(
      "SELECT card_code, price_tier FROM cards WHERE id = ? AND account_id = ? LIMIT 1",
      [cardId, accountId],
    );
    if (cards.length === 0)
      return NextResponse.json(
        { ok: false, error: "Card not found" },
        { status: 404 },
      );
    const card = cards[0];

    const updateFields: string[] = [];
    const updateParams: any[] = [];

    if (price_tier) {
      updateFields.push("price_tier = ?");
      updateParams.push(price_tier);
    }
    if (currency_type) {
      updateFields.push("currency_type = ?");
      updateParams.push(currency_type);
    }

    if (updateFields.length > 0) {
      updateParams.push(cardId);
      await pool.execute(
        `UPDATE cards SET ${updateFields.join(", ")} WHERE id = ?`,
        updateParams,
      );

      // Log
      await pool.execute(
        `INSERT INTO audit_logs (id, user_id, account_id, action, entity_type, description) 
         VALUES (?, ?, ?, 'UPDATE', 'CARD', ?)`,
        [
          generateULID({ prefix: "log", separator: "_", maxLength: 40 }),
          userId,
          accountId,
          `Card ${card.card_code} price changed from ${card.price_tier} to ${price_tier || card.price_tier}`,
        ],
      );
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
