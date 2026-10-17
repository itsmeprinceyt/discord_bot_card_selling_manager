import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db, initServer } from "../../../../lib/Database/main.db";
import { generateULID } from "../../../../utils/generateULID.util";

interface AccountRow extends RowDataPacket {
  id: string;
  name: string;
  game_type: "SOFI" | "KARUTA";
  created_at: string;
  pending_count: number;
}

interface IdRow extends RowDataPacket {
  id: string;
}

const GAME_TYPES = ["SOFI", "KARUTA"] as const;
type GameType = (typeof GAME_TYPES)[number];

/* --------------------------------- GET --------------------------------- */
export async function GET() {
  try {
    await initServer();
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const pool = db();
    const [rows] = await pool.execute<AccountRow[]>(
      `SELECT a.id,
              a.name,
              a.game_type,
              a.created_at,
              COALESCE(p.pending_count, 0) AS pending_count
         FROM accounts a
         LEFT JOIN (
           SELECT account_id, COUNT(*) AS pending_count
             FROM orders
            WHERE status = 'WAITING' AND deleted = FALSE
            GROUP BY account_id
         ) p ON p.account_id = a.id
        WHERE a.user_id = ?
        ORDER BY a.name ASC`,
      [userId],
    );

    return NextResponse.json({
      ok: true,
      accounts: rows.map((r) => ({
        id: r.id,
        name: r.name,
        game_type: r.game_type,
        created_at: r.created_at,
        pending_count: Number(r.pending_count),
      })),
    });
  } catch (err) {
    console.error("GET /api/accounts failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch accounts" },
      { status: 500 },
    );
  }
}

/* --------------------------------- POST -------------------------------- */
export async function POST(req: Request) {
  try {
    await initServer();
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const gameType = String(body?.game_type ?? "");

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Account name is required" },
        { status: 400 },
      );
    }
    if (name.length > 255) {
      return NextResponse.json(
        { ok: false, error: "Account name is too long" },
        { status: 400 },
      );
    }
    if (!GAME_TYPES.includes(gameType as GameType)) {
      return NextResponse.json(
        { ok: false, error: "Invalid game type" },
        { status: 400 },
      );
    }

    const pool = db();

    // Scope uniqueness to THIS user only — other users can share names.
    const [existing] = await pool.execute<IdRow[]>(
      "SELECT id FROM accounts WHERE name = ? AND user_id = ? LIMIT 1",
      [name, userId],
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { ok: false, error: "You already have an account with this name" },
        { status: 400 },
      );
    }

    const accountId = generateULID({
      prefix: "acc",
      separator: "_",
      maxLength: 40,
    });

    await pool.execute(
      "INSERT INTO accounts (id, name, user_id, game_type) VALUES (?, ?, ?, ?)",
      [accountId, name, userId, gameType],
    );

    await pool.execute(
      `INSERT INTO audit_logs (id, user_id, account_id, action, entity_type, description)
       VALUES (?, ?, ?, 'CREATE', 'ACCOUNT', ?)`,
      [
        generateULID({ prefix: "log", separator: "_", maxLength: 40 }),
        userId,
        accountId,
        `Account "${name}" (${gameType}) created`,
      ],
    );

    return NextResponse.json({
      ok: true,
      account: { id: accountId, name, game_type: gameType },
    });
  } catch (err) {
    console.error("POST /api/accounts failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to create account" },
      { status: 500 },
    );
  }
}
