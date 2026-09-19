-- ==========================================================
-- USERS (simplified for Google OAuth)
-- ==========================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    google_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    image VARCHAR(500) DEFAULT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS invite_code (code VARCHAR(255) NOT NULL PRIMARY KEY);
-- ==========================================================
-- ACCOUNTS  (a user can create many accounts)
-- ==========================================================
CREATE TABLE IF NOT EXISTS accounts (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    user_id VARCHAR(40) NOT NULL,
    game_type ENUM('SOFI', 'KARUTA') NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- ==========================================================
-- BUYERS  (belong to an account)
-- ==========================================================
CREATE TABLE IF NOT EXISTS buyers (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    account_id VARCHAR(40) NOT NULL,
    discord_id VARCHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_buyers_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE KEY uq_buyer_discord_account (discord_id, account_id)
);
-- ==========================================================
-- CARDS  (belong to an account)
-- ==========================================================
CREATE TABLE IF NOT EXISTS cards (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    account_id VARCHAR(40) NOT NULL,
    card_code VARCHAR(255) NOT NULL,
    price_tier INT NOT NULL,
    currency_type ENUM('silver', 'wist', 'gold', 'tickets') NOT NULL DEFAULT 'silver',
    status ENUM('PENDING', 'TRADED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    traded_for TEXT DEFAULT NULL,
    traded_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cards_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE KEY uq_card_code_account (card_code, account_id)
);
-- ==========================================================
-- ORDERS  (belong to an account, reference a buyer + a card)
-- ==========================================================
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    account_id VARCHAR(40) NOT NULL,
    buyer_id VARCHAR(40) NOT NULL,
    card_id VARCHAR(40) NOT NULL,
    queue_position INT NOT NULL,
    status ENUM('WAITING', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'WAITING',
    completed_at DATETIME DEFAULT NULL,
    completed_cards TEXT DEFAULT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_orders_buyer FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE CASCADE,
    CONSTRAINT fk_orders_card FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    UNIQUE KEY uq_order_buyer_card (buyer_id, card_id)
);