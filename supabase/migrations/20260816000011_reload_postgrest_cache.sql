-- ============================================================================
-- ASY Beaute — 0011: force PostgREST to reload its schema cache
-- ============================================================================
-- PostgREST keeps an in-memory copy of the schema and serves requests from it.
-- After a migration adds a column it normally reloads via an event trigger,
-- but that can be missed, and the API then rejects the new column with
-- "Could not find the 'x' column ... in the schema cache" even though the
-- column plainly exists.
--
-- NOTIFY is the documented way to ask it to reload. Cheap and idempotent, so
-- it is worth appending to any migration that changes table structure.
-- ============================================================================

notify pgrst, 'reload schema';
