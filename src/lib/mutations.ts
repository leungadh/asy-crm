import { supabase } from '@/lib/supabase'
import type { CustomerStatus, NodeStatus, StockLocation } from '@/types/database'

/** Empty strings from form inputs must become NULL, not ''. */
const nz = (v: string | null | undefined) => {
  const s = (v ?? '').trim()
  return s === '' ? null : s
}

export interface CustomerInput {
  name: string
  phone?: string
  source?: string
  instagram?: string
  birthday?: string
  occupation?: string
  tags: string[]
  remark?: string
  status: CustomerStatus
}

export async function saveCustomer(input: CustomerInput, id?: string) {
  const row = {
    name: input.name.trim(),
    phone: nz(input.phone),
    source: nz(input.source),
    instagram: nz(input.instagram),
    birthday: nz(input.birthday),
    occupation: nz(input.occupation),
    tags: input.tags,
    remark: nz(input.remark),
    status: input.status,
  }

  const q = id
    ? supabase.from('customers').update(row).eq('id', id).select('id').single()
    : supabase.from('customers').insert(row).select('id').single()

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data.id as string
}

/** Status is a judgement call Yoyo makes (沉睡客 vs 已完成 is never derived), so
 *  it gets a one-field update of its own rather than requiring the whole edit
 *  form to be opened and re-saved. */
export async function setCustomerStatus(id: string, status: CustomerStatus) {
  const { error } = await supabase.from('customers').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

/** What a delete would take with it. Every one of these cascades, including the
 *  income rows behind the treatments and purchases — so a month's revenue in
 *  統計報表 changes retroactively. Yoyo sees these numbers before confirming;
 *  guessing at them is how a real client gets deleted instead of a test one. */
export interface CustomerImpact {
  treatments: number
  bookings: number
  purchases: number
  appointments: number
  /** Income that genuinely disappears — only rows cascading via treatment_id or
   *  purchase_id. */
  income: number
  /** Manually-entered ledger rows tagged to this customer. These do NOT cascade
   *  (`customer_id` is `on delete set null`): the money stays in the reports and
   *  only loses its name. Counted separately so the figure above stays honest. */
  detachedEntries: number
}

export async function getCustomerImpact(id: string): Promise<CustomerImpact> {
  const [tx, purch, appt, led] = await Promise.all([
    supabase.from('treatments').select('id, status').eq('customer_id', id),
    supabase.from('customer_purchases').select('id').eq('customer_id', id),
    supabase.from('appointments').select('id').eq('customer_id', id),
    supabase.from('ledger_entries')
      .select('amount, direction, treatment_id, purchase_id').eq('customer_id', id),
  ])

  const err = tx.error ?? purch.error ?? appt.error ?? led.error
  if (err) throw new Error(err.message)

  const rows = tx.data ?? []
  const ledger = led.data ?? []
  const cascades = (r: { treatment_id: string | null; purchase_id: string | null }) =>
    r.treatment_id !== null || r.purchase_id !== null

  return {
    treatments:   rows.filter((r) => r.status !== 'scheduled').length,
    bookings:     rows.filter((r) => r.status === 'scheduled').length,
    purchases:    (purch.data ?? []).length,
    appointments: (appt.data ?? []).length,
    income: ledger
      .filter((r) => r.direction === 'income' && cascades(r))
      .reduce((sum, r) => sum + Number(r.amount ?? 0), 0),
    detachedEntries: ledger.filter((r) => !cascades(r)).length,
  }
}

/** Hard delete. There is no undo short of restoring a backup, which is why the
 *  UI requires the customer's name to be typed first.
 *
 *  Deliberately NOT a soft delete: the point is removing test records, and an
 *  archived fake client would leave its fake revenue sitting in the reports. */
export async function deleteCustomer(id: string) {
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export interface TreatmentInput {
  customer_id: string
  service_id: string
  detail?: string
  treatment_date: string
  start_time?: string
  duration_minutes: number
  /** Null while the treatment is only booked. */
  amount: number | null
  payment_method?: string
  pigment_used?: string
  remark?: string
  rating: number | null
  status: 'scheduled' | 'in_progress'
}

/** Inserting a PERFORMED treatment fires two database triggers: the follow-up
 *  timeline is generated from followup_rules, and a 療程收入 ledger row is
 *  created. Neither is done here — doing it client-side would double up.
 *  A booking (status 'scheduled') deliberately triggers neither. */
export async function createTreatment(input: TreatmentInput, staffId?: string) {
  const { data, error } = await supabase
    .from('treatments')
    .insert({
      customer_id: input.customer_id,
      service_id: input.service_id,
      detail: nz(input.detail),
      treatment_date: input.treatment_date,
      start_time: nz(input.start_time),
      duration_minutes: input.duration_minutes,
      amount: input.amount,
      payment_method: nz(input.payment_method),
      pigment_used: nz(input.pigment_used),
      remark: nz(input.remark),
      rating: input.rating,
      status: input.status,
      created_by: staffId ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id as string
}

export interface PurchaseInput {
  customer_id: string
  product_id: string
  quantity: number
  amount: number
  payment_method?: string
  ship_from: StockLocation
  purchase_date: string
  note?: string
}

/** Creates a 產品銷售 income row via trigger. Deliberately does NOT move
 *  stock — stock is manual stock-take only. */
export async function createPurchase(input: PurchaseInput, staffId?: string) {
  const { error } = await supabase.from('customer_purchases').insert({
    customer_id: input.customer_id,
    product_id: input.product_id,
    quantity: input.quantity,
    amount: input.amount,
    payment_method: nz(input.payment_method),
    ship_from: input.ship_from,
    purchase_date: input.purchase_date,
    note: nz(input.note),
    created_by: staffId ?? null,
  })
  if (error) throw new Error(error.message)
}

/** Timestamps are set here because the schema does not infer them — the node
 *  status enum records the action taken, and the action has a time. */
export async function updateNodeStatus(nodeId: string, status: NodeStatus, note?: string | null) {
  const patch: Record<string, unknown> = { status }
  if (note !== undefined) patch.note = nz(note)

  if (status === 'contacted') patch.contacted_at = new Date().toISOString()
  if (status === 'done') patch.completed_at = new Date().toISOString()
  if (status === 'pending') { patch.contacted_at = null; patch.completed_at = null }

  const { error } = await supabase.from('followup_nodes').update(patch).eq('id', nodeId)
  if (error) throw new Error(error.message)
}

/** Booking flips the source node to 'booked' via the appointments trigger. */
export async function bookReview(args: {
  customer_id: string
  service_id: string
  followup_node_id: string
  starts_at: string
  notes?: string
}, staffId?: string) {
  const { error } = await supabase.from('appointments').insert({
    customer_id: args.customer_id,
    type: 'review',
    service_id: args.service_id,
    followup_node_id: args.followup_node_id,
    starts_at: args.starts_at,
    duration_minutes: 60,
    notes: nz(args.notes),
    created_by: staffId ?? null,
  })
  if (error) throw new Error(error.message)
}

/** Stock is a movement ledger, so a stock take is recorded as the DIFFERENCE
 *  between what was counted and what the ledger currently says — never as an
 *  absolute overwrite. That preserves history and stays correct if two counts
 *  race. A zero delta writes nothing (the column has a `delta <> 0` check). */
export async function recordStockCount(args: {
  product_id: string
  location: StockLocation
  currentQty: number
  countedQty: number
  reason: 'stock_take' | 'purchase_in' | 'sale_out' | 'adjustment'
  occurred_on: string
}, staffId?: string) {
  const delta = args.countedQty - args.currentQty
  if (delta === 0) return { changed: false, delta }

  const { error } = await supabase.from('stock_movements').insert({
    product_id: args.product_id,
    location: args.location,
    delta,
    reason: args.reason,
    occurred_on: args.occurred_on,
    created_by: staffId ?? null,
  })
  if (error) throw new Error(error.message)
  return { changed: true, delta }
}

export interface ProductInput {
  code: string
  name_zh: string
  category: string
  unit: string
  low_stock_threshold: number
  critical_stock_threshold: number
}

export async function saveProduct(input: ProductInput, id?: string) {
  const row = { ...input }
  const q = id
    ? supabase.from('products').update(row).eq('id', id).select('id').single()
    : supabase.from('products').insert(row).select('id').single()
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data.id as string
}

export interface LedgerEntryInput {
  entry_date: string
  direction: 'income' | 'expense'
  category: string
  item: string
  amount: number
  payment_method?: string
  note?: string
}

/** Manual entries only. Rows with is_auto = true belong to a treatment or
 *  purchase and must be edited at their source, or the ledger and the
 *  treatment record silently disagree. */
export async function saveLedgerEntry(input: LedgerEntryInput, id?: string, staffId?: string) {
  const row = {
    entry_date: input.entry_date,
    direction: input.direction,
    category: input.category,
    item: input.item.trim(),
    amount: input.amount,
    payment_method: nz(input.payment_method),
    note: nz(input.note),
    is_auto: false,
    created_by: staffId ?? null,
  }

  const q = id
    ? supabase.from('ledger_entries').update(row).eq('id', id).eq('is_auto', false).select('id').single()
    : supabase.from('ledger_entries').insert(row).select('id').single()

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data.id as string
}

export async function deleteLedgerEntry(id: string) {
  // The is_auto guard is repeated here so a stray call cannot delete a row
  // that a treatment still owns.
  const { error } = await supabase
    .from('ledger_entries').delete().eq('id', id).eq('is_auto', false)
  if (error) throw new Error(error.message)
}

/** Duplicates the previous month's MANUAL expenses into the target month,
 *  keeping the day of month where possible. Auto rows are excluded: they are
 *  generated by treatments and copying them would invent income. */
export async function copyPreviousMonthExpenses(
  fromMonth: string, toMonth: string, staffId?: string,
) {
  const [fy, fm] = fromMonth.split('-').map(Number)
  const fromStart = new Date(Date.UTC(fy, fm - 1, 1)).toISOString().slice(0, 10)
  const fromEnd = new Date(Date.UTC(fy, fm, 0)).toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('ledger_entries')
    .select('entry_date, direction, category, item, amount, payment_method, note')
    .eq('direction', 'expense')
    .eq('is_auto', false)
    .gte('entry_date', fromStart)
    .lte('entry_date', fromEnd)

  if (error) throw new Error(error.message)
  if (!data?.length) return { copied: 0 }

  const [ty, tm] = toMonth.split('-').map(Number)
  const daysInTarget = new Date(Date.UTC(ty, tm, 0)).getUTCDate()

  const rows = data.map((r) => {
    const day = Math.min(Number(r.entry_date.slice(8, 10)), daysInTarget)
    return {
      ...r,
      entry_date: `${toMonth}-${String(day).padStart(2, '0')}`,
      is_auto: false,
      created_by: staffId ?? null,
    }
  })

  const { error: insErr } = await supabase.from('ledger_entries').insert(rows)
  if (insErr) throw new Error(insErr.message)
  return { copied: rows.length }
}


export interface CompleteTreatmentInput {
  amount: number
  payment_method?: string
  pigment_used?: string
  remark?: string
  rating: number | null
  treatment_date?: string
}

/** Turns a booking into a performed treatment. The status change is what
 *  makes the database generate the follow-up timeline and the income row, so
 *  it must be part of this single update. */
export async function completeTreatment(id: string, input: CompleteTreatmentInput) {
  const patch: Record<string, unknown> = {
    status: 'in_progress',
    amount: input.amount,
    payment_method: nz(input.payment_method),
    pigment_used: nz(input.pigment_used),
    remark: nz(input.remark),
    rating: input.rating,
  }
  if (input.treatment_date) patch.treatment_date = input.treatment_date

  const { error } = await supabase.from('treatments').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function rescheduleTreatment(
  id: string, treatment_date: string, start_time: string | null, duration_minutes: number,
) {
  const { error } = await supabase
    .from('treatments')
    .update({ treatment_date, start_time: nz(start_time ?? undefined), duration_minutes })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function cancelBooking(id: string) {
  // Only a booking can be deleted outright. A performed treatment carries a
  // follow-up timeline and an income row, so it goes through deleteTreatment()
  // below, which shows what it is about to destroy first.
  const { error } = await supabase
    .from('treatments').delete().eq('id', id).eq('status', 'scheduled')
  if (error) throw new Error(error.message)
}

export interface EditTreatmentInput {
  service_id: string
  detail?: string
  treatment_date: string
  start_time?: string
  duration_minutes: number
  amount: number | null
  payment_method?: string
  pigment_used?: string
  remark?: string
}

/** Edits a treatment that has already been performed.
 *
 *  Two database triggers react to this and neither is invoked here:
 *  - the ledger trigger re-syncs the income row (it watches treatment_date,
 *    amount, payment_method and service_id);
 *  - 0016's trigger shifts any follow-up node still `pending` by the same
 *    number of days the date moved, leaving actioned nodes alone.
 *
 *  `status` is deliberately absent. Moving between scheduled and performed is
 *  what completeTreatment() is for, and letting it be edited here would fire
 *  timeline generation as a side effect of fixing a typo. */
export async function updateTreatment(id: string, input: EditTreatmentInput) {
  const { error } = await supabase
    .from('treatments')
    .update({
      service_id: input.service_id,
      detail: nz(input.detail),
      treatment_date: input.treatment_date,
      start_time: nz(input.start_time),
      duration_minutes: input.duration_minutes,
      amount: input.amount,
      payment_method: nz(input.payment_method),
      pigment_used: nz(input.pigment_used),
      remark: nz(input.remark),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export interface TreatmentImpact {
  amount: number | null
  incomeRows: number
  nodes: number
  /** Follow-up nodes Yoyo has already acted on. Losing these loses a record of
   *  contact that actually happened, which is worth saying out loud. */
  actionedNodes: number
}

export async function getTreatmentImpact(id: string): Promise<TreatmentImpact> {
  const [tx, nodes, led] = await Promise.all([
    supabase.from('treatments').select('amount').eq('id', id).maybeSingle(),
    supabase.from('followup_nodes').select('status').eq('treatment_id', id),
    supabase.from('ledger_entries').select('id').eq('treatment_id', id),
  ])

  const err = tx.error ?? nodes.error ?? led.error
  if (err) throw new Error(err.message)

  const rows = nodes.data ?? []
  return {
    amount: tx.data?.amount != null ? Number(tx.data.amount) : null,
    incomeRows: (led.data ?? []).length,
    nodes: rows.length,
    actionedNodes: rows.filter((n) => n.status !== 'pending').length,
  }
}

/** Deletes a treatment whatever its status, taking its follow-up timeline and
 *  its income row with it (both cascade). No undo short of a backup restore,
 *  so the UI shows the impact above before calling this. */
export async function deleteTreatment(id: string) {
  const { error } = await supabase.from('treatments').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** The open 回診 node for a customer, if there is one.
 *
 *  Used after recording a 回診 treatment: the visit has happened, so the node
 *  planning it is almost certainly complete. Almost — hence an offer, not an
 *  automatic write. */
export async function findOpenReviewNode(customerId: string) {
  const { data, error } = await supabase
    .from('v_followup_board')
    .select('id, label_zh, label_en, due_date')
    .eq('customer_id', customerId)
    .eq('node_type', 'review')
    .not('display_status', 'in', '("done","skipped")')
    .order('due_at')
    .limit(1)
  if (error) throw new Error(error.message)
  return data?.[0] ?? null
}

export async function saveAppSetting(key: string, value: number) {
  // app_settings.value is jsonb; a bare JSON number is valid jsonb.
  const { error } = await supabase.from('app_settings').update({ value }).eq('key', key)
  if (error) throw new Error(error.message)
}

export async function createLedgerCategory(input: {
  direction: 'income' | 'expense'
  name_zh: string
  name_en: string
}) {
  const { error } = await supabase.from('ledger_categories').insert({
    direction: input.direction,
    name_zh: input.name_zh.trim(),
    name_en: (input.name_en.trim() || input.name_zh.trim()),
    sort_order: 99,
  })
  if (error) throw new Error(error.message)
}

/** Renames the category AND its historical ledger rows in one transaction.
 *  ledger_entries stores the category name as text, so renaming the row alone
 *  would leave old entries pointing at a name that no longer exists. */
export async function renameLedgerCategory(id: string, nameZh: string, nameEn: string) {
  const { error } = await supabase.rpc('rename_ledger_category', {
    p_id: id,
    p_new_name_zh: nameZh,
    p_new_name_en: nameEn,
  })
  if (error) throw new Error(error.message)
}

/** Hide rather than delete: historical entries keep referring to the name. */
export async function setLedgerCategoryActive(id: string, isActive: boolean) {
  const { error } = await supabase
    .from('ledger_categories').update({ is_active: isActive })
    .eq('id', id).eq('is_system', false)
  if (error) throw new Error(error.message)
}
