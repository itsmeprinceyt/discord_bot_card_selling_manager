import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../../../lib/Database/main.db";
import { generateULID } from "../../../../../../../utils/generateULID.util";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  try {
    const { accountId } = await params;
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId)
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );

    const body = await req.json();
    const { card_id, completed_cards, delete_from_discord } = body;

    const pool = await getPool();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // 1. Get card details
      const [cards] = await conn.execute<RowDataPacket[]>(
        "SELECT card_code, price_tier, currency_type FROM cards WHERE id = ? AND account_id = ? LIMIT 1",
        [card_id, accountId],
      );
      if (cards.length === 0) throw new Error("Card not found");
      const card = cards[0];

      // 2. Get position 1 order
      const [orders] = await conn.execute<RowDataPacket[]>(
        `SELECT o.id, b.discord_id 
         FROM orders o JOIN buyers b ON o.buyer_id = b.id
         WHERE o.card_id = ? AND o.queue_position = 1 AND o.status = 'WAITING' LIMIT 1`,
        [card_id],
      );
      const pos1 = orders[0];

      let completedDesc = "";
      if (pos1) {
        completedDesc = pos1.discord_id;
        // Complete pos 1
        await conn.execute(
          `UPDATE orders 
           SET status = 'COMPLETED', completed_at = NOW(), completed_cards = ?, deleted = ? 
           WHERE id = ?`,
          [completed_cards || null, delete_from_discord ? 1 : 0, pos1.id],
        );
      }

      // 3. Cancel rest
      await conn.execute(
        `UPDATE orders SET status = 'CANCELLED' 
         WHERE card_id = ? AND status = 'WAITING' AND queue_position > 1`,
        [card_id],
      );

      // 4. Mark card as Traded
      await conn.execute(
        `UPDATE cards SET status = 'TRADED', traded_for = ?, traded_at = NOW() WHERE id = ?`,
        [completed_cards || null, card_id],
      );

      // 5. Audit Log
      const description = delete_from_discord
        ? `Card ${card.card_code} marked as traded and deleted from Discord${completedDesc ? ` to <@${completedDesc}>` : ""} - Traded for: ${completed_cards}`
        : `Card ${card.card_code} marked as traded${completedDesc ? ` to <@${completedDesc}>` : ""} - Traded for: ${completed_cards}`;

      await conn.execute(
        `INSERT INTO audit_logs (id, user_id, account_id, action, entity_type, description) 
         VALUES (?, ?, ?, 'CARD_TRADED', 'CARD', ?)`,
        [
          generateULID({ prefix: "log", separator: "_", maxLength: 40 }),
          userId,
          accountId,
          description,
        ],
      );

      await conn.commit();
      return NextResponse.json({ ok: true });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("Mark traded failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to mark card as traded" },
      { status: 500 },
    );
  }
}
