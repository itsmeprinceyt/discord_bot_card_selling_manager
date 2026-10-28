import { randomUUID } from "crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  DbExecutor,
  LogAuditInput,
  LogAuditOptions,
} from "../types/AuditLog/auditLog.types";

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 50;

export class AuditLogService {
  async log(
    db: DbExecutor,
    input: LogAuditInput,
    opts: LogAuditOptions = {},
  ): Promise<string | null> {
    // One-shot retention: only fires when the oldest row has crossed 6 months.
    // Deletes exactly 50 rows per invocation. Goes quiet once nothing is stale.
    try {
      await this.pruneOnce(db);
    } catch (err) {
      console.error(
        "[Global Cleanup] Audit log older than 6 month failed to deleted:",
        err,
      );
      // Never let cleanup block the actual log write.
    }

    const {
      userId = null,
      accountId = null,
      action,
      entityType,
      description,
      id = randomUUID(),
      createdAt,
    } = input;

    const useExplicitTimestamp = createdAt instanceof Date;

    const sql = useExplicitTimestamp
      ? `INSERT INTO audit_logs
           (id, user_id, account_id, action, entity_type, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      : `INSERT INTO audit_logs
           (id, user_id, account_id, action, entity_type, description)
         VALUES (?, ?, ?, ?, ?, ?)`;

    const params = useExplicitTimestamp
      ? [id, userId, accountId, action, entityType, description, createdAt]
      : [id, userId, accountId, action, entityType, description];

    try {
      const [result] = await db.execute<ResultSetHeader>(sql, params);
      return result.affectedRows > 0 ? id : null;
    } catch (err) {
      console.error("[AuditLogService.log] failed to write audit log:", err, {
        action,
        entityType,
        userId,
        accountId,
      });
      if (opts.throwOnError) throw err;
      return null;
    }
  }

  /**
   * Checks if the oldest audit log is older than 6 months.
   * If yes, deletes the 50 oldest rows — once per invocation.
   * If the batch of 50 is still all older than 6 months, the next call
   * will prune another 50. Once nothing stale remains, this becomes a
   * single indexed SELECT and exits.
   */
  private async pruneOnce(db: DbExecutor): Promise<void> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT created_at
         FROM audit_logs
        ORDER BY created_at ASC
        LIMIT 1`,
    );

    if (rows.length === 0) return;

    const oldest = rows[0].created_at as Date;
    if (oldest.getTime() > Date.now() - SIX_MONTHS_MS) return;

    await db.execute<ResultSetHeader>(
      `DELETE FROM audit_logs
        ORDER BY created_at ASC
        LIMIT ${CLEANUP_BATCH_SIZE}`,
    );
  }
}

export const auditLog = new AuditLogService();
