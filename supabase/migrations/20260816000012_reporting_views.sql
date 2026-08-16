-- ============================================================================
-- ASY Beaute — 0012: reporting rollups for 統計報表
-- ============================================================================
-- Every view here excludes status = 'scheduled'. A booking is a promise, not
-- turnover, and counting it would make next month's diary look like this
-- month's revenue.
-- ============================================================================

-- ─── Revenue by service, per month ────────────────────────────────────────
create view v_monthly_service_revenue as
select
  date_trunc('month', t.treatment_date)::date as month,
  s.id      as service_id,
  s.code,
  s.name_zh,
  s.name_en,
  s.accent,
  count(*)::int              as treatment_count,
  coalesce(sum(t.amount), 0) as revenue
from treatments t
join services s on s.id = t.service_id
where t.status <> 'scheduled'
group by 1, 2, 3, 4, 5, 6;

-- ─── New vs returning, repeat rate, average ticket ────────────────────────
create view v_monthly_customer_stats as
with performed as (
  select
    t.customer_id,
    t.amount,
    t.treatment_date,
    date_trunc('month', t.treatment_date)::date as month
  from treatments t
  where t.status <> 'scheduled'
),
per_month as (
  select
    month,
    count(distinct customer_id)::int as treatment_customers,
    count(*)::int                    as treatment_count,
    coalesce(sum(amount), 0)         as revenue
  from performed
  group by month
),
-- A customer is "new" in the month of their FIRST performed treatment, which
-- is not the same as the month they were added to the database.
first_visit as (
  select customer_id, min(treatment_date) as first_date
  from performed
  group by customer_id
),
new_per_month as (
  select date_trunc('month', first_date)::date as month, count(*)::int as new_customers
  from first_visit
  group by 1
)
select
  p.month,
  p.treatment_customers,
  p.treatment_count,
  p.revenue,
  coalesce(n.new_customers, 0)                          as new_customers,
  p.treatment_customers - coalesce(n.new_customers, 0)  as returning_customers,
  case when p.treatment_customers > 0
       then round(100.0 * (p.treatment_customers - coalesce(n.new_customers, 0))
                  / p.treatment_customers, 1)
       else 0 end                                       as repeat_rate,
  case when p.treatment_count > 0
       then round(p.revenue / p.treatment_count, 0)
       else 0 end                                       as avg_ticket
from per_month p
left join new_per_month n on n.month = p.month;

-- ─── Follow-up completion, and how often 回診 actually happens ────────────
create view v_followup_summary as
select
  count(*) filter (where display_status = 'done')::int            as done,
  count(*) filter (where display_status in ('due', 'overdue'))::int as outstanding,
  count(*) filter (where display_status = 'awaiting_reply')::int  as awaiting_reply,
  count(*) filter (where display_status = 'booked')::int          as booked,
  count(*) filter (where display_status = 'not_due')::int         as not_due,
  count(*)::int                                                   as total
from v_followup_board;

create view v_review_rate as
select
  count(*) filter (where status in ('booked', 'done'))::int as reviewed,
  count(*)::int                                            as total,
  case when count(*) > 0
       then round(100.0 * count(*) filter (where status in ('booked', 'done')) / count(*), 1)
       else 0 end                                          as rate
from followup_nodes
where node_type = 'review';

alter view v_monthly_service_revenue set (security_invoker = on);
alter view v_monthly_customer_stats  set (security_invoker = on);
alter view v_followup_summary        set (security_invoker = on);
alter view v_review_rate             set (security_invoker = on);

grant select on
  v_monthly_service_revenue, v_monthly_customer_stats, v_followup_summary, v_review_rate
to authenticated;

notify pgrst, 'reload schema';
