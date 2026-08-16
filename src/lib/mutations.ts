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

export interface TreatmentInput {
  customer_id: string
  service_id: string
  detail?: string
  treatment_date: string
  amount: number
  payment_method?: string
  pigment_used?: string
  remark?: string
  rating: number | null
}

/** Inserting fires two database triggers: the follow-up timeline is generated
 *  from followup_rules, and a 療程收入 ledger row is created. Neither is done
 *  here — doing it client-side would double up. */
export async function createTreatment(input: TreatmentInput, staffId?: string) {
  const { data, error } = await supabase
    .from('treatments')
    .insert({
      customer_id: input.customer_id,
      service_id: input.service_id,
      detail: nz(input.detail),
      treatment_date: input.treatment_date,
      amount: input.amount,
      payment_method: nz(input.payment_method),
      pigment_used: nz(input.pigment_used),
      remark: nz(input.remark),
      rating: input.rating,
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
  note?: string
  occurred_on: string
}, staffId?: string) {
  const delta = args.countedQty - args.currentQty
  if (delta === 0) return { changed: false, delta }

  const { error } = await supabase.from('stock_movements').insert({
    product_id: args.product_id,
    location: args.location,
    delta,
    reason: args.reason,
    note: nz(args.note),
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
  note?: string
}

export async function saveProduct(input: ProductInput, id?: string) {
  const row = { ...input, note: nz(input.note) }
  const q = id
    ? supabase.from('products').update(row).eq('id', id).select('id').single()
    : supabase.from('products').insert(row).select('id').single()
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data.id as string
}
