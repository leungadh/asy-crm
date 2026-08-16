-- ============================================================================
-- ASY Beaute — 0002: treatments, the follow-up engine, appointments
-- ============================================================================
-- This is the heart of the app. Everything else is CRUD around it.
-- ============================================================================

-- ─── Follow-up rules ────────────────────────────────────────────────────────
-- Intervals live in DATA, not code, so Yoyo can change them without a deploy.
-- Editing a rule affects only FUTURE treatments; existing timelines are frozen.
create table followup_rules (
  id          uuid primary key default gen_random_uuid(),
  service_id  uuid not null references services(id) on delete cascade,
  sequence    int  not null,
  label_zh    text not null,
  label_en    text not null,
  node_type   node_type not null default 'follow_up',
  offset_days int  not null check (offset_days > 0),
  window_days int  not null default 0 check (window_days >= 0),
  is_active   boolean not null default true,
  unique (service_id, sequence)
);

comment on column followup_rules.window_days is
  'For review (回診) nodes: length of the suggested booking window. 0 = single date.';

-- Areola & VIO: 5 nodes. The 6-week one is a REVIEW (回診) with a 7-day window,
-- matching "建議回診時間：25 Sep – 02 Oct" in the mockup.
insert into followup_rules (service_id, sequence, label_zh, label_en, node_type, offset_days, window_days)
select s.id, v.seq, v.zh, v.en, v.ntype::node_type, v.days, v.win
from services s
cross join (values
  (1, '1星期跟進', '1 Week Follow-up',  'follow_up',  7, 0),
  (2, '2星期跟進', '2 Week Follow-up',  'follow_up', 14, 0),
  (3, '1個月跟進', '1 Month Follow-up', 'follow_up', 30, 0),
  (4, '6星期回診', '6 Week Review',     'review',    42, 7),
  (5, '2個月跟進', '2 Month Follow-up', 'follow_up', 60, 0)
) as v(seq, zh, en, ntype, days, win)
where s.code in ('areola', 'vio');

-- Lips: 3 follow-ups, no review.
insert into followup_rules (service_id, sequence, label_zh, label_en, node_type, offset_days, window_days)
select s.id, v.seq, v.zh, v.en, 'follow_up'::node_type, v.days, 0
from services s
cross join (values
  (1, '1星期跟進', '1 Week Follow-up',   7),
  (2, '2星期跟進', '2 Week Follow-up',  14),
  (3, '1個月跟進', '1 Month Follow-up', 30)
) as v(seq, zh, en, days)
where s.code = 'lip';

-- Body treatment: single follow-up at 3 weeks.
insert into followup_rules (service_id, sequence, label_zh, label_en, node_type, offset_days, window_days)
select s.id, 1, '3星期跟進', '3 Week Follow-up', 'follow_up'::node_type, 21, 0
from services s where s.code = 'body';

-- ─── Treatments (療程紀錄) ──────────────────────────────────────────────────
create table treatments (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references customers(id) on delete cascade,
  service_id     uuid not null references services(id) on delete restrict,
  detail         text,                    -- 部位: 雙側乳暈 / V+I+O / 腋下 …
  treatment_date date not null,
  amount         numeric(10,2) not null check (amount >= 0),   -- manual entry, HKD
  payment_method text,                    -- FPS / Cash / PayMe / Bank Transfer / Card
  pigment_used   text,                    -- 使用色料/產品, free text e.g. "Areola Mix 2"
  remark         text,                    -- 當日特別情況
  rating         smallint check (rating between 1 and 5),
  status         treatment_status not null default 'in_progress',
  created_by     uuid references staff(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index treatments_customer_idx on treatments (customer_id, treatment_date desc);
create index treatments_date_idx     on treatments (treatment_date desc);
create index treatments_service_idx  on treatments (service_id);

create trigger trg_treatments_updated
  before update on treatments
  for each row execute function set_updated_at();

comment on column treatments.amount is
  'Typed fresh every time. There is deliberately no price list — discounts are ad-hoc.';

-- ─── Follow-up nodes (跟進節點) ─────────────────────────────────────────────
-- Auto-generated from followup_rules on treatment insert, then freely editable.
-- rule_id is nullable so staff can add ad-hoc nodes (新增跟進節點 button).
create table followup_nodes (
  id              uuid primary key default gen_random_uuid(),
  treatment_id    uuid not null references treatments(id) on delete cascade,
  rule_id         uuid references followup_rules(id) on delete set null,
  sequence        int  not null,
  label_zh        text not null,
  label_en        text not null,
  node_type       node_type not null,
  due_at          timestamptz not null,
  window_end_date date,                   -- review nodes only
  status          node_status not null default 'pending',
  note            text,                   -- 備註 e.g. 需了解結痂與脫落情況
  contacted_at    timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index followup_nodes_treatment_idx on followup_nodes (treatment_id, sequence);
create index followup_nodes_due_idx       on followup_nodes (due_at)
  where status in ('pending', 'contacted');

create trigger trg_followup_nodes_updated
  before update on followup_nodes
  for each row execute function set_updated_at();

-- Generate the timeline when a treatment is logged.
create or replace function generate_followup_nodes()
returns trigger language plpgsql as $$
declare
  v_hour int;
  v_tz   text;
begin
  select (value #>> '{}')::int  into v_hour from app_settings where key = 'followup_reminder_hour';
  select (value #>> '{}')       into v_tz   from app_settings where key = 'timezone';
  v_hour := coalesce(v_hour, 11);
  v_tz   := coalesce(v_tz, 'Asia/Hong_Kong');

  insert into followup_nodes (
    treatment_id, rule_id, sequence, label_zh, label_en,
    node_type, due_at, window_end_date
  )
  select
    new.id, r.id, r.sequence, r.label_zh, r.label_en, r.node_type,
    (((new.treatment_date + r.offset_days)::timestamp
        + make_interval(hours => v_hour)) at time zone v_tz),
    case when r.window_days > 0
         then (new.treatment_date + r.offset_days + r.window_days)
         else null end
  from followup_rules r
  where r.service_id = new.service_id
    and r.is_active;

  return new;
end $$;

create trigger trg_treatment_generate_followups
  after insert on treatments
  for each row execute function generate_followup_nodes();

-- Keep customers.first_visit_date honest.
create or replace function sync_first_visit_date()
returns trigger language plpgsql as $$
begin
  update customers c
     set first_visit_date = least(coalesce(c.first_visit_date, new.treatment_date),
                                  new.treatment_date)
   where c.id = new.customer_id;
  return new;
end $$;

create trigger trg_treatment_sync_first_visit
  after insert on treatments
  for each row execute function sync_first_visit_date();

-- ─── Appointments (日曆) ────────────────────────────────────────────────────
-- Only things that occupy a TIME SLOT live here: treatments and reviews.
-- Follow-ups are NOT appointments — they are WhatsApp check-ins on
-- followup_nodes.due_at. The calendar view unions the two.
create table appointments (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references customers(id) on delete cascade,
  type             appointment_type not null,
  service_id       uuid references services(id) on delete set null,
  followup_node_id uuid references followup_nodes(id) on delete set null,
  starts_at        timestamptz not null,
  duration_minutes int not null default 90 check (duration_minutes > 0),
  notes            text,
  status           appointment_status not null default 'scheduled',
  created_by       uuid references staff(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index appointments_starts_idx   on appointments (starts_at);
create index appointments_customer_idx on appointments (customer_id, starts_at desc);

create trigger trg_appointments_updated
  before update on appointments
  for each row execute function set_updated_at();

-- Booking a review appointment flips its source node to 'booked'.
create or replace function mark_node_booked()
returns trigger language plpgsql as $$
begin
  if new.followup_node_id is not null and new.status = 'scheduled' then
    update followup_nodes
       set status = 'booked'
     where id = new.followup_node_id
       and status not in ('done', 'skipped');
  end if;
  return new;
end $$;

create trigger trg_appointment_mark_node_booked
  after insert or update of status, followup_node_id on appointments
  for each row execute function mark_node_booked();
