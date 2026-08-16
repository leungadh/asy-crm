// Spins up a throwaway PostgreSQL 18, applies every migration + seed, then
// asserts the invariants the app depends on. Run with: npm run db:verify
import EmbeddedPostgres from 'embedded-postgres';
import { readFileSync, readdirSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const MIG  = `${ROOT}supabase/migrations`;
const SEED = `${ROOT}supabase/seed.sql`;

const pg = new EmbeddedPostgres({
  databaseDir: '/tmp/asy-verify-db', user: 'postgres', password: 'postgres',
  port: 54998, persistent: false,
});
await pg.initialise();
await pg.start();
const c = pg.getPgClient();
await c.connect();

const fail = (label, e) => { console.log(`\n❌ ${label}\n   ${e.message}`); process.exitCode = 1; };

// pgcrypto must exist before the shim uses gen_random_uuid
await c.query('create extension if not exists pgcrypto');
try { await c.query(readFileSync(`${ROOT}scripts/pg-shim.sql`,'utf8')); console.log('✅ shim'); }
catch (e) { fail('shim', e); await pg.stop(); process.exit(1); }

for (const f of readdirSync(MIG).sort()) {
  try { await c.query(readFileSync(`${MIG}/${f}`,'utf8')); console.log(`✅ ${f}`); }
  catch (e) { fail(f, e); await c.end(); await pg.stop(); process.exit(1); }
}

try { await c.query(readFileSync(SEED,'utf8')); console.log('✅ seed.sql'); }
catch (e) { fail('seed.sql', e); await c.end(); await pg.stop(); process.exit(1); }

const q = async (label, sql) => {
  try {
    const r = await c.query(sql);
    console.log(`\n── ${label} ──`);
    console.table(r.rows.slice(0, 12));
    return r.rows;
  } catch (e) { fail(label, e); return []; }
};

await q('Row counts', `
  select 'customers' t, count(*) n from customers
  union all select 'treatments', count(*) from treatments
  union all select 'followup_nodes', count(*) from followup_nodes
  union all select 'appointments', count(*) from appointments
  union all select 'customer_purchases', count(*) from customer_purchases
  union all select 'ledger_entries', count(*) from ledger_entries
  order by 1`);

await q('Dashboard stats', 'select * from v_dashboard_stats');
await q('Stock levels (must match mockup)', 'select code, studio_qty, home_qty, total_qty, stock_status from v_stock_levels');
await q('Follow-up badge distribution', `
  select display_status, count(*) n from v_followup_board group by 1 order by n desc`);
await q('Monthly ledger', 'select month, income, expense, net from v_monthly_ledger');
await q('Service revenue', 'select code, treatment_count, revenue, avg_ticket from v_service_revenue');
await q('Customer sources', 'select * from v_customer_sources');
await q('Sample customer summary', `
  select name, visit_count, lifetime_value, last_visit_date, next_followup_label, next_followup_status
  from v_customer_summary where visit_count > 0 order by lifetime_value desc nulls last limit 6`);

// ── Integrity checks ───────────────────────────────────────────────────────
console.log('\n════ INTEGRITY CHECKS ════');
const check = async (label, sql, expect) => {
  try {
    const r = await c.query(sql);
    const got = r.rows[0]?.result;
    const ok = String(got) === String(expect);
    console.log(`${ok ? '✅' : '❌'} ${label} → got ${got}, expected ${expect}`);
    if (!ok) process.exitCode = 1;
  } catch (e) { fail(label, e); }
};

await check('Every treatment has exactly one auto income row',
  `select count(*)::text result from treatments t
     where (select count(*) from ledger_entries l where l.treatment_id=t.id) <> 1`, '0');
await check('Every purchase has exactly one auto income row',
  `select count(*)::text result from customer_purchases p
     where (select count(*) from ledger_entries l where l.purchase_id=p.id) <> 1`, '0');
await check('Areola/VIO treatments each generated 5 follow-up nodes',
  `select count(*)::text result from treatments t join services s on s.id=t.service_id
     where s.code in ('areola','vio')
       and (select count(*) from followup_nodes n where n.treatment_id=t.id) <> 5`, '0');
await check('Lip treatments each generated 3 nodes',
  `select count(*)::text result from treatments t join services s on s.id=t.service_id
     where s.code='lip' and (select count(*) from followup_nodes n where n.treatment_id=t.id) <> 3`, '0');
await check('Body treatments each generated 1 node',
  `select count(*)::text result from treatments t join services s on s.id=t.service_id
     where s.code='body' and (select count(*) from followup_nodes n where n.treatment_id=t.id) <> 1`, '0');
await check('Only Areola/VIO have review nodes',
  `select count(*)::text result from followup_nodes n
     join treatments t on t.id=n.treatment_id join services s on s.id=t.service_id
     where n.node_type='review' and s.code not in ('areola','vio')`, '0');
await check('Review nodes all have a booking window',
  `select count(*)::text result from followup_nodes where node_type='review' and window_end_date is null`, '0');
await check('Stock total AL1 = 12', `select total_qty::text result from v_stock_levels where code='AL1'`, '12');
await check('Stock N2 flagged critical', `select stock_status result from v_stock_levels where code='N2'`, 'critical');
await check('Stock AL2 flagged low', `select stock_status result from v_stock_levels where code='AL2'`, 'low');
await check('RLS enabled on every table',
  `select count(*)::text result from pg_tables t
     where schemaname='public' and not exists (
       select 1 from pg_class c where c.relname=t.tablename and c.relrowsecurity)`, '0');
await check('All 8 views are security_invoker',
  `select count(*)::text result from pg_views v
     where schemaname='public' and v.viewname like 'v\\_%'
       and not exists (select 1 from pg_class c where c.relname=v.viewname
                       and c.reloptions::text like '%security_invoker=on%')`, '0');
await check('Two staff rows seeded',  `select count(*)::text result from staff`, '2');

// ── Trigger behaviour: editing a treatment must move its income row ────────
console.log('\n════ TRIGGER BEHAVIOUR ════');
await c.query(`update treatments set amount = 9999 where id = (select id from treatments limit 1)`);
await check('Editing treatment amount updates the ledger row',
  `select l.amount::int::text result from ledger_entries l
     join treatments t on t.id=l.treatment_id where t.amount=9999 limit 1`, '9999');
await c.query(`delete from treatments where amount = 9999`);
await check('Deleting a treatment cascades its ledger row away',
  `select count(*)::text result from ledger_entries where amount=9999`, '0');

const stockBefore = (await c.query(`select total_qty from v_stock_levels where code='AL1'`)).rows[0].total_qty;
await c.query(`insert into customer_purchases (customer_id, product_id, quantity, amount)
               select (select id from customers limit 1), (select id from products where code='AL1'), 3, 1140`);
const stockAfter = (await c.query(`select total_qty from v_stock_levels where code='AL1'`)).rows[0].total_qty;
console.log(`${stockBefore === stockAfter ? '✅' : '❌'} A product sale does NOT move stock → ${stockBefore} then ${stockAfter}`);
if (stockBefore !== stockAfter) process.exitCode = 1;

// ── RLS actually blocks a non-staff user ───────────────────────────────────
console.log('\n════ RLS ENFORCEMENT ════');
await c.query(`insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','asybeaute@gmail.com'),
  ('22222222-2222-2222-2222-222222222222','stranger@example.com')`);
await c.query(`grant select, insert, update, delete on all tables in schema public to authenticated`);

await c.query(`set role authenticated`);
await c.query(`select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false)`);
const staffRows = (await c.query('select count(*)::int n from customers')).rows[0].n;
await c.query(`select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false)`);
const strangerRows = (await c.query('select count(*)::int n from customers')).rows[0].n;
// The exact query the 分類 dropdown issues. An empty result here is precisely
// what the user experienced as "cannot create a record".
// NB: switch the claim back to Yoyo first — the stranger check above left it
// pointing at the non-allowlisted account.
await c.query(`select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false)`);
const catRows = (await c.query(
  `select count(*)::int n from ledger_categories where is_active`)).rows[0].n;
await c.query(`reset role`);
console.log(`${catRows === 7 ? '✅' : '❌'} Category dropdown query returns ${catRows} rows as an allowlisted user`);
if (catRows !== 7) process.exitCode = 1;
console.log(`${staffRows > 0 ? '✅' : '❌'} Allowlisted user (Yoyo) sees ${staffRows} customers`);
console.log(`${strangerRows === 0 ? '✅' : '❌'} Non-allowlisted user sees ${strangerRows} customers`);
if (staffRows === 0 || strangerRows !== 0) process.exitCode = 1;

// ── Write paths: exactly what the UI forms do ──────────────────────────────
console.log('\n════ WRITE PATHS (mirrors the app forms) ════')

// CustomerForm
const newCust = (await c.query(`
  insert into customers (name, phone, source, instagram, birthday, occupation, tags, remark, status)
  values ('Test Client','9000 0001','Instagram','test.client','1990-01-01','Tester',
          '{VIP,敏感肌}','line one\nline two','active_followup')
  returning id`)).rows[0].id
await check('CustomerForm insert stores free-form tags',
  `select array_length(tags,1)::text result from customers where id='${newCust}'`, '2')

// TreatmentForm — the trigger must generate the timeline AND the income row
const svc = (await c.query(`select id from services where code='areola'`)).rows[0].id
const newTx = (await c.query(`
  insert into treatments (customer_id, service_id, detail, treatment_date, amount,
                          payment_method, pigment_used, remark, rating)
  values ('${newCust}','${svc}','雙側乳暈', current_date, 4680, 'FPS','Areola Mix 2','ok',5)
  returning id`)).rows[0].id
await check('TreatmentForm insert generates 5 follow-up nodes',
  `select count(*)::text result from followup_nodes where treatment_id='${newTx}'`, '5')
await check('TreatmentForm insert creates exactly one income row',
  `select count(*)::text result from ledger_entries where treatment_id='${newTx}'`, '1')
await check('...and that row carries the payment method through',
  `select payment_method result from ledger_entries where treatment_id='${newTx}'`, 'FPS')
await check('TreatmentForm insert backfills first_visit_date',
  `select (first_visit_date is not null)::text result from customers where id='${newCust}'`, 'true')

// PurchaseForm — income row yes, stock movement no
const prod = (await c.query(`select id from products where code='P1'`)).rows[0].id
const stockBeforeBuy = (await c.query(`select total_qty from v_stock_levels where code='P1'`)).rows[0].total_qty
const newBuy = (await c.query(`
  insert into customer_purchases (customer_id, product_id, quantity, amount, payment_method, ship_from, purchase_date)
  values ('${newCust}','${prod}',2,760,'PayMe','home', current_date) returning id`)).rows[0].id
await check('PurchaseForm insert creates a 產品銷售 income row',
  `select category result from ledger_entries where purchase_id='${newBuy}'`, '產品銷售')
const stockAfterBuy = (await c.query(`select total_qty from v_stock_levels where code='P1'`)).rows[0].total_qty
console.log(`${stockBeforeBuy === stockAfterBuy ? '✅' : '❌'} PurchaseForm leaves stock untouched → ${stockBeforeBuy} then ${stockAfterBuy}`)
if (stockBeforeBuy !== stockAfterBuy) process.exitCode = 1

// NodeActions — status transitions drive the derived badge
const node = (await c.query(`
  select id from followup_nodes where treatment_id='${newTx}' and node_type='follow_up' order by sequence limit 1`)).rows[0].id
await c.query(`update followup_nodes set status='contacted', contacted_at=now() where id='${node}'`)
await check('Marking contacted derives the 待回覆 badge',
  `select display_status result from v_followup_board where id='${node}'`, 'awaiting_reply')
await c.query(`update followup_nodes set status='done', completed_at=now() where id='${node}'`)
await check('Marking done derives the 已完成 badge',
  `select display_status result from v_followup_board where id='${node}'`, 'done')

// BookReviewModal — needs service_id on the view, added in migration 0006
await check('v_followup_board exposes service_id for review booking',
  `select (service_id is not null)::text result from v_followup_board where treatment_id='${newTx}' limit 1`, 'true')
const reviewNode = (await c.query(`
  select id, customer_id, service_id from v_followup_board
  where treatment_id='${newTx}' and node_type='review' limit 1`)).rows[0]
await c.query(`
  insert into appointments (customer_id, type, service_id, followup_node_id, starts_at, duration_minutes)
  values ('${reviewNode.customer_id}','review','${reviewNode.service_id}','${reviewNode.id}', now() + interval '3 days', 60)`)
await check('Booking a review flips its node to 已預約',
  `select display_status result from v_followup_board where id='${reviewNode.id}'`, 'booked')

// Editing an amount must move the ledger with it
await c.query(`update treatments set amount = 4200 where id='${newTx}'`)
await check('Editing a treatment amount re-syncs the income row',
  `select amount::int::text result from ledger_entries where treatment_id='${newTx}'`, '4200')

// Cleanup so counts elsewhere stay meaningful
await c.query(`delete from customers where id='${newCust}'`)
await check('Deleting a customer cascades treatments, nodes and ledger rows',
  `select (
     (select count(*) from treatments where customer_id='${newCust}') +
     (select count(*) from ledger_entries where treatment_id='${newTx}') +
     (select count(*) from followup_nodes where treatment_id='${newTx}')
   )::text result`, '0')

// ── Stock take: the delta model the StockAdjustForm relies on ──────────────
console.log('\n════ STOCK TAKE (mirrors StockAdjustForm) ════')

const p1 = (await c.query(`select id from products where code='P1'`)).rows[0].id
const before = (await c.query(`select studio_qty, home_qty, total_qty from v_stock_levels where code='P1'`)).rows[0]

// Counting 7 at Studio when the ledger says 10 must store a delta of -3,
// never an absolute overwrite.
await c.query(`
  insert into stock_movements (product_id, location, delta, reason, note, occurred_on)
  values ('${p1}','studio', ${7 - before.studio_qty}, 'stock_take','count', current_date)`)
await check('Stock take stores a delta, and Studio now reads the counted value',
  `select studio_qty::text result from v_stock_levels where code='P1'`, '7')
await check('...leaving Home untouched',
  `select home_qty::text result from v_stock_levels where code='P1'`, String(before.home_qty))
await check('...and Total recomputed from the movement ledger',
  `select total_qty::text result from v_stock_levels where code='P1'`, String(7 + before.home_qty))

await check('History is preserved rather than overwritten',
  `select (count(*) > 1)::text result from stock_movements where product_id='${p1}' and location='studio'`, 'true')

// Crossing a threshold must flip the badge the Stock page renders
await c.query(`
  insert into stock_movements (product_id, location, delta, reason, occurred_on)
  values ('${p1}','studio', ${-(7 + before.home_qty) + 2}, 'stock_take', current_date)`)
await check('Dropping to 2 flips the product to critical',
  `select stock_status result from v_stock_levels where code='P1'`, 'critical')

// ProductForm insert
await c.query(`
  insert into products (code, name_zh, category, unit, low_stock_threshold, critical_stock_threshold)
  values ('TESTSKU','Test','保養產品','件',5,3)`)
await check('A brand-new product appears with zero stock, flagged critical',
  `select stock_status result from v_stock_levels where code='TESTSKU'`, 'critical')
await c.query(`delete from products where code='TESTSKU'`)

// ── Visit history grouping (customer detail page) ──────────────────────────
console.log('\n════ VISIT HISTORY ════')

await check('Repeat customers exist in the seed, so history is exercised',
  `select (count(*) > 0)::text result from (
     select customer_id from treatments group by customer_id having count(*) > 2
   ) x`, 'true')

const repeat = (await c.query(`
  select customer_id, count(*)::int visits from treatments
  group by customer_id order by visits desc limit 1`)).rows[0]

await check('Every follow-up node maps to exactly one treatment',
  `select count(*)::text result from followup_nodes n
     left join treatments t on t.id = n.treatment_id where t.id is null`, '0')

await check("A repeat customer's nodes span more than one visit",
  `select (count(distinct treatment_id) > 1)::text result
     from v_followup_board where customer_id = '${repeat.customer_id}'`, 'true')

await check('Treatments are orderable newest-first without ties breaking grouping',
  `select (count(*) = count(distinct id))::text result
     from treatments where customer_id = '${repeat.customer_id}'`, 'true')

const spread = (await c.query(`
  select t.id, t.treatment_date, count(n.id)::int nodes
  from treatments t left join followup_nodes n on n.treatment_id = t.id
  where t.customer_id = '${repeat.customer_id}'
  group by t.id order by t.treatment_date desc`)).rows
console.log(`   ↳ busiest client has ${repeat.visits} visits; nodes per visit: ${spread.map(r => r.nodes).join(', ')}`)

// ── Counting both locations in one stock take ─────────────────────────────
console.log('\n════ TWO-LOCATION STOCK TAKE ════')

const b2 = (await c.query(`select id from products where code='B2'`)).rows[0].id
const b2Before = (await c.query(`select studio_qty, home_qty from v_stock_levels where code='B2'`)).rows[0]

// Regression guard: counting Home must not be applied against Studio's
// current quantity. Count Home=10 and Studio unchanged; Studio must not move.
await c.query(`
  insert into stock_movements (product_id, location, delta, reason, occurred_on)
  values ('${b2}','home', ${10 - b2Before.home_qty}, 'stock_take', current_date)`)
await check('Counting Home does not disturb Studio',
  `select studio_qty::text result from v_stock_levels where code='B2'`, String(b2Before.studio_qty))
await check('Home reflects the counted figure',
  `select home_qty::text result from v_stock_levels where code='B2'`, '10')

// Both locations changed in a single take
await c.query(`
  insert into stock_movements (product_id, location, delta, reason, occurred_on)
  values ('${b2}','studio', ${4 - b2Before.studio_qty}, 'stock_take', current_date),
         ('${b2}','home',   ${6 - 10}, 'stock_take', current_date)`)
await check('Both locations settle at their counted values',
  `select (studio_qty || '/' || home_qty) result from v_stock_levels where code='B2'`, '4/6')
await check('Total is the sum of the two counts',
  `select total_qty::text result from v_stock_levels where code='B2'`, '10')

// NOTE: the stock-take note assertions were removed when notes were dropped
// from the inventory UI. products.note and stock_movements.note still exist in
// the schema, unused, so the feature can be restored without a migration.

// ── Ledger page behaviour ─────────────────────────────────────────────────
console.log('\n════ LEDGER ════')

await check('Categories seeded for both directions',
  `select count(*)::text result from ledger_categories where is_active`, '7')
await check('The two trigger-written categories are marked is_system',
  `select count(*)::text result from ledger_categories where is_system`, '2')
await check('Every auto ledger row uses a category that exists in the list',
  `select count(*)::text result from ledger_entries l
     where l.is_auto and not exists (
       select 1 from ledger_categories c
       where c.name_zh = l.category and c.direction = l.direction)`, '0')

// Manual entry, as LedgerEntryForm writes it
const manual = (await c.query(`
  insert into ledger_entries (entry_date, direction, category, item, amount, payment_method, is_auto)
  values (date_trunc('month', current_date)::date, 'expense', '租金', '測試租金', 9000, 'Bank Transfer', false)
  returning id`)).rows[0].id
await check('A manual expense is not flagged auto',
  `select is_auto::text result from ledger_entries where id='${manual}'`, 'false')

// The delete guard the UI relies on
const autoRow = (await c.query(`select id from ledger_entries where is_auto limit 1`)).rows[0].id
await c.query(`delete from ledger_entries where id='${autoRow}' and is_auto = false`)
await check('Deleting with the is_auto guard cannot remove an auto row',
  `select count(*)::text result from ledger_entries where id='${autoRow}'`, '1')
await c.query(`delete from ledger_entries where id='${manual}' and is_auto = false`)
await check('...but does remove a manual row',
  `select count(*)::text result from ledger_entries where id='${manual}'`, '0')

// copyPreviousMonthExpenses must copy manual expenses only
await check('Auto rows are all income, so copying expenses can never duplicate them',
  `select count(*)::text result from ledger_entries where is_auto and direction <> 'income'`, '0')

// Month bucketing used by the page's stat cards
await check('Monthly rollup months are unique',
  `select (count(*) = count(distinct month))::text result from v_monthly_ledger`, 'true')
await check('Rollup income matches summing entries for that month',
  `select (
     (select coalesce(sum(amount),0) from ledger_entries
        where direction='income' and date_trunc('month', entry_date) = date '2026-03-01')
     = (select coalesce(income,0) from v_monthly_ledger where month = date '2026-03-01')
   )::text result`, 'true')

// ── Calendar ──────────────────────────────────────────────────────────────
console.log('\n════ CALENDAR ════')

await check('v_calendar_events unions all three sources',
  `select count(distinct source)::text result from v_calendar_events`, '3')
await check('Every event carries a customer to link through to',
  `select count(*)::text result from v_calendar_events where customer_id is null`, '0')
await check('Appointments have a real duration; follow-ups do not',
  `select count(*)::text result from v_calendar_events
     where (source = 'appointment' and duration_minutes <= 0)
        or (source <> 'appointment' and duration_minutes <> 0)`, '0')
await check('Completed and skipped nodes are excluded from the calendar',
  `select count(*)::text result from v_calendar_events
     where source <> 'appointment' and event_status in ('done','skipped')`, '0')
await check('Booked reviews drop out of the review-window source',
  `select count(*)::text result from v_calendar_events
     where source = 'review_window' and event_status = 'booked'`, '0')

const calSpread = (await c.query(`
  select source, count(*)::int n from v_calendar_events group by source order by n desc`)).rows
console.log('   ↳ ' + calSpread.map(r => `${r.source}: ${r.n}`).join(', '))

const overdueN = (await c.query(`
  select count(*)::int n from v_calendar_events where event_status = 'overdue'`)).rows[0].n
console.log(`   ↳ overdue events surfaced in the right rail: ${overdueN}`)

await c.end();
await pg.stop();
console.log(process.exitCode ? '\n🔴 FAILURES ABOVE' : '\n🟢 ALL CHECKS PASSED');
