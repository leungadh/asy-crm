-- 0015 — 身體部位 gains a 1星期跟進, ahead of the existing 3星期跟進.
--
-- Body treatments were seeded in 0002 with a single node at 3 weeks. Yoyo wants
-- a 1-week check-in as well, matching every other service.
--
-- Two things make this more than a one-line insert:
--
-- 1. `unique (service_id, sequence)` means the new rule cannot simply take
--    sequence 1 while the 3-week rule still holds it. The 3-week rule has to be
--    parked on an unused sequence first. There is no deferrable constraint here,
--    so the collision would fire mid-statement otherwise.
--
-- 2. Ordering matters downstream. `TreatmentHistory` sorts a visit's nodes by
--    `sequence`, so leaving the 1-week rule at sequence 2 would print it below
--    the 3-week one.
--
-- EXISTING TREATMENTS ARE NOT TOUCHED, which is the long-standing behaviour of
-- this table: `generate_followup_nodes()` runs once on insert, and a timeline is
-- materialised from the rules as they stood that day. Backfilling would drop
-- already-overdue nodes onto the follow-up board for visits months old.

do $$
declare
  v_body uuid;
begin
  select id into v_body from services where code = 'body';
  if v_body is null then
    raise exception '0015: no service with code ''body''';
  end if;

  -- Idempotent: re-running must not create a second 1-week rule.
  if exists (
    select 1 from followup_rules
    where service_id = v_body and offset_days = 7 and node_type = 'follow_up'
  ) then
    raise notice '0015: body already has a 1-week follow-up, nothing to do';
    return;
  end if;

  -- Park whatever currently holds sequence 1 somewhere unused.
  update followup_rules
     set sequence = 900 + sequence
   where service_id = v_body;

  insert into followup_rules
    (service_id, sequence, label_zh, label_en, node_type, offset_days, window_days)
  values
    (v_body, 1, '1星期跟進', '1 Week Follow-up', 'follow_up', 7, 0);

  -- Renumber the parked rules back, in their original order, after the new one.
  with ordered as (
    select id, row_number() over (order by sequence) + 1 as seq
    from followup_rules
    where service_id = v_body and sequence >= 900
  )
  update followup_rules r
     set sequence = o.seq
    from ordered o
   where r.id = o.id;
end $$;
