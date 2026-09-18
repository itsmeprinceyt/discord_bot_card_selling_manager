import { NextResponse } from "next/server";
import { db, initServer } from "../../../../lib/Database/initializeMainServer";
import type { RowDataPacket } from "mysql2";
import requireAdmin from "../../../../utils/Perms/requireAdmin.backend.util";

interface InviteCodeRow extends RowDataPacket {
  code: string;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  try {
    await initServer();
    const pool = db();

    const [rows] = await pool.execute<InviteCodeRow[]>(
      "SELECT code FROM invite_code LIMIT 1",
    );

    const code = Array.isArray(rows) && rows.length > 0 ? rows[0].code : "";

    return NextResponse.json({ ok: true, code });
  } catch (err) {
    console.error("GET invite_code failed:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const raw = typeof body?.code === "string" ? body.code.trim() : "";

  if (!raw || raw.length > 255) {
    return NextResponse.json(
      { ok: false, error: "Code must be 1–255 characters" },
      { status: 400 },
    );
  }

  try {
    await initServer();
    const pool = db();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();
      await conn.execute("DELETE FROM invite_code");
      await conn.execute("INSERT INTO invite_code (code) VALUES (?)", [raw]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return NextResponse.json({ ok: true, code: raw });
  } catch (err) {
    console.error("PUT invite_code failed:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
