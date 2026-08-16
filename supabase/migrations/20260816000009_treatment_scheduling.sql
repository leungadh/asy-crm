-- ============================================================================
-- ASY Beaute — 0009: treatments become bookings too
-- ============================================================================
-- A booking and the record of the visit are now ONE row, moving through
-- statuses:
--
--   scheduled  已預約   booked, not yet performed. No amount, no follow-ups,
--                       no income row.
--   in_progress 跟進中  performed; follow-up timeline generated, income booked
--   completed  已完成   performed and the follow-up course is finished
--
-- The appointments table is now used for 回診 only.
-- ============================================================================

alter table treatments
  add column start_time       time,
  add column duration_minutes int not null default 90 check (duration_minutes > 0);

-- A booking has no price yet. Requiring one would force fake zeroes into the
-- ledger, so amount becomes optional and is required only once performed.
alter table treatments alter column amount drop not null;

alter table treatments
  add constraint treatments_amount_required_once_performed
  check (status = 'scheduled' or amount is not null);

comment on column treatments.start_time is
  'Arrival time. NULL for historical records entered without one.';
comment on column treatments.duration_minutes is
  'Chair time, used to lay the booking out on the calendar.';

-- ─── Follow-ups are generated when the treatment happens, not when booked ──
create or replace function generate_followup_nodes()
returns trigger language plpgsql as $$
declare
  v_hour int;
  v_tz   text;
begin
  -- A booking has no timeline yet.
  if new.status = 'scheduled' then
    return new;
  end if;

  -- Fires on both INSERT and UPDATE, so guard against a second generation.
  if exists (select 1 from followup_nodes where treatment_id = new.id) then
    return new;
  end if;

  select (value #>> '{}')::int into v_hour from app_settings where key = 'followup_reminder_hour';
  select (value #>> '{}')      into v_tz   from app_settings where key = 'timezone';
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

drop trigger if exists trg_treatment_generate_followups on treatments;
create trigger trg_treatment_generate_followups
  after insert or update of status on treatments
  for each row execute function generate_followup_nodes();

-- ─── Income is booked when performed, not when booked ─────────────────────
create or replace function sync_treatment_ledger()
returns trigger language plpgsql as $$
declare
  v_service text;
  v_name    text;
begin
  -- Nothing is owed for a booking. If a performed treatment is put back to
  -- scheduled, its income row must go with it.
  if new.status = 'scheduled' or new.amount is null then
    delete from ledger_entries where treatment_id = new.id;
    return new;
  end if;

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

drop trigger if exists trg_treatment_sync_ledger on treatments;
create trigger trg_treatment_sync_ledger
  after insert or update of treatment_date, amount, payment_method, service_id,
                            detail, customer_id, status
  on treatments
  for each row execute function sync_treatment_ledger();

-- ─── A booking is not a visit ─────────────────────────────────────────────
create or replace function sync_first_visit_date()
returns trigger language plpgsql as $$
begin
  if new.status = 'scheduled' then
    return new;
  end if;

  update customers c
     set first_visit_date = least(coalesce(c.first_visit_date, new.treatment_date),
                                  new.treatment_date)
   where c.id = new.customer_id;
  return new;
end $$;

drop trigger if exists trg_treatment_sync_first_visit on treatments;
create trigger trg_treatment_sync_first_visit
  after insert or update of status, treatment_date on treatments
  for each row execute function sync_first_visit_date();
