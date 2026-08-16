import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { LedgerEntry, LedgerCategory, MonthlyLedger } from '@/types/database'

/** First and last day of a YYYY-MM string, as ISO dates. */
export function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 0))
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

export function previousMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return d.toISOString().slice(0, 7)
}

export function useLedger(month: string) {
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null)
  const [monthly, setMonthly] = useState<MonthlyLedger[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    const { start, end } = monthBounds(month)

    Promise.all([
      supabase.from('ledger_entries').select('*')
        .gte('entry_date', start).lte('entry_date', end)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('v_monthly_ledger').select('*'),
    ]).then(([e, m]) => {
      if (cancelled) return
      setEntries((e.data ?? []) as LedgerEntry[])
      setMonthly((m.data ?? []) as MonthlyLedger[])
      setError(e.error?.message ?? m.error?.message ?? null)
    })

    return () => { cancelled = true }
  }, [month, tick])

  return {
    entries, monthly, error,
    loading: entries === null && !error,
    refetch: () => setTick((n) => n + 1),
  }
}

export function useLedgerCategories() {
  const [rows, setRows] = useState<LedgerCategory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase.from('ledger_categories').select('*')
      .eq('is_active', true).order('direction').order('sort_order')
      .then(({ data, error }) => {
        if (cancelled) return
        // Discarding this error made a missing table, an RLS denial and an
        // empty list all look identical: a silently empty dropdown.
        setRows((data ?? []) as LedgerCategory[])
        setError(error?.message ?? null)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return useMemo(() => ({
    all: rows,
    income: rows.filter((r) => r.direction === 'income'),
    expense: rows.filter((r) => r.direction === 'expense'),
    error,
    loading,
  }), [rows, error, loading])
}

/** Months present in the data, newest first, for the month picker. */
export function useAvailableMonths(monthly: MonthlyLedger[]) {
  return useMemo(() => {
    const set = new Set(monthly.map((m) => m.month.slice(0, 7)))
    set.add(new Date().toISOString().slice(0, 7))
    return [...set].sort().reverse()
  }, [monthly])
}
