"use server";

import type { RowDataPacket } from "mysql2";
import { db, initServer } from "../lib/Database/initializeMainServer";
import { generateULID } from "./generateULID.util";

interface InviteCodeRow extends RowDataPacket {
  code: string;
}

/**
 * Returns the currently valid invite code.
 * - Priority 1: the single row in the `invite_code` table
 * - Priority 2: process.env.SECRET_LOGIN_CODE (fallback)
 * - Returns null if neither exists
 */
export async function getValidInviteCode(): Promise<string | null> {
  try {
    await initServer();
    const pool = db();

    const [rows] = await pool.execute<InviteCodeRow[]>(
      "SELECT code FROM invite_code LIMIT 1",
    );

    if (Array.isArray(rows) && rows.length > 0 && rows[0].code) {
      return rows[0].code;
    }
  } catch (err) {
    console.error(
      "getValidInviteCode: DB read failed, falling back to env",
      err,
    );
  }

  const envCode = process.env.SECRET_LOGIN_CODE;
  return envCode && envCode.length > 0 ? envCode : null;
}

export async function regenerateInviteCode(): Promise<string | null> {
  const newCode = generateULID({
    prefix: "inv",
    separator: "_",
    maxLength: 32,
  });

  try {
    await initServer();
    const pool = db();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();
      await conn.execute("DELETE FROM invite_code");
      await conn.execute("INSERT INTO invite_code (code) VALUES (?)", [
        newCode,
      ]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return newCode;
  } catch (err) {
    console.error("regenerateInviteCode failed:", err);
    return null;
  }
}
