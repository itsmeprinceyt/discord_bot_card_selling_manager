import { getPool } from "@/lib/Database/main.db";
import type { RowDataPacket } from "mysql2";

interface NameRow extends RowDataPacket {
  name: string;
}

export async function getAccountName(accountId: string, userId: string) {
  const pool = await getPool();
  const [rows] = await pool.execute<NameRow[]>(
    "SELECT name FROM accounts WHERE id = ? AND user_id = ? LIMIT 1",
    [accountId, userId],
  );
  return rows[0]?.name ?? null;
}
