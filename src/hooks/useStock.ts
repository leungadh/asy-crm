import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { StockLevel, TreatmentRow, FollowupBoardRow, StockMovement } from '@/types/database'

export function useStockLevels() {
  const [data, setData] = useState<StockLevel[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    supabase.from('v_stock_levels').select('*').then(({ data, error }) => {
      if (cancelled) return
      setData((data ?? []) as StockLevel[])
      setError(error?.message ?? null)
    })
    return () => { cancelled = true }
  }, [tick])

  return {
    data, error,
    loading: data === null && !error,
    refetch: () => setTick((n) => n + 1),
    refreshKey: tick,
  }
}

/** All movements, newest first. Grouped per product by the Stock page so the
 *  note recorded during a stock take is actually visible somewhere — it lives
 *  on stock_movements, not on products. */
export function useStockMovements(refreshKey: number) {
  const [rows, setRows] = useState<StockMovement[]>([])

  useEffect(() => {
    let cancelled = false
    supabase
      .from('stock_movements')
      .select('id, product_id, location, delta, reason, note, occurred_on, created_at, staff:staff(display_name)')
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setRows((data ?? []) as unknown as StockMovement[])
      })
    return () => { cancelled = true }
  }, [refreshKey])

  return rows
}

export function useTreatments() {
  const [rows, setRows] = useState<TreatmentRow[] | null>(null)
  const [nodes, setNodes] = useState<FollowupBoardRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('treatments')
        .select('*, customer:customers(id, name, phone), service:services(code, name_zh, name_en, accent)')
        .order('treatment_date', { ascending: false }),
      supabase.from('v_followup_board').select('*'),
    ]).then(([t, n]) => {
      if (cancelled) return
      setRows((t.data ?? []) as unknown as TreatmentRow[])
      setNodes((n.data ?? []) as FollowupBoardRow[])
      setError(t.error?.message ?? n.error?.message ?? null)
    })
    return () => { cancelled = true }
  }, [tick])

  return { rows, nodes, error, loading: rows === null && !error, refetch: () => setTick((n) => n + 1) }
}
