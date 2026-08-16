-- ============================================================================
-- ASY Beaute — 0005: Row Level Security
-- ============================================================================
-- Two users, identical full access: Yoyo and Andy.
--
-- Defence in depth, three layers:
--   1. Supabase Auth: public sign-up DISABLED (do this in the dashboard —
--      Authentication > Providers > Email > "Allow new users to sign up" OFF).
--   2. staff table: the allowlist. A valid JWT is not enough.
--   3. RLS below: every table denies by default, is_staff() is the only door.
--
-- The browser only ever holds the ANON key. The service_role key must never
-- leave the server side, and must never be committed.
-- ============================================================================

-- security definer + pinned search_path: callable by anon, cannot be shadowed.
create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from staff
    where user_id = auth.uid()
      and is_active
  );
$$;

revoke all on function is_staff() from public;
grant execute on function is_staff() to authenticated;

-- ─── Enable RLS + uniform staff-full-access policy on every table ───────────
do $$
declare
  t text;
  tables text[] := array[
    'staff', 'app_settings', 'user_preferences',
    'customers', 'services',
    'followup_rules', 'treatments', 'followup_nodes', 'appointments',
    'products', 'stock_movements', 'customer_purchases', 'ledger_entries'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format($f$
      create policy staff_full_access on %I
        for all
        to authenticated
        using (is_staff())
        with check (is_staff())
    $f$, t);
  end loop;
end $$;

-- ─── Views inherit RLS from their base tables ───────────────────────────────
-- security_invoker means the view runs as the CALLER, so the policies above
-- apply. Without this, a view would silently bypass RLS. Requires PG 15+.
alter view v_followup_board    set (security_invoker = on);
alter view v_customer_summary  set (security_invoker = on);
alter view v_stock_levels      set (security_invoker = on);
alter view v_calendar_events   set (security_invoker = on);
alter view v_monthly_ledger    set (security_invoker = on);
alter view v_service_revenue   set (security_invoker = on);
alter view v_customer_sources  set (security_invoker = on);
alter view v_dashboard_stats   set (security_invoker = on);

grant select on
  v_followup_board, v_customer_summary, v_stock_levels, v_calendar_events,
  v_monthly_ledger, v_service_revenue, v_customer_sources, v_dashboard_stats
to authenticated;

-- ─── Link a magic-link sign-in to its staff row ─────────────────────────────
-- Fires when someone authenticates. If their email is on the allowlist, bind
-- the auth user to it. If it is not, nothing happens — and because every RLS
-- policy requires is_staff(), an unlisted account sees an empty database.
create or replace function link_staff_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update staff
     set user_id = new.id
   where lower(email) = lower(new.email)
     and user_id is distinct from new.id;

  insert into user_preferences (staff_id)
  select id from staff where user_id = new.id
  on conflict (staff_id) do nothing;

  return new;
end $$;

create trigger trg_link_staff_account
  after insert on auth.users
  for each row execute function link_staff_account();

-- ─── The two permitted accounts ─────────────────────────────────────────────
-- user_id stays NULL until each person's first magic-link sign-in.
insert into staff (email, display_name, initials) values
  ('asybeaute@gmail.com', 'Yoyo Leung', 'YL'),
  ('leungadh@gmail.com',  'Andy Leung',  'AL')
on conflict (email) do nothing;
