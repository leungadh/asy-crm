-- ============================================================================
-- ASY Beaute — 0003: inventory, customer purchases, income/expense ledger
-- ============================================================================
-- Confirmed 2026-08-16:
--   * Stock is MANUAL ONLY. Nothing auto-decrements it, ever.
--   * A treatment auto-creates its income row.
--   * A product purchase auto-creates its income row, but does NOT touch stock.
-- ============================================================================

-- ─── Products (保養產品) ────────────────────────────────────────────────────
-- All five SKUs are 保養產品. There is no pigment/product distinction.
create table products (
  id                       uuid primary key default gen_random_uuid(),
  code                     text not null unique,
  name_zh                  text not null,
  category                 text not null default '保養產品',
  unit                     text not null default '件',
  low_stock_threshold      int  not null default 5,
  critical_stock_threshold int  not null default 3,
  note                     text,
  is_active                boolean not null default true,
  sort_order               int  not null default 0
);

insert into products (code, name_zh, note, sort_order) values
  ('AL1', 'AL1', '常備產品', 1),
  ('AL2', 'AL2', NULL,      2),
  ('B2',  'B2',  '熱門色號', 3),
  ('N2',  'N2',  NULL,      4),
  ('P1',  'P1',  NULL,      5);

-- ─── Stock movements ────────────────────────────────────────────────────────
-- Current stock is DERIVED by summing movements (see v_stock_levels), never
-- stored. A stored quantity column would drift the moment two edits race;
-- a movement ledger cannot, and gives free history.
create table stock_movements (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  location    stock_location not null,
  delta       int not null check (delta <> 0),
  reason      movement_reason not null default 'adjustment',
  note        text,
  occurred_on date not null default current_date,
  created_by  uuid references staff(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index stock_movements_product_idx on stock_movements (product_id, location);
create index stock_movements_date_idx    on stock_movements (occurred_on desc);

comment on table stock_movements is
  'Manual entry only. No trigger anywhere writes to this table.';

-- ─── Customer product purchases (保養品購買紀錄) ────────────────────────────
create table customer_purchases (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references customers(id) on delete cascade,
  product_id     uuid not null references products(id) on delete restrict,
  quantity       int not null check (quantity > 0),
  amount         numeric(10,2) not null check (amount >= 0),   -- manual, HKD
  payment_method text,
  ship_from      stock_location not null default 'studio',     -- 出貨位置
  purchase_date  date not null default current_date,
  note           text,
  created_by     uuid references staff(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index customer_purchases_customer_idx on customer_purchases (customer_id, purchase_date desc);

create trigger trg_customer_purchases_updated
  before update on customer_purchases
  for each row execute function set_updated_at();

comment on column customer_purchases.ship_from is
  'Records WHERE it shipped from for reporting. Deliberately does not move stock.';

-- ─── Ledger (收入支出) ──────────────────────────────────────────────────────
-- Single source of truth for money. Auto rows are owned by their source record:
-- edit the treatment, the ledger row follows; delete it, the row goes too.
create table ledger_entries (
  id             uuid primary key default gen_random_uuid(),
  entry_date     date not null,
  direction      ledger_direction not null,
  category       text not null,        -- 療程收入 / 產品銷售 / 營運費用 / 材料成本 …
  item           text not null,
  amount         numeric(10,2) not null check (amount >= 0),
  payment_method text,
  note           text,
  customer_id    uuid references customers(id) on delete set null,
  treatment_id   uuid unique references treatments(id) on delete cascade,
  purchase_id    uuid unique references customer_purchases(id) on delete cascade,
  is_auto        boolean not null default false,
  created_by     uuid references staff(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- NULLs are not equal in Postgres, so `unique` here still allows unlimited
-- manual rows while guaranteeing at most one auto row per source record.
create index ledger_date_idx      on ledger_entries (entry_date desc);
create index ledger_direction_idx on ledger_entries (direction, entry_date desc);
create index ledger_category_idx  on ledger_entries (category);

create trigger trg_ledger_updated
  before update on ledger_entries
  for each row execute function set_updated_at();

-- Treatment → income row.
create or replace function sync_treatment_ledger()
returns trigger language plpgsql as $$
declare
  v_service text;
  v_name    text;
begin
  select name_zh into v_service from services  where id = new.service_id;
  select name    into v_name    from customers where id = new.customer_id;

  insert into ledger_entries (
    entry_date, direction, category, item, amount,
    payment_method, note, customer_id, treatment_id, is_auto, created_by
  )
  values (
    new.treatment_date, 'income', '療程收入',
    v_service || coalesce(' · ' || new.detail, ''),
    new.amount, new.payment_method, v_name,
    new.customer_id, new.id, true, new.created_by
  )
  on conflict (treatment_id) do update set
    entry_date     = excluded.entry_date,
    item           = excluded.item,
    amount         = excluded.amount,
    payment_method = excluded.payment_method,
    note           = excluded.note,
    customer_id    = excluded.customer_id,
    updated_at     = now();

  return new;
end $$;

create trigger trg_treatment_sync_ledger
  after insert or update of treatment_date, amount, payment_method, service_id, detail, customer_id
  on treatments
  for each row execute function sync_treatment_ledger();

-- Product purchase → income row. Stock untouched by design.
create or replace function sync_purchase_ledger()
returns trigger language plpgsql as $$
declare
  v_code text;
  v_name text;
begin
  select code into v_code from products  where id = new.product_id;
  select name into v_name from customers where id = new.customer_id;

  insert into ledger_entries (
    entry_date, direction, category, item, amount,
    payment_method, note, customer_id, purchase_id, is_auto, created_by
  )
  values (
    new.purchase_date, 'income', '產品銷售',
    v_code || ' × ' || new.quantity,
    new.amount, new.payment_method, v_name,
    new.customer_id, new.id, true, new.created_by
  )
  on conflict (purchase_id) do update set
    entry_date     = excluded.entry_date,
    item           = excluded.item,
    amount         = excluded.amount,
    payment_method = excluded.payment_method,
    note           = excluded.note,
    customer_id    = excluded.customer_id,
    updated_at     = now();

  return new;
end $$;

create trigger trg_purchase_sync_ledger
  after insert or update of purchase_date, amount, payment_method, product_id, quantity, customer_id
  on customer_purchases
  for each row execute function sync_purchase_ledger();

-- NOTE: auto rows (is_auto = true) are intentionally NOT protected by a trigger.
-- A BEFORE UPDATE guard would fire on the sync functions' own ON CONFLICT DO
-- UPDATE and deadlock the design. Enforcement belongs in the UI: render auto
-- rows read-only and send the user to the source treatment/purchase instead.
