-- ============================================================================
-- ASY Beaute — 0008: add 'scheduled' to treatment_status
-- ============================================================================
-- Deliberately alone in its own migration. PostgreSQL will not let a newly
-- added enum value be USED in the same transaction that added it, and 0009
-- uses it in constraints, triggers and views.
-- ============================================================================

alter type treatment_status add value if not exists 'scheduled' before 'in_progress';
