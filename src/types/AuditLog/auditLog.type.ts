// logAudit.types.ts
import type { Pool, PoolConnection } from "mysql2/promise";

/* ------------------------------------------------------------------ */
/*  Enums (mirror the SQL ENUMs)                                       */
/* ------------------------------------------------------------------ */

export const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "INVITE_USED",
  "CARD_TRADED",
  "CARD_CANCELLED",
  "ORDER_CREATED",
  "ORDER_COMPLETED",
  "ORDER_CANCELLED",
  "ROLE_CHANGED",
] as const;

export const AUDIT_ENTITY_TYPES = [
  "USER",
  "ACCOUNT",
  "BUYER",
  "CARD",
  "ORDER",
  "INVITE_CODE",
  "ACTIVITY_LOG",
  "SYSTEM",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/* ------------------------------------------------------------------ */
/*  Inputs / Options                                                   */
/* ------------------------------------------------------------------ */

export interface LogAuditInput {
  /** Actor — nullable for system / anonymous actions */
  userId?: string | null;
  /** Scope — nullable for global actions */
  accountId?: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  description: string;
  /** Optional: override the ID generator */
  id?: string;
  /** Optional: override created_at (defaults to DB CURRENT_TIMESTAMP) */
  createdAt?: Date;
}

export interface LogAuditOptions {
  /** If true, rethrow DB errors instead of swallowing them. */
  throwOnError?: boolean;
}

/** Anything that can execute a query — a Pool or a PoolConnection. */
export type DbExecutor = Pool | PoolConnection;
