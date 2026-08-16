-- ============================================================================
-- ASY Beaute — 0006: expose service_id on v_followup_board
-- ============================================================================
-- Booking a 回診 needs the treatment's service_id to create the appointment.
-- The view exposed service_code and service_name but not the id, forcing the
-- client into an extra round trip (or, worse, sending an empty string into a
-- uuid FK).
--
-- New columns are APPENDED. CREATE OR REPLACE VIEW can only add columns at the
-- end, and v_customer_summary depends on this view, so dropping it would
-- cascade.
-- ============================================================================

create or replace view v_followup_board as
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
    when n.status = 'done'      then 'done'
    when n.status = 'skipped'   then 'skipped'
    when n.status = 'booked'    then 'booked'
    when n.status = 'replied'   then 'replied'
    when n.status = 'contacted' then 'awaiting_reply'
    when n.node_type = 'review' and now() >= n.due_at
                                then 'pending_booking'
    when now() > n.due_at + make_interval(days =>
           coalesce((select (value #>> '{}')::int from app_settings
                      where key = 'overdue_grace_days'), 2))
                                then 'overdue'
    when now() >= n.due_at      then 'due'
    else 'not_due'
  end as display_status,
  t.service_id                                    -- appended in 0006
from followup_nodes n
join treatments t on t.id = n.treatment_id
join customers  c on c.id = t.customer_id
join services   s on s.id = t.service_id;

alter view v_followup_board set (security_invoker = on);
grant select on v_followup_board to authenticated;
