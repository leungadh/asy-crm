/** Hand-maintained mirror of supabase/migrations. Regenerate with:
 *  supabase gen types typescript --linked > src/types/database.ts        */

export type CustomerStatus = 'active_followup' | 'pending_review' | 'dormant' | 'completed'
export type TreatmentStatus = 'in_progress' | 'completed'
export type NodeType = 'follow_up' | 'review'
export type NodeStatus = 'pending' | 'contacted' | 'replied' | 'booked' | 'done' | 'skipped'
export type StockLocation = 'studio' | 'home'

/** Derived in v_followup_board — never stored. */
export type DisplayStatus =
  | 'not_due' | 'due' | 'overdue' | 'awaiting_reply'
  | 'replied' | 'pending_booking' | 'booked' | 'done' | 'skipped'

export interface Customer {
  id: string
  name: string
  phone: string | null
  source: string | null
  instagram: string | null
  birthday: string | null
  occupation: string | null
  first_visit_date: string | null
  tags: string[]
  remark: string | null
  status: CustomerStatus
  created_at: string
  updated_at: string
}

export interface CustomerSummary extends Customer {
  visit_count: number | null
  last_visit_date: string | null
  treatment_total: string | null
  purchase_total: string | null
  lifetime_value: string | null
  avg_rating: string | null
  last_service_zh: string | null
  last_detail: string | null
  days_since_last_visit: number | null
  is_new: boolean | null
  is_lapsed: boolean | null
  next_followup_at: string | null
  next_followup_label: string | null
  next_followup_status: DisplayStatus | null
}

export interface Service {
  id: string
  code: 'areola' | 'vio' | 'lip' | 'body'
  name_zh: string
  name_en: string
  accent: string
  sort_order: number
  is_active: boolean
}

export interface Treatment {
  id: string
  customer_id: string
  service_id: string
  detail: string | null
  treatment_date: string
  amount: string
  payment_method: string | null
  pigment_used: string | null
  remark: string | null
  rating: number | null
  status: TreatmentStatus
  created_at: string
}

export interface FollowupBoardRow {
  id: string
  treatment_id: string
  sequence: number
  label_zh: string
  label_en: string
  node_type: NodeType
  due_at: string
  due_date: string
  window_end_date: string | null
  status: NodeStatus
  note: string | null
  contacted_at: string | null
  completed_at: string | null
  customer_id: string
  customer_name: string
  customer_phone: string | null
  customer_tags: string[]
  service_code: string
  service_name: string
  detail: string | null
  treatment_date: string
  display_status: DisplayStatus
}

export interface DashboardStats {
  total_customers: number
  active_followup: number
  pending_review: number
  dormant: number
  new_customers: number
  treatments_this_month: number
  income_this_month: string
  expense_this_month: string
  overdue_followups: number
  due_followups: number
  products_needing_restock: number
}

export interface CustomerPurchase {
  id: string
  customer_id: string
  product_id: string
  quantity: number
  amount: string
  ship_from: StockLocation
  purchase_date: string
  note: string | null
}
