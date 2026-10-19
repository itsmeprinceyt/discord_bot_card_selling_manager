export const createIndexStatements: string[] = [
  // ── cards ───────────────────────────────────────────────────────────────
  "CREATE INDEX idx_cards_account_status ON cards (account_id, status)",
  "CREATE INDEX idx_cards_account_status_traded_at ON cards (account_id, status, traded_at)",

  // ── orders ──────────────────────────────────────────────────────────────
  "CREATE INDEX idx_orders_account_status_queue ON orders (account_id, status, queue_position)",
  "CREATE INDEX idx_orders_account_status_deleted ON orders (account_id, status, deleted)",
  "CREATE INDEX idx_orders_card_status_queue ON orders (card_id, status, queue_position)",
  "CREATE INDEX idx_orders_account_completed_at ON orders (account_id, completed_at)",
  "CREATE INDEX idx_orders_account_created_at ON orders (account_id, created_at)",

  // ── audit_logs ──────────────────────────────────────────────────────────
  "CREATE INDEX idx_audit_logs_account_created_at ON audit_logs (account_id, created_at)",
  "CREATE INDEX idx_audit_logs_user_created_at ON audit_logs (user_id, created_at)",
];

export const dropIndexStatements: string[] = [
  // ── cards ───────────────────────────────────────────────────────────────
  "DROP INDEX idx_cards_account_status ON cards",
  "DROP INDEX idx_cards_account_status_traded_at ON cards",

  // ── orders ──────────────────────────────────────────────────────────────
  "DROP INDEX idx_orders_account_status_queue ON orders",
  "DROP INDEX idx_orders_account_status_deleted ON orders",
  "DROP INDEX idx_orders_card_status_queue ON orders",
  "DROP INDEX idx_orders_account_completed_at ON orders",
  "DROP INDEX idx_orders_account_created_at ON orders",

  // ── audit_logs ──────────────────────────────────────────────────────────
  "DROP INDEX idx_audit_logs_account_created_at ON audit_logs",
  "DROP INDEX idx_audit_logs_user_created_at ON audit_logs",
];
