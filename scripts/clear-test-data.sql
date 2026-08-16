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

-- ─── SAFETY STOP ──────────────────────────────────────────────────────────
-- Delete this block to run the script. It exists because a row count cannot
-- tell seed data from real data — the seed itself creates ~96 treatments — so
-- any automatic guard would either block the legitimate use or fail to stop
-- the dangerous one. An edit you have to make by hand is the honest version.
do $$
begin
  raise exception
    'Safety stop. Open scripts/clear-test-data.sql, delete the SAFETY STOP block, and re-run. This erases every customer, treatment, booking, ledger entry and stock movement in the database you are currently connected to.';
end $$;
-- ──────────────────────────────────────────────────────────────────────────

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
