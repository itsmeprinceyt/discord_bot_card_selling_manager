CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    user_id VARCHAR(40) DEFAULT NULL,
    account_id VARCHAR(40) DEFAULT NULL,
    action ENUM(
        'CREATE',
        'UPDATE',
        'DELETE',
        'LOGIN',
        'LOGOUT',
        'INVITE_USED',
        'CARD_TRADED',
        'CARD_CANCELLED',
        'ORDER_CREATED',
        'ORDER_COMPLETED',
        'ORDER_CANCELLED',
        'ROLE_CHANGED'
    ) NOT NULL,
    entity_type ENUM(
        'USER',
        'ACCOUNT',
        'BUYER',
        'CARD',
        'ORDER',
        'INVITE_CODE',
        'ACTIVITY_LOG',
        'SYSTEM'
    ) NOT NULL,
    description TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE
    SET NULL,
        CONSTRAINT fk_audit_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE
    SET NULL
);