import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { getPool } from "../../../../../lib/Database/main.db";
import { generateULID } from "../../../../../utils/generateULID.util";

interface AccountRow extends RowDataPacket {
  id: string;
  name: string;
  game_type: "SOFI" | "KARUTA";
  created_at: string;
}

interface IdRow extends RowDataPacket {
  id: string;
}

/* --------------------------------- GET --------------------------------- */
export async function GET(
  _req: Request,
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

    // 1. Fetch Account Details
    const [rows] = await pool.execute<AccountRow[]>(
      `SELECT id, name, game_type, created_at
         FROM accounts
        WHERE id = ? AND user_id = ?
        LIMIT 1`,
      [accountId, userId],
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Account not found" },
        { status: 404 },
      );
    }

    const account = rows[0];

    // 2. Fetch Stats
    const [activeBuyersRes] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT buyer_id) as count 
       FROM orders 
       WHERE account_id = ? AND status = 'WAITING'`,
      [accountId],
    );

    const [totalCardsRes] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM cards WHERE account_id = ?",
      [accountId],
    );

    const [todayRes] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count 
       FROM orders 
       WHERE account_id = ? 
         AND status = 'COMPLETED' 
         AND DATE(completed_at) = CURDATE()`,
      [accountId],
    );

    const [last30Res] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count 
       FROM orders 
       WHERE account_id = ? 
         AND status = 'COMPLETED' 
         AND completed_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
      [accountId],
    );

    // 3. Return combined response
    return NextResponse.json({
      ok: true,
      account,
      stats: {
        activeBuyers: activeBuyersRes[0].count,
        totalCards: totalCardsRes[0].count,
        completedToday: todayRes[0].count,
        completedLast30Days: last30Res[0].count,
      },
    });
  } catch (err) {
    console.error("GET /api/accounts/[id] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch account" },
      { status: 500 },
    );
  }
}

/* --------------------------------- PUT --------------------------------- */
export async function PUT(
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
    const name = String(body?.name ?? "").trim();

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

    const pool = await getPool();

    // Ownership check
    const [owned] = await pool.execute<IdRow[]>(
      "SELECT id FROM accounts WHERE id = ? AND user_id = ? LIMIT 1",
      [accountId, userId],
    );
    if (owned.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Account not found" },
        { status: 404 },
      );
    }

    // Name uniqueness — scoped to this user, excluding self.
    const [taken] = await pool.execute<IdRow[]>(
      "SELECT id FROM accounts WHERE name = ? AND id <> ? AND user_id = ? LIMIT 1",
      [name, accountId, userId],
    );
    if (taken.length > 0) {
      return NextResponse.json(
        { ok: false, error: "You already have another account with this name" },
        { status: 400 },
      );
    }

    await pool.execute("UPDATE accounts SET name = ? WHERE id = ?", [
      name,
      accountId,
    ]);

    await pool.execute(
      `INSERT INTO audit_logs (id, user_id, account_id, action, entity_type, description)
       VALUES (?, ?, ?, 'UPDATE', 'ACCOUNT', ?)`,
      [
        generateULID({ prefix: "log", separator: "_", maxLength: 40 }),
        userId,
        accountId,
        `Account renamed to "${name}"`,
      ],
    );

    return NextResponse.json({ ok: true, account: { id: accountId, name } });
  } catch (err) {
    console.error("PUT /api/accounts/[id] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to rename account" },
      { status: 500 },
    );
  }
}

/* -------------------------------- DELETE ------------------------------- */
export async function DELETE(
  _req: Request,
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

    // Ownership check
    const [rows] = await pool.execute<IdRow[]>(
      "SELECT id FROM accounts WHERE id = ? AND user_id = ? LIMIT 1",
      [accountId, userId],
    );
    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Account not found" },
        { status: 404 },
      );
    }

    // Get account name for audit log
    const [nameRows] = await pool.execute<RowDataPacket[]>(
      "SELECT name FROM accounts WHERE id = ? LIMIT 1",
      [accountId],
    );
    const accountName = String(
      (nameRows[0] as { name?: string } | undefined)?.name ?? "",
    );

    await pool.execute("DELETE FROM accounts WHERE id = ?", [accountId]);

    await pool.execute(
      `INSERT INTO audit_logs (id, user_id, account_id, action, entity_type, description)
       VALUES (?, ?, NULL, 'DELETE', 'ACCOUNT', ?)`,
      [
        generateULID({ prefix: "log", separator: "_", maxLength: 40 }),
        userId,
        `Account "${accountName}" deleted`,
      ],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/accounts/[id] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to delete account" },
      { status: 500 },
    );
  }
}
