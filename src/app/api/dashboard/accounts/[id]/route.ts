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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const pool = await getPool();
    const [rows] = await pool.execute<AccountRow[]>(
      `SELECT id, name, game_type, created_at
         FROM accounts
        WHERE id = ? AND user_id = ?
        LIMIT 1`,
      [id, userId],
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Account not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, account: rows[0] });
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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

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
      [id, userId],
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
      [name, id, userId],
    );
    if (taken.length > 0) {
      return NextResponse.json(
        { ok: false, error: "You already have another account with this name" },
        { status: 400 },
      );
    }

    await pool.execute("UPDATE accounts SET name = ? WHERE id = ?", [name, id]);

    await pool.execute(
      `INSERT INTO audit_logs (id, user_id, account_id, action, entity_type, description)
       VALUES (?, ?, ?, 'UPDATE', 'ACCOUNT', ?)`,
      [
        generateULID({ prefix: "log", separator: "_", maxLength: 40 }),
        userId,
        id,
        `Account renamed to "${name}"`,
      ],
    );

    return NextResponse.json({ ok: true, account: { id, name } });
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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const pool = await getPool();

    const [rows] = await pool.execute<IdRow[]>(
      "SELECT id FROM accounts WHERE id = ? AND user_id = ? LIMIT 1",
      [id, userId],
    );
    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Account not found" },
        { status: 404 },
      );
    }

    const [nameRows] = await pool.execute<RowDataPacket[]>(
      "SELECT name FROM accounts WHERE id = ? LIMIT 1",
      [id],
    );
    const accountName = String(
      (nameRows[0] as { name?: string } | undefined)?.name ?? "",
    );

    await pool.execute("DELETE FROM accounts WHERE id = ?", [id]);

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
