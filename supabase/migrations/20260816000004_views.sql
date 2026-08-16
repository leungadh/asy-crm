-- ============================================================================
-- ASY Beaute — 0004: reporting views
-- ============================================================================
-- Every "status badge" the mockups show is DERIVED here, not stored, so the UI
-- can never display a stale 逾期未跟 badge.
-- ============================================================================

-- ─── Follow-up board ────────────────────────────────────────────────────────
-- display_status is what the UI badge renders. Precedence matters:
-- terminal states first, then explicit actions, then time-derived states.
create view v_followup_board as
select
  n.id,
  n.treatment_id,
  n.sequence,
  n.label_zh,
  n.label_en,
  n.node_type,
  n.due_at,
  n.window_end_date,
  n.status,
  n.note,
  n.contacted_at,
  n.completed_at,
  t.customer_id,
  c.name  as customer_name,
  c.phone as customer_phone,
  c.tags  as customer_tags,
  s.code  as service_code,
  s.name_zh as service_name,
  t.detail,
  t.treatment_date,
  (n.due_at)::date as due_date,
  case
    when n.status = 'done'      then 'done'          -- 已完成
    when n.status = 'skipped'   then 'skipped'       -- 略過
    when n.status = 'booked'    then 'booked'        -- 已預約
    when n.status = 'replied'   then 'replied'       -- 已回覆
    when n.status = 'contacted' then 'awaiting_reply'-- 待回覆
    when n.node_type = 'review' and now() >= n.due_at
                                then 'pending_booking' -- 待預約
    when now() > n.due_at + make_interval(days =>
           coalesce((select (value #>> '{}')::int from app_settings
                      where key = 'overdue_grace_days'), 2))
                                then 'overdue'       -- 逾期未跟
    when now() >= n.due_at      then 'due'           -- 待跟進
    else 'not_due'                                   -- 未到期
  end as display_status
from followup_nodes n
join treatments t on t.id = n.treatment_id
join customers  c on c.id = t.customer_id
join services   s on s.id = t.service_id;

-- ─── Customer summary ───────────────────────────────────────────────────────
create view v_customer_summary as
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
  nxt.display_status as next_followup_status
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
) nxt on true;

comment on view v_customer_summary is
  'is_lapsed is informational only. customers.status (沉睡客/已完成) is set by hand.';

-- ─── Stock levels ───────────────────────────────────────────────────────────
create view v_stock_levels as
select
  p.id,
  p.code,
  p.name_zh,
  p.category,
  p.unit,
  p.note,
  p.low_stock_threshold,
  p.critical_stock_threshold,
  coalesce(sum(m.delta) filter (where m.location = 'studio'), 0)::int as studio_qty,
  coalesce(sum(m.delta) filter (where m.location = 'home'),   0)::int as home_qty,
  coalesce(sum(m.delta), 0)::int as total_qty,
  case
    when coalesce(sum(m.delta), 0) <= p.critical_stock_threshold then 'critical'  -- 不足
    when coalesce(sum(m.delta), 0) <= p.low_stock_threshold      then 'low'       -- 偏低
    else 'ok'                                                                     -- 充足
  end as stock_status
from products p
left join stock_movements m on m.product_id = p.id
where p.is_active
group by p.id
order by p.sort_order;

-- ─── Calendar ───────────────────────────────────────────────────────────────
-- Unions the three things the 日曆 page plots: booked appointments,
-- follow-up check-ins (no slot), and the opening day of a review window.
create view v_calendar_events as
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

-- ─── Revenue rollups (統計報表) ─────────────────────────────────────────────
create view v_monthly_ledger as
select
  date_trunc('month', entry_date)::date as month,
  sum(amount) filter (where direction = 'income')  as income,
  sum(amount) filter (where direction = 'expense') as expense,
  coalesce(sum(amount) filter (where direction = 'income'), 0)
    - coalesce(sum(amount) filter (where direction = 'expense'), 0) as net,
  count(*) as entry_count
from ledger_entries
group by 1
order by 1;

create view v_service_revenue as
select
  s.id   as service_id,
  s.code,
  s.name_zh,
  s.accent,
  count(t.id)                   as treatment_count,
  coalesce(sum(t.amount), 0)    as revenue,
  round(avg(t.amount), 0)       as avg_ticket
from services s
left join treatments t on t.service_id = s.id
group by s.id
order by revenue desc;

create view v_customer_sources as
select
  coalesce(nullif(source, ''), '其他') as source,
  count(*) as customer_count,
  round(100.0 * count(*) / nullif(sum(count(*)) over (), 0), 1) as pct
from customers
group by 1
order by customer_count desc;

-- Dashboard headline numbers, one row.
create view v_dashboard_stats as
select
  (select count(*) from customers)                                       as total_customers,
  (select count(*) from customers where status = 'active_followup')      as active_followup,
  (select count(*) from customers where status = 'pending_review')       as pending_review,
  (select count(*) from customers where status = 'dormant')              as dormant,
  (select count(*) from v_customer_summary where is_new)                 as new_customers,
  (select count(*) from treatments
     where treatment_date >= date_trunc('month', current_date))          as treatments_this_month,
  (select coalesce(sum(amount), 0) from ledger_entries
     where direction = 'income'
       and entry_date >= date_trunc('month', current_date))              as income_this_month,
  (select coalesce(sum(amount), 0) from ledger_entries
     where direction = 'expense'
       and entry_date >= date_trunc('month', current_date))              as expense_this_month,
  (select count(*) from v_followup_board where display_status = 'overdue') as overdue_followups,
  (select count(*) from v_followup_board where display_status = 'due')     as due_followups,
  (select count(*) from v_stock_levels where stock_status <> 'ok')         as products_needing_restock;
