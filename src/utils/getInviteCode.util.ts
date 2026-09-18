import type { RowDataPacket } from "mysql2";
import { db, initServer } from "../lib/Database/initializeMainServer";
import { generateULID } from "./generateULID.util";

interface InviteCodeRow extends RowDataPacket {
  code: string;
}

/**
 * Represents the source from which an invite code was matched.
 *
 * - `"secret"` — matched `process.env.SECRET_LOGIN_CODE` (admin path)
 * - `"db"`     — matched the single row in the `invite_code` table (normal path)
 * - `null`     — matched nothing; the code is invalid
 */
export type InviteCodeMatch = "secret" | "db" | null;

/**
 * Validates an invite code against the two possible sources, in priority order.
 *
 * ### Sources (checked in this exact order)
 *
 * 1. **`process.env.SECRET_LOGIN_CODE`** → returns `"secret"`
 *    - Reserved for the admin/master code.
 *    - When matched, the caller should treat the signup as an admin signup.
 *    - This value cannot be regenerated at runtime.
 *
 * 2. **The single row in the `invite_code` table** → returns `"db"`
 *    - The normal invite code that admins rotate from the admin panel.
 *    - When matched, the caller should regenerate it after signup.
 *
 * 3. **Neither** → returns `null`.
 *
 * The env code is checked **first** so it always wins — even if an admin
 * accidentally sets the same string in the DB.
 *
 * @param input - The raw code string to validate (already trimmed by the caller).
 * @returns
 *   - `"secret"` if `input` matches `process.env.SECRET_LOGIN_CODE`
 *   - `"db"`     if `input` matches the current row in `invite_code`
 *   - `null`     if it matches neither
 *
 * @example
 * ```ts
 * const match = await matchInviteCode("my-code");
 * if (match === "secret") { // admin signup }
 * else if (match === "db") { // normal signup }
 * else { // reject }
 * ```
 */
export async function matchInviteCode(input: string): Promise<InviteCodeMatch> {
  // ---- Priority 1: env secret ----
  const secret = process.env.SECRET_LOGIN_CODE;
  if (secret && secret.length > 0 && input === secret) {
    return "secret";
  }

  // ---- Priority 2: DB invite_code ----
  try {
    await initServer();
    const pool = db();

    const [rows] = await pool.execute<InviteCodeRow[]>(
      "SELECT code FROM invite_code LIMIT 1",
    );

    if (
      Array.isArray(rows) &&
      rows.length > 0 &&
      rows[0].code &&
      input === rows[0].code
    ) {
      return "db";
    }
  } catch (err) {
    console.error("matchInviteCode: DB read failed", err);
  }

  return null;
}

/**
 * Replaces the current invite code in the database with a freshly generated one.
 *
 * ### Behaviour
 *
 * - Generates a new code with the format `inv_<ULID>` (max 32 chars).
 * - Wipes the entire `invite_code` table and inserts exactly one new row,
 *   inside a transaction — so the table is never left empty or with two rows.
 * - Intended to be called **after** a successful DB-code signup so the code
 *   becomes single-use.
 *
 * ### Failure modes
 *
 * - If the DB transaction fails, it rolls back and returns `null`.
 * - The caller should log a warning but **not** fail the surrounding operation —
 *   the signup itself has already succeeded at this point.
 *
 * @returns The newly generated code on success, or `null` on failure.
 *
 * @example
 * ```ts
 * const newCode = await regenerateInviteCode();
 * if (newCode) console.log("New invite code:", newCode);
 * ```
 */
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
