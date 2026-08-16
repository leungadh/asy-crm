-- ============================================================================
-- ASY Beaute — 0001: extensions, enums, staff, customers, services
-- ============================================================================
-- Currency: HKD. Timezone: Asia/Hong_Kong. Week starts Monday.
-- All money columns are numeric(10,2) — never float.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ─── Status vocabularies ────────────────────────────────────────────────────
-- Three SEPARATE vocabularies. The mockups mix them visually; they are not
-- interchangeable and must not be merged.

-- 1. Customer lifecycle. Set manually by staff (per Andy, 2026-08-16).
--    Display: active_followup=跟進中  pending_review=待回診
--             dormant=沉睡客          completed=已完成
create type customer_status as enum (
  'active_followup',
  'pending_review',
  'dormant',
  'completed'
);

-- 2. Treatment record state.  in_progress=跟進中  completed=已完成
create type treatment_status as enum ('in_progress', 'completed');

-- 3. Follow-up node state. Stored value is the ACTION taken, not the due-ness.
--    "Due", "overdue" and "not due" are DERIVED from due_at in v_followup_board,
--    so they can never go stale.
--    pending=未處理  contacted=已發訊息  replied=已回覆
--    booked=已預約   done=已完成        skipped=略過
create type node_status as enum (
  'pending',
  'contacted',
  'replied',
  'booked',
  'done',
  'skipped'
);

-- A follow-up is a WhatsApp check-in with NO visit.
-- A review (回診) is a real appointment booked inside a suggested date window.
create type node_type as enum ('follow_up', 'review');

create type appointment_type   as enum ('treatment', 'review');
create type appointment_status as enum ('scheduled', 'completed', 'cancelled', 'no_show');
create type ledger_direction   as enum ('income', 'expense');
create type stock_location     as enum ('studio', 'home');
create type movement_reason    as enum ('stock_take', 'purchase_in', 'sale_out', 'adjustment');

-- ─── Shared updated_at trigger ──────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─── Staff (allowlist) ──────────────────────────────────────────────────────
-- Public sign-up MUST be disabled in Supabase Auth settings. This table is the
-- second line of defence: RLS checks membership here, not just "authenticated".
create table staff (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid unique references auth.users(id) on delete cascade,
  email        text not null unique,
  display_name text not null,
  initials     text not null default '',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

comment on table staff is
  'Allowlist of people permitted to use the app. Linked to auth.users on first magic-link sign-in.';

-- ─── App settings ───────────────────────────────────────────────────────────
create table app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into app_settings (key, value) values
  ('currency',              '"HKD"'),
  ('timezone',              '"Asia/Hong_Kong"'),
  ('dormant_after_days',    '90'),
  ('new_customer_days',     '30'),
  ('followup_reminder_hour','11'),
  ('overdue_grace_days',    '2');

-- ─── Per-user UI preferences (設定 page) ────────────────────────────────────
create table user_preferences (
  staff_id      uuid primary key references staff(id) on delete cascade,
  locale        text not null default 'zh-HK' check (locale in ('zh-HK','en')),
  theme         text not null default 'rose'  check (theme  in ('blue','rose','sage')),
  density       text not null default 'comfortable'
                  check (density in ('compact','comfortable','spacious')),
  corner_radius text not null default 'medium'
                  check (corner_radius in ('sharp','medium','round')),
  font_scale    numeric(3,2) not null default 1.00 check (font_scale between 0.80 and 1.40),
  updated_at    timestamptz not null default now()
);

create trigger trg_user_preferences_updated
  before update on user_preferences
  for each row execute function set_updated_at();

-- ─── Customers ──────────────────────────────────────────────────────────────
create table customers (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  phone            text,
  source           text,                       -- Instagram / 朋友介紹 / 舊客介紹 / 其他
  instagram        text,
  birthday         date,
  occupation       text,
  first_visit_date date,
  tags             text[] not null default '{}',   -- free-form: VIP, 舊客, 敏感肌, 怕痛…
  remark           text,                       -- 背景/Remark, internal only
  status           customer_status not null default 'active_followup',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index customers_name_idx   on customers (name);
create index customers_phone_idx  on customers (phone);
create index customers_status_idx on customers (status);
create index customers_tags_idx   on customers using gin (tags);

create trigger trg_customers_updated
  before update on customers
  for each row execute function set_updated_at();

comment on column customers.status is
  'Set manually by staff. 沉睡客 vs 已完成 is a judgement call, not a date calculation.';
comment on column customers.tags is
  'Free-form. VIP is a tag, not a column — do not promote it.';

-- ─── Service catalog ────────────────────────────────────────────────────────
-- NO price column: pricing is entered manually per treatment because Yoyo
-- gives ad-hoc discounts (confirmed 2026-08-16).
create table services (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name_zh    text not null,
  name_en    text not null,
  accent     text not null default 'rose',   -- badge colour in the UI
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

insert into services (code, name_zh, name_en, accent, sort_order) values
  ('areola', 'Areola',   'Areola',         'rose',   1),
  ('vio',    'VIO',      'VIO',            'violet', 2),
  ('lip',    '嘴唇',      'Lips',           'pink',   3),
  ('body',   '身體部位',  'Body Treatment', 'amber',  4);
