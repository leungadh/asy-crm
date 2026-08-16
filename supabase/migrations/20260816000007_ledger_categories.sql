-- ============================================================================
-- ASY Beaute — 0007: ledger categories
-- ============================================================================
-- Categories were free text, which is fine until you chart them: "租金" and
-- "租金 " become two slices of the same donut. This makes them a fixed list
-- that is still editable from 設定, so adding one never needs a deploy.
-- ============================================================================

create table ledger_categories (
  id         uuid primary key default gen_random_uuid(),
  direction  ledger_direction not null,
  name_zh    text not null,
  name_en    text not null,
  sort_order int  not null default 0,
  -- System categories are written by the treatment/purchase triggers. Renaming
  -- or removing one would orphan every auto row, so the UI must not allow it.
  is_system  boolean not null default false,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (direction, name_zh)
);

comment on column ledger_categories.is_system is
  'Referenced by sync_treatment_ledger / sync_purchase_ledger. Not user-deletable.';

insert into ledger_categories (direction, name_zh, name_en, sort_order, is_system) values
  ('income',  '療程收入', 'Treatment income', 1, true),
  ('income',  '產品銷售', 'Product sales',    2, true),
  ('income',  '其他收入', 'Other income',     3, false),
  ('expense', '營運費用', 'Operating costs',  1, false),
  ('expense', '材料成本', 'Materials',        2, false),
  ('expense', '租金',     'Rent',             3, false),
  ('expense', '其他支出', 'Other expenses',   4, false);

alter table ledger_categories enable row level security;
alter table ledger_categories force row level security;

create policy staff_full_access on ledger_categories
  for all to authenticated
  using (is_staff()) with check (is_staff());

grant select, insert, update, delete on ledger_categories to authenticated;
