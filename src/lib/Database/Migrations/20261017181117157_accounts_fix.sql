-- ============================================================================
-- Migration: accounts.name uniqueness → scoped per user
-- ----------------------------------------------------------------------------
-- Problem:
--   accounts.name had a global UNIQUE index, so user B couldn't create an
--   account with a name user A already used. Uniqueness should be per-user.
--
-- Fix:
--   Drop the single-column UNIQUE on `name`, add UNIQUE(user_id, name).
--
-- Notes:
--   - Single ALTER = atomic. Either both changes apply or neither does.
--   - Your existing global UNIQUE(name) already guarantees no (user_id, name)
--     duplicates can exist, so the new composite unique cannot fail on data.
--   - Do NOT use DELIMITER / CREATE PROCEDURE here — the Node migration
--     runner can't execute them (DELIMITER is a mysql-CLI-only directive,
--     and DECLARE is only valid inside a procedure body).
-- ============================================================================
ALTER TABLE accounts DROP INDEX `name`,
    ADD UNIQUE KEY uq_accounts_user_name (user_id, name);