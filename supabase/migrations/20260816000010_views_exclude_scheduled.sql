-- ============================================================================
-- ASY Beaute — 0010: keep bookings out of the numbers, put them on the calendar
-- ============================================================================
-- A booking is a promise, not revenue and not a visit. Every aggregate must
-- exclude status = 'scheduled', or next month's bookings inflate this month's
-- lifetime value and repeat rate.
-- ============================================================================

create or replace view v_customer_summary as
select
  c.*,
  agg.visit_count,
  agg.last_visit_date,
  agg.treatment_total,
  purch.purchase_total,
  coalesce(agg.treatment_total, 0) + coalesce(purch.purchase_total, 0) as lifetime_value,
  agg.avg_rating,
  agg.last_service_zh,
  agg.last_detail,
  (current_date - agg.last_visit_date) as days_since_last_visit,
  (c.first_visit_date >= current_date - coalesce(
     (select (value #>> '{}')::int from app_settings where key = 'new_customer_days'), 30
   )) as is_new,
  (agg.last_visit_date < current_date - coalesce(
     (select (value #>> '{}')::int from app_settings where key = 'dormant_after_days'), 90
   )) as is_lapsed,
  nxt.due_at         as next_followup_at,
  nxt.label_zh       as next_followup_label,
  nxt.display_status as next_followup_status,
  book.next_booking_at                                    -- appended in 0010
from customers c
left join lateral (
  select
    count(*)                     as visit_count,
    max(t.treatment_date)        as last_visit_date,
    sum(t.amount)                as treatment_total,
    round(avg(t.rating), 1)      as avg_rating,
    (array_agg(s.name_zh order by t.treatment_date desc))[1] as last_service_zh,
    (array_agg(t.detail  order by t.treatment_date desc))[1] as last_detail
  from treatments t
  join services s on s.id = t.service_id
  where t.customer_id = c.id
    and t.status <> 'scheduled'
) agg on true
left join lateral (
  select sum(p.amount) as purchase_total
  from customer_purchases p where p.customer_id = c.id
) purch on true
left join lateral (
  select b.due_at, b.label_zh, b.display_status
  from v_followup_board b
  where b.customer_id = c.id
    and b.display_status not in ('done', 'skipped')
  order by b.due_at
  limit 1
) nxt on true
left join lateral (
  select (t.treatment_date + coalesce(t.start_time, time '00:00')) as next_booking_at
  from treatments t
  where t.customer_id = c.id
    and t.status = 'scheduled'
    and t.treatment_date >= current_date
  order by t.treatment_date, t.start_time nulls last
  limit 1
) book on true;

create or replace view v_service_revenue as
select
  s.id   as service_id,
  s.code,
  s.name_zh,
  s.accent,
  count(t.id)                   as treatment_count,
  coalesce(sum(t.amount), 0)    as revenue,
  round(avg(t.amount), 0)       as avg_ticket
from services s
left join treatments t
  on t.service_id = s.id
 and t.status <> 'scheduled'
group by s.id
order by revenue desc;

create or replace view v_dashboard_stats as
select
  (select count(*) from customers)                                       as total_customers,
  (select count(*) from customers where status = 'active_followup')      as active_followup,
  (select count(*) from customers where status = 'pending_review')       as pending_review,
  (select count(*) from customers where status = 'dormant')              as dormant,
  (select count(*) from v_customer_summary where is_new)                 as new_customers,
  (select count(*) from treatments
     where treatment_date >= date_trunc('month', current_date)
       and status <> 'scheduled')                                        as treatments_this_month,
  (select coalesce(sum(amount), 0) from ledger_entries
     where direction = 'income'
       and entry_date >= date_trunc('month', current_date))              as income_this_month,
  (select coalesce(sum(amount), 0) from ledger_entries
     where direction = 'expense'
       and entry_date >= date_trunc('month', current_date))              as expense_this_month,
  (select count(*) from v_followup_board where display_status = 'overdue') as overdue_followups,
  (select count(*) from v_followup_board where display_status = 'due')     as due_followups,
  (select count(*) from v_stock_levels where stock_status <> 'ok')         as products_needing_restock,
  (select count(*) from treatments
     where status = 'scheduled' and treatment_date >= current_date)        as upcoming_bookings;

-- ─── Calendar gains treatments, with arrival time and chair time ──────────
create or replace view v_calendar_events as
  select
    a.id,
    'appointment'::text as source,
    a.type::text        as event_type,
    a.starts_at         as event_at,
    a.duration_minutes,
    a.customer_id,
    c.name              as customer_name,
    c.phone             as customer_phone,
    s.name_zh           as service_name,
    a.notes             as label,
    a.status::text      as event_status
  from appointments a
  join customers c on c.id = a.customer_id
  left join services s on s.id = a.service_id
  where a.status <> 'cancelled'
    and a.type = 'review'        -- treatments now live on the treatments table

union all

  select
    t.id,
    'treatment'::text,
    'treatment'::text,
    (((t.treatment_date + coalesce(t.start_time, time '11:00'))
       at time zone coalesce((select (value #>> '{}') from app_settings where key = 'timezone'),
                             'Asia/Hong_Kong'))),
    t.duration_minutes,
    t.customer_id,
    c.name,
    c.phone,
    s.name_zh,
    coalesce(t.detail, s.name_zh),
    t.status::text
  from treatments t
  join customers c on c.id = t.customer_id
  join services  s on s.id = t.service_id

union all

  select
    b.id,
    'followup'::text,
    'follow_up'::text,
    b.due_at,
    0,
    b.customer_id,
    b.customer_name,
    b.customer_phone,
    b.service_name,
    b.label_zh,
    b.display_status
  from v_followup_board b
  where b.node_type = 'follow_up'
    and b.display_status not in ('done', 'skipped')

union all

  select
    b.id,
    'review_window'::text,
    'review'::text,
    b.due_at,
    0,
    b.customer_id,
    b.customer_name,
    b.customer_phone,
    b.service_name,
    b.label_zh || ' 回診期開始',
    b.display_status
  from v_followup_board b
  where b.node_type = 'review'
    and b.display_status not in ('done', 'skipped', 'booked');

alter view v_customer_summary set (security_invoker = on);
alter view v_service_revenue  set (security_invoker = on);
alter view v_dashboard_stats  set (security_invoker = on);
alter view v_calendar_events  set (security_invoker = on);

grant select on v_customer_summary, v_service_revenue, v_dashboard_stats, v_calendar_events
  to authenticated;
