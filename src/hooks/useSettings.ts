import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { LedgerCategory } from '@/types/database'

/** The four numbers that quietly drive badges across the app. */
export const TUNABLE_KEYS = [
  'dormant_after_days',
  'new_customer_days',
  'followup_reminder_hour',
  'overdue_grace_days',
] as const

export type TunableKey = (typeof TUNABLE_KEYS)[number]

export function useAppSettings() {
  const [values, setValues] = useState<Record<string, number> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    supabase.from('app_settings').select('key, value')
      .in('key', TUNABLE_KEYS as unknown as string[])
      .then(({ data, error }) => {
        if (cancelled) return
        const out: Record<string, number> = {}
        for (const row of data ?? []) out[row.key] = Number(row.value)
        setValues(out)
        setError(error?.message ?? null)
      })
    return () => { cancelled = true }
  }, [tick])

  return { values, error, loading: values === null && !error, refetch: () => setTick((n) => n + 1) }
}

/** Includes inactive rows, which the ledger form's hook deliberately excludes. */
export function useAllLedgerCategories() {
  const [rows, setRows] = useState<LedgerCategory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    supabase.from('ledger_categories').select('*').order('direction').order('sort_order')
      .then(({ data, error }) => {
        if (cancelled) return
        setRows((data ?? []) as LedgerCategory[])
        setError(error?.message ?? null)
      })
    return () => { cancelled = true }
  }, [tick])

  return { rows, error, refetch: () => setTick((n) => n + 1) }
}
