import type { Pool, PoolConnection } from "mysql2/promise";

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

export interface LogAuditInput {
  userId?: string | null;
  accountId?: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  description: string;
  id?: string;
  createdAt?: Date;
}

export interface LogAuditOptions {
  throwOnError?: boolean;
}

export type DbExecutor = Pool | PoolConnection;
