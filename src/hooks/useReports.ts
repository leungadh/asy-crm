import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  MonthlyLedger, MonthlyServiceRevenue, MonthlyCustomerStats,
  FollowupSummary, ReviewRate, CustomerSource,
} from '@/types/database'

interface Reports {
  monthly: MonthlyLedger[]
  services: MonthlyServiceRevenue[]
  customers: MonthlyCustomerStats[]
  followups: FollowupSummary | null
  reviewRate: ReviewRate | null
  sources: CustomerSource[]
}

export function useReports() {
  const [data, setData] = useState<Reports | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      supabase.from('v_monthly_ledger').select('*').order('month'),
      supabase.from('v_monthly_service_revenue').select('*').order('month'),
      supabase.from('v_monthly_customer_stats').select('*').order('month'),
      supabase.from('v_followup_summary').select('*').maybeSingle(),
      supabase.from('v_review_rate').select('*').maybeSingle(),
      supabase.from('v_customer_sources').select('*'),
    ]).then(([m, s, cst, f, r, src]) => {
      if (cancelled) return
      const firstError = [m, s, cst, f, r, src].find((x) => x.error)?.error
      setError(firstError?.message ?? null)
      setData({
        monthly: (m.data ?? []) as MonthlyLedger[],
        services: (s.data ?? []) as MonthlyServiceRevenue[],
        customers: (cst.data ?? []) as MonthlyCustomerStats[],
        followups: (f.data ?? null) as FollowupSummary | null,
        reviewRate: (r.data ?? null) as ReviewRate | null,
        sources: (src.data ?? []) as CustomerSource[],
      })
    })

    return () => { cancelled = true }
  }, [])

  return { data, error, loading: data === null && !error }
}
