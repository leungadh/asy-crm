-- ============================================================================
-- ASY Beaute — seed data (development only)
-- ============================================================================
-- Deterministic: setseed() makes every run produce identical data.
-- Anchored to 2026-08-16 so the dashboard, calendar and charts all have
-- something to render. NEVER run this against production.
-- ============================================================================

select setseed(0.42);

-- ─── Customers ──────────────────────────────────────────────────────────────
insert into customers (name, phone, source, instagram, birthday, occupation, tags, remark, status) values
('Carrie Chan','9123 4567','Instagram','carrie.chan','1989-01-15','設計師','{VIP,舊客,敏感肌,怕痛}','怕痛，療程前需要多解釋
喜歡自然效果，不喜歡太深色
晚上較方便聯絡，回覆訊息較快','active_followup'),
('Mandy Lee','9012 3456','Instagram','mandy.lee','1993-06-02','市場推廣','{新客}','第一次做 VIO，較緊張','active_followup'),
('Kelly Lau','6123 4567','朋友介紹',NULL,'1991-11-20','護士','{新客}','輪班工作，只能約週末','active_followup'),
('Amy Chan','9234 5678','Instagram','amy.c','1988-03-08','會計師','{舊客}','已完成腋下，考慮腿部','completed'),
('Carmen Ng','6111 2233','舊客介紹',NULL,'1990-07-14','老師','{VIP,舊客}','Carrie 介紹','pending_review'),
('Joyce Wong','6777 8899','Instagram','joyce.wong','1995-09-30','空姐','{舊客}','經常出差，需提早預約','active_followup'),
('Sophie Tam','6888 9900','朋友介紹',NULL,'1992-02-11','自由工作者','{舊客}','對麻膏反應正常','completed'),
('Yuki Chan','6999 1122','Instagram','yuki.chan','1994-12-25','行政人員','{舊客}','','completed'),
('Cindy Ho','9345 6789','舊客介紹',NULL,'1987-05-19','律師','{VIP,舊客}','時間非常緊，只能午飯時間','active_followup'),
('Yuki Tam','9456 7890','Instagram','yuki.tam','1996-08-07','學生','{新客}','預算有限，分期做','dormant'),
('Sophie Chan','9567 8901','朋友介紹',NULL,'1990-04-22','公關','{舊客}','','dormant'),
('Rachel Ip','9678 9012','Instagram','rachel.ip','1993-10-03','攝影師','{舊客,敏感肌}','皮膚較敏感，需先試敏','active_followup'),
('Fiona Cheung','9789 0123','舊客介紹',NULL,'1986-01-28','醫生','{VIP,舊客}','','completed'),
('Vivian Ko','9890 1234','Instagram','vivian.ko','1997-03-16','網店店主','{新客}','','active_followup'),
('Tracy Yeung','9901 2345','其他',NULL,'1991-06-25','銀行職員','{舊客}','','completed'),
('Emily Sit','6234 5678','Instagram','emily.sit','1994-09-12','設計師','{舊客}','喜歡偏冷色調','active_followup'),
('Nicole Tsang','6345 6789','朋友介紹',NULL,'1989-11-05','人力資源','{舊客}','','dormant'),
('Karen Fung','6456 7890','Instagram','karen.fung','1992-07-19','美容師','{VIP,舊客}','同行，要求高','active_followup'),
('Priscilla Lam','6567 8901','舊客介紹',NULL,'1995-02-27','市場推廣','{新客}','','active_followup'),
('Jasmine Ho','6678 9012','Instagram','jasmine.ho','1990-08-14','會計師','{舊客}','','completed'),
('Angel Lai','6789 0123','其他',NULL,'1988-12-01','教師','{舊客}','','dormant'),
('Christy Mak','6890 1234','Instagram','christy.mak','1996-05-08','插畫師','{新客}','','active_followup'),
('Winnie Tong','6901 2345','朋友介紹',NULL,'1993-03-21','物流','{舊客}','','completed'),
('Sandy Kwok','9111 2222','Instagram','sandy.kwok','1991-10-17','營養師','{舊客,怕痛}','非常怕痛，需加強麻醉','active_followup'),
('Elaine Poon','9222 3333','舊客介紹',NULL,'1987-04-09','行政總監','{VIP,舊客}','','pending_review'),
('Michelle Yu','9333 4444','Instagram','michelle.yu','1994-01-30','瑜伽導師','{舊客}','','active_followup'),
('Queenie Siu','9444 5555','朋友介紹',NULL,'1992-11-11','咖啡師','{新客}','','dormant'),
('Bonnie Wan','9555 6666','Instagram','bonnie.wan','1989-09-23','建築師','{舊客}','','completed'),
('Cherry Lo','9666 7777','其他',NULL,'1995-07-04','編輯','{新客}','','active_followup'),
('Ivy Chow','9777 8888','Instagram','ivy.chow','1990-02-18','產品經理','{VIP,舊客,敏感肌}','','active_followup');

-- ─── Treatments ─────────────────────────────────────────────────────────────
-- Roughly Jan–Aug 2026 with a gentle upward ramp in volume, matching the
-- "每月營業額走勢" chart. The followup-node trigger fires on every insert.
do $$
declare
  v_cust        uuid;
  v_service     record;
  v_code        text;
  v_date        date;
  v_amount      numeric(10,2);
  v_detail      text;
  v_pigment     text;
  v_pay         text;
  v_month       int;
  v_count       int;
  i             int;
  pays          text[] := array['FPS','Cash','PayMe','Bank Transfer','Card'];
  areola_parts  text[] := array['雙側乳暈','乳暈 + 乳柱','單側乳暈','乳暈補色'];
  vio_parts     text[] := array['V+I+O','V+I','VIO 修復','I+O'];
  lip_parts     text[] := array['唇色療程','裸粉唇','霧感唇','唇色補色'];
  body_parts    text[] := array['腋下','腿','膝蓋','其他部位'];
begin
  for v_month in 1..8 loop
    -- 8 treatments in January climbing to 18 in August
    v_count := 7 + v_month + (case when v_month >= 7 then 2 else 0 end);

    for i in 1..v_count loop
      select id into v_cust from customers order by random() limit 1;

      -- NB: resolve the code into a variable FIRST. Putting a volatile
      -- expression directly in the WHERE clause re-evaluates it per scanned
      -- row, so the match becomes a coin flip and often finds nothing.
      v_code := (array['areola','vio','lip','body'])[
        case
          when random() < 0.33 then 1
          when random() < 0.60 then 2
          when random() < 0.83 then 3
          else 4
        end];
      select * into v_service from services where code = v_code;

      -- The current month is partial: keep dates on or before "today" so the
      -- dashboard's month-to-date figures are populated. Using EXIT here would
      -- abandon the rest of the month on the first out-of-range roll.
      v_date := make_date(2026, v_month, 1)
                + (random() * (case when v_month = 8 then 14 else 27 end))::int;

      v_pay := pays[1 + floor(random() * array_length(pays, 1))::int];

      case v_service.code
        when 'areola' then
          v_detail  := areola_parts[1 + floor(random() * 4)::int];
          v_amount  := 4680;
          v_pigment := 'Areola Mix ' || (1 + floor(random() * 2)::int);
        when 'vio' then
          v_detail  := vio_parts[1 + floor(random() * 4)::int];
          v_amount  := 6680;
          v_pigment := 'B2 / N2 混色';
        when 'lip' then
          v_detail  := lip_parts[1 + floor(random() * 4)::int];
          v_amount  := 2980;
          v_pigment := 'P1';
        else
          v_detail  := body_parts[1 + floor(random() * 4)::int];
          v_amount  := 2600;
          v_pigment := NULL;
      end case;

      -- ad-hoc discounts, which is exactly why there is no price list
      if random() < 0.18 then
        v_amount := v_amount - (case when random() < 0.5 then 200 else 500 end);
      end if;

      insert into treatments (
        customer_id, service_id, detail, treatment_date, amount,
        payment_method, pigment_used, rating, remark, status
      ) values (
        v_cust, v_service.id, v_detail, v_date, v_amount,
        v_pay, v_pigment,
        case when random() < 0.75 then 4 + floor(random() * 2)::int else null end,
        case when random() < 0.35 then '第一轉上色正常，客人反應良好' else null end,
        (case when v_date < date '2026-06-01' then 'completed' else 'in_progress' end)::treatment_status
      );
    end loop;
  end loop;
end $$;

-- ─── Age the follow-up timelines realistically ──────────────────────────────
-- Nodes on old treatments are done; recent ones are mid-flight.
update followup_nodes n
   set status = 'done', completed_at = n.due_at + interval '1 day'
  from treatments t
 where t.id = n.treatment_id
   and t.treatment_date < date '2026-06-01';

update followup_nodes n
   set status = 'contacted', contacted_at = n.due_at
  from treatments t
 where t.id = n.treatment_id
   and t.treatment_date between date '2026-06-01' and date '2026-07-15'
   and n.due_at < now()
   and random() < 0.7;

update followup_nodes n
   set status = 'done', completed_at = n.due_at + interval '2 days'
  from treatments t
 where t.id = n.treatment_id
   and t.treatment_date between date '2026-06-01' and date '2026-07-15'
   and n.due_at < now()
   and n.status = 'pending'
   and random() < 0.6;

-- A few notes on upcoming nodes, as in the mockup
update followup_nodes set note = '需了解結痂與脫落情況' where sequence = 1 and note is null;
update followup_nodes set note = '觀察顏色穩定度'       where sequence = 2 and note is null;
update followup_nodes set note = '整體上色效果評估'     where sequence = 3 and note is null;
update followup_nodes set note = '評估是否需要補色'     where node_type = 'review' and note is null;
update followup_nodes set note = '長期穩定度追蹤'       where sequence = 5 and note is null;

-- ─── Upcoming bookings ──────────────────────────────────────────────────────
-- Since 0009 a booking IS a treatment with status 'scheduled': no amount, no
-- follow-up timeline and no income row until it is actually performed.
insert into treatments (customer_id, service_id, detail, treatment_date, start_time,
                        duration_minutes, status, amount)
select
  c.id,
  s.id,
  NULL,
  date '2026-08-17' + n,
  (array['10:00','11:00','14:00','15:30','17:00'])[1 + floor(random() * 5)::int]::time,
  (array[60, 90, 120])[1 + floor(random() * 3)::int],
  'scheduled',
  NULL
from generate_series(0, 9) n
cross join lateral (select id from customers order by random() limit 1) c
cross join lateral (select id from services  order by random() limit 1) s;

-- Give the historical records plausible arrival times too, so the calendar is
-- not empty when looking back.
update treatments
   set start_time = (array['10:00','11:00','14:00','15:30','17:00'])[1 + floor(random() * 5)::int]::time,
       duration_minutes = (array[60, 90, 120])[1 + floor(random() * 3)::int]
 where status <> 'scheduled';

-- Book a few 回診. Selecting on display_status made this depend on the random
-- ageing above and some runs produced none at all, so pick on the stored
-- status instead: deterministic, and always yields rows if review nodes exist.
insert into appointments (customer_id, type, service_id, followup_node_id, starts_at, duration_minutes, status)
select
  b.customer_id,
  'review',
  t.service_id,
  b.id,
  (b.due_at + interval '3 days'),
  60,
  'scheduled'
from v_followup_board b
join treatments t on t.id = b.treatment_id
where b.node_type = 'review'
  and b.status not in ('done', 'skipped', 'booked')
order by b.due_at
limit 3;

-- ─── Stock ──────────────────────────────────────────────────────────────────
-- Opening stock-take reproducing the 存貨管理 mockup exactly:
-- AL1 8/4=12 充足, AL2 2/2=4 偏低, B2 5/3=8 充足, N2 2/1=3 不足, P1 10/5=15 充足
insert into stock_movements (product_id, location, delta, reason, note, occurred_on)
select p.id, v.loc::stock_location, v.qty, 'stock_take', '期初盤點', date '2026-08-01'
from products p
join (values
  ('AL1','studio', 8), ('AL1','home', 4),
  ('AL2','studio', 2), ('AL2','home', 2),
  ('B2', 'studio', 5), ('B2', 'home', 3),
  ('N2', 'studio', 2), ('N2', 'home', 1),
  ('P1', 'studio',10), ('P1', 'home', 5)
) as v(code, loc, qty) on v.code = p.code;

-- ─── Customer product purchases (auto-create income rows) ───────────────────
insert into customer_purchases (customer_id, product_id, quantity, amount, payment_method, ship_from, purchase_date, note)
select
  t.customer_id,
  p.id,
  q.qty,
  q.qty * 380,
  'FPS',
  (array['studio','home'])[1 + floor(random() * 2)::int]::stock_location,
  t.treatment_date,
  '療程當日購買'
from treatments t
join lateral (select id from products order by random() limit 1) p on true
join lateral (select 1 + floor(random() * 2)::int as qty) q on true
where random() < 0.3;

-- ─── Operating expenses ─────────────────────────────────────────────────────
insert into ledger_entries (entry_date, direction, category, item, amount, payment_method, note, is_auto)
select
  make_date(2026, m, 20), 'expense', '營運費用', '租金', 9000, 'Bank Transfer',
  to_char(make_date(2026, m, 1), 'MM月') || '租金', false
from generate_series(1, 8) m;

insert into ledger_entries (entry_date, direction, category, item, amount, payment_method, note, is_auto)
select
  make_date(2026, m, 18), 'expense', '營運費用', '管理費', 1762, 'Bank Transfer', '管理服務費', false
from generate_series(1, 8) m;

insert into ledger_entries (entry_date, direction, category, item, amount, payment_method, note, is_auto)
select
  make_date(2026, m, 15), 'expense', '材料成本', '色乳材料',
  (900 + floor(random() * 800))::numeric(10,2), 'Card', '色乳補充', false
from generate_series(1, 8) m;

insert into ledger_entries (entry_date, direction, category, item, amount, payment_method, note, is_auto)
select
  make_date(2026, m, 12), 'expense', '營運費用', '消耗品',
  (250 + floor(random() * 300))::numeric(10,2), 'Cash', '手套、針片等', false
from generate_series(1, 8) m;

-- ─── Sanity output ──────────────────────────────────────────────────────────
do $$
declare r record;
begin
  select
    (select count(*) from customers)         as customers,
    (select count(*) from treatments)        as treatments,
    (select count(*) from followup_nodes)    as nodes,
    (select count(*) from appointments)      as appointments,
    (select count(*) from customer_purchases)as purchases,
    (select count(*) from ledger_entries)    as ledger
  into r;
  raise notice 'Seeded: % customers, % treatments, % follow-up nodes, % appointments, % purchases, % ledger rows',
    r.customers, r.treatments, r.nodes, r.appointments, r.purchases, r.ledger;
end $$;
