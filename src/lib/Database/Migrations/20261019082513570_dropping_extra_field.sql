-- ============================================================================
-- Drop orders.completed_cards
--
-- This column duplicates cards.traded_for. Every flow that wrote it also
-- wrote the same value to cards.traded_for, so it can be safely removed and
-- the Completed page can JOIN `cards` to display traded_for in its place.
-- ============================================================================
ALTER TABLE orders DROP COLUMN completed_cards;