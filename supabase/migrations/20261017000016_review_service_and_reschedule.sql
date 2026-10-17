-- 0016 — 回診 as a 療程項目, and follow-up dates that move with a corrected date.
--
-- ─── 1. 回診 as a service ──────────────────────────────────────────────────
--
-- 回診 already means something in this app: the 6-week review node in a
-- follow-up timeline, booked into `appointments`. This adds a second, related
-- meaning — the record of the visit once it actually happens.
--
-- They are deliberately not merged. The node is the PLAN (a window to aim for);
-- the treatment row is the RECORD (what was done, on what date, for how much).
-- The app links them at the point of entry: recording a 回診 treatment offers to
-- close the open review node. Offers — Yoyo confirms, as with every other
-- status in this system.
--
-- NO followup_rules are inserted for it. generate_followup_nodes() selects from
-- followup_rules by service_id, so a service with no rules generates no nodes,
-- which is exactly right: 回診 IS the follow-up visit. Giving it a timeline of
-- its own would restart the cycle and leave two overlapping timelines running
-- for one client.

insert into services (code, name_zh, name_en, accent, sort_order)
values ('review', '回診', 'Review', 'sky', 6)
on conflict (code) do nothing;

-- ─── 2. Correcting a date moves the follow-ups that haven't been acted on ──
--
-- Until now, editing treatment_date re-synced the income row (0009 lists it in
-- the ledger trigger's column list) but left the follow-up timeline on the old
-- dates. A date typed wrong on Monday and fixed on Tuesday left every check-in
-- silently a day out.
--
-- Only `pending` nodes move. Once a node is contacted, replied, booked, done or
-- skipped it records something that really happened on a real day — shifting it
-- would rewrite history to match a correction made afterwards.

create or replace function shift_followup_nodes_on_reschedule()
returns trigger language plpgsql as $$
declare
  v_delta int;
begin
  -- `after update of treatment_date` fires whenever the column appears in the
  -- SET list, changed or not. Compare before doing any work.
  if new.treatment_date is not distinct from old.treatment_date then
    return new;
  end if;

  v_delta := new.treatment_date - old.treatment_date;

  update followup_nodes
     set due_at = due_at + make_interval(days => v_delta),
         window_end_date = case
           when window_end_date is not null then window_end_date + v_delta
           else null
         end
   where treatment_id = new.id
     and status = 'pending';

  return new;
end $$;

drop trigger if exists trg_treatment_shift_followups on treatments;
create trigger trg_treatment_shift_followups
  after update of treatment_date on treatments
  for each row execute function shift_followup_nodes_on_reschedule();

comment on function shift_followup_nodes_on_reschedule() is
  'Moves untouched (pending) follow-up nodes when a treatment date is corrected. '
  'Nodes already contacted/replied/booked/done/skipped keep their original dates.';
