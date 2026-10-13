import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CustomerSummary, FollowupBoardRow, Treatment, Service, Product } from '@/types/database'

interface State<T> { data: T | null; loading: boolean; error: string | null }

export function useCustomerList() {
  const [state, setState] = useState<State<CustomerSummary[]>>({ data: null, loading: true, error: null })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('v_customer_summary')
      .select('*')
      .order('last_visit_date', { ascending: false, nullsFirst: false })
      .then(({ data, error }) => {
        if (cancelled) return
        setState({ data: (data ?? []) as CustomerSummary[], loading: false, error: error?.message ?? null })
      })
    return () => { cancelled = true }
  }, [tick])

  return { ...state, refetch: () => setTick((n) => n + 1) }
}

export function useServices() {
  const [services, setServices] = useState<Service[]>([])
  useEffect(() => {
    supabase.from('services').select('*').order('sort_order')
      .then(({ data }) => setServices((data ?? []) as Service[]))
  }, [])
  return services
}

export interface CustomerDetailData {
  customer: CustomerSummary
  treatments: (Treatment & { service: Pick<Service, 'name_zh' | 'name_en' | 'code' | 'accent'> })[]
  nodes: FollowupBoardRow[]
  purchases: { id: string; quantity: number; amount: string; ship_from: string; purchase_date: string;
               note: string | null; product: { code: string } }[]
  /** 回診 bookings, which live on `appointments` rather than `treatments`.
   *  Only `status = 'scheduled'` is fetched — completed, cancelled and no-show
   *  bookings are history, and the follow-up node records their outcome. A
   *  past-dated row that is still 'scheduled' is deliberately NOT filtered out:
   *  it means nobody closed it off, and hiding it would make that invisible. */
  appointments: {
    id: string
    type: string
    starts_at: string
    duration_minutes: number
    notes: string | null
    status: string
    service: Pick<Service, 'name_zh' | 'name_en' | 'code' | 'accent'> | null
  }[]
}

export function useCustomerDetail(id: string | undefined) {
  const [state, setState] = useState<State<CustomerDetailData>>({ data: null, loading: true, error: null })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      const [c, t, n, p, a] = await Promise.all([
        supabase.from('v_customer_summary').select('*').eq('id', id).maybeSingle(),
        supabase.from('treatments')
          .select('*, service:services(name_zh, name_en, code, accent)')
          .eq('customer_id', id).order('treatment_date', { ascending: false }),
        supabase.from('v_followup_board').select('*')
          .eq('customer_id', id).order('due_at'),
        supabase.from('customer_purchases')
          .select('id, quantity, amount, ship_from, purchase_date, note, product:products(code)')
          .eq('customer_id', id).order('purchase_date', { ascending: false }),
        supabase.from('appointments')
          .select('id, type, starts_at, duration_minutes, notes, status,'
                + ' service:services(name_zh, name_en, code, accent)')
          .eq('customer_id', id).eq('status', 'scheduled').order('starts_at'),
      ])

      if (cancelled) return
      const error = c.error?.message ?? t.error?.message ?? n.error?.message
                 ?? p.error?.message ?? a.error?.message ?? null
      if (error || !c.data) { setState({ data: null, loading: false, error: error ?? 'Not found' }); return }

      setState({
        data: {
          customer: c.data as CustomerSummary,
          treatments: (t.data ?? []) as CustomerDetailData['treatments'],
          nodes: (n.data ?? []) as FollowupBoardRow[],
          purchases: (p.data ?? []) as unknown as CustomerDetailData['purchases'],
          appointments: (a.data ?? []) as unknown as CustomerDetailData['appointments'],
        },
        loading: false, error: null,
      })
    }

    load()
    return () => { cancelled = true }
  }, [id, tick])

  return { ...state, refetch: () => setTick((n) => n + 1) }
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  useEffect(() => {
    supabase.from('products').select('id, code, name_zh, unit')
      .eq('is_active', true).order('sort_order')
      .then(({ data }) => setProducts((data ?? []) as Product[]))
  }, [])
  return products
}
