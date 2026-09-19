import { randomUUID } from "crypto";
import type { ResultSetHeader } from "mysql2/promise";
import {
  DbExecutor,
  LogAuditInput,
  LogAuditOptions,
} from "../types/AuditLog/auditLog.type";

export class AuditLogService {
  async log(
    db: DbExecutor,
    input: LogAuditInput,
    opts: LogAuditOptions = {},
  ): Promise<string | null> {
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
}

export const auditLog = new AuditLogService();
