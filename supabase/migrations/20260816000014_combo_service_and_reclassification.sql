-- ============================================================================
-- ASY Beaute — 0014: Combo service, stock bands, payment methods, categories
-- ============================================================================
-- Requested 2026-08-17. Several of these rename values that are stored as TEXT
-- on historical rows, so each rename updates the history in the same
-- transaction. Renaming only the reference row would leave old records
-- pointing at a name that no longer exists.
-- ============================================================================

-- ─── 1. Combo ─────────────────────────────────────────────────────────────
insert into services (code, name_zh, name_en, accent, sort_order)
values ('combo', 'Combo', 'Combo', 'emerald', 5)
on conflict (code) do nothing;

-- Same shape as Areola and VIO: the 6-week node is a 回診, a real return visit
-- booked inside a 7-day window, not a WhatsApp check-in.
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
where s.code = 'combo'
  and not exists (
    select 1 from followup_rules r where r.service_id = s.id and r.sequence = v.seq
  );

-- ─── 2. Stock bands ───────────────────────────────────────────────────────
-- 不足 at 8 or fewer, 偏低 from 9 to 12, 充足 above that. The old defaults
-- (3 and 5) were set before Yoyo had a feel for real turnover.
alter table products alter column critical_stock_threshold set default 8;
alter table products alter column low_stock_threshold      set default 12;

update products
   set critical_stock_threshold = 8,
       low_stock_threshold      = 12;

-- ─── 3. Payment methods ───────────────────────────────────────────────────
-- 'FPS' becomes 'FPS - Yoyo'. Without rewriting history the payment breakdown
-- would carry both forever.
update treatments          set payment_method = 'FPS - Yoyo' where payment_method = 'FPS';
update customer_purchases  set payment_method = 'FPS - Yoyo' where payment_method = 'FPS';
update ledger_entries      set payment_method = 'FPS - Yoyo' where payment_method = 'FPS';

-- ─── 4. Expense categories ────────────────────────────────────────────────
-- Rename in place so historical ledger rows travel with their category, then
-- add anything missing. Each pair is (old, new).
do $$
declare
  pair record;
begin
  for pair in
    select * from (values
      ('材料成本', '材料入貨', 'Stock purchases'),
      ('租金',     '租金水電', 'Rent & utilities'),
      ('營運費用', '日常用品', 'Daily supplies')
    ) as t(old_name, new_name, new_en)
  loop
    -- History first: ledger_entries.category stores the name, not an id.
    update ledger_entries
       set category = pair.new_name
     where category = pair.old_name
       and direction = 'expense';

    update ledger_categories
       set name_zh = pair.new_name,
           name_en = pair.new_en
     where name_zh = pair.old_name
       and direction = 'expense';
  end loop;
end $$;

-- Re-order and make sure the full set exists, whatever the starting state.
insert into ledger_categories (direction, name_zh, name_en, sort_order, is_system) values
  ('expense', '材料入貨', 'Stock purchases',  1, false),
  ('expense', '日常用品', 'Daily supplies',   2, false),
  ('expense', '租金水電', 'Rent & utilities', 3, false),
  ('expense', '其他支出', 'Other expenses',   4, false),
  ('income',  '訂金收入', 'Deposits',         3, false)
on conflict (direction, name_zh) do update
  set sort_order = excluded.sort_order,
      name_en    = excluded.name_en,
      is_active  = true;

-- 其他收入 moves down now that deposits sit above it.
update ledger_categories set sort_order = 4
 where direction = 'income' and name_zh = '其他收入';

notify pgrst, 'reload schema';
