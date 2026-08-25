-- ============================================================================
-- ASY Beaute — clear test data, keep the schema and reference data
-- ============================================================================
-- Run this ONCE, immediately before Yoyo starts entering real clients.
--
--   supabase db push          -- make sure the schema is current first
--   psql "<connection string>" -f scripts/clear-test-data.sql
--
-- or paste it into the Supabase SQL Editor.
--
-- This is NOT a migration. It lives in scripts/ deliberately so it can never
-- run automatically as part of a deploy.
--
-- REMOVES: customers, treatments, follow-up nodes, appointments, purchases,
--          ledger entries, stock movements
-- KEEPS:   services, followup_rules, products, ledger_categories, staff,
--          app_settings, user_preferences
--
-- Deleting customers cascades to treatments, which cascades to follow-up nodes
-- and their ledger rows. The explicit deletes below cover the tables that do
-- not hang off a customer.
-- ============================================================================

begin;

-- ═══════════════════════════════════════════════════════════════════════════
--  TO RUN THIS SCRIPT: delete the two dashes at the start of the next line.
--  That is the only edit needed. Nothing else in this file should be changed.

-- set local asy.confirm_clear = 'yes';

-- ═══════════════════════════════════════════════════════════════════════════
--
--  Why a manual edit rather than an automatic guard: a row count cannot tell
--  seed data from real data, so any threshold would either block the
--  legitimate use or fail to stop the dangerous one.
--
--  The previous version asked you to delete a whole block, which turned out to
--  be ambiguous once the descriptive comment above it was gone — leaving the
--  executable part behind, still armed. One line, clearly marked, cannot be
--  half-done.

do $$
begin
  if coalesce(current_setting('asy.confirm_clear', true), '') <> 'yes' then
    raise exception
      'Not confirmed. Open scripts/clear-test-data.sql and uncomment the single line marked "TO RUN THIS SCRIPT", then run it again. This erases every customer, treatment, booking, ledger entry and stock movement in the database you are currently connected to.';
  end if;
end $$;

delete from stock_movements;
delete from ledger_entries;      -- manual expenses too; auto rows cascade anyway
delete from customer_purchases;
delete from appointments;
delete from followup_nodes;
delete from treatments;
delete from customers;

-- Stock starts at zero everywhere; Yoyo does a real count on day one.
-- Products, services, follow-up rules and ledger categories are configuration,
-- not test data, so they stay.

commit;

-- What should remain:
select 'customers'          as table_name, count(*) from customers
union all select 'treatments',        count(*) from treatments
union all select 'followup_nodes',    count(*) from followup_nodes
union all select 'ledger_entries',    count(*) from ledger_entries
union all select 'stock_movements',   count(*) from stock_movements
union all select '--- kept ---',      null
union all select 'services',          count(*) from services
union all select 'followup_rules',    count(*) from followup_rules
union all select 'products',          count(*) from products
union all select 'ledger_categories', count(*) from ledger_categories
union all select 'staff',             count(*) from staff
order by 1;
