import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CalendarEvent } from '@/types/database'

/** Local YYYY-MM-DD. Using toISOString here would bucket late-evening Hong
 *  Kong appointments into the next day, since ISO is UTC. */
export function localDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA')
}

export function todayKey(): string {
  return new Date().toLocaleDateString('en-CA')
}

/** Monday-first grid covering the whole month plus the padding days needed to
 *  fill complete weeks. */
export function monthGrid(month: string): string[] {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const offset = (first.getDay() + 6) % 7          // Mon = 0
  const start = new Date(y, m - 1, 1 - offset)

  const days: string[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d.toLocaleDateString('en-CA'))
    // Stop after the week that contains the last day of the month.
    if (i >= 27 && d.getMonth() !== m - 1 && (i + 1) % 7 === 0) break
  }
  return days
}

export function useCalendar(month: string) {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    const grid = monthGrid(month)
    // Widen by a day each side so timezone edges cannot clip an event.
    const from = `${grid[0]}T00:00:00.000Z`
    const to = `${grid[grid.length - 1]}T23:59:59.999Z`

    supabase.from('v_calendar_events').select('*')
      .gte('event_at', from).lte('event_at', to)
      .order('event_at')
      .then(({ data, error }) => {
        if (cancelled) return
        setEvents((data ?? []) as CalendarEvent[])
        setError(error?.message ?? null)
      })

    return () => { cancelled = true }
  }, [month, tick])

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events ?? []) {
      const k = localDay(e.event_at)
      const list = map.get(k) ?? []
      list.push(e)
      map.set(k, list)
    }
    return map
  }, [events])

  return {
    events, byDay, error,
    loading: events === null && !error,
    refetch: () => setTick((n) => n + 1),
  }
}

/** Everything still outstanding, independent of the month being viewed —
 *  an overdue follow-up from March matters in August. */
export function useOutstanding() {
  const [rows, setRows] = useState<CalendarEvent[]>([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    supabase.from('v_calendar_events').select('*')
      .in('event_status', ['overdue', 'due', 'pending_booking', 'awaiting_reply'])
      .order('event_at')
      .then(({ data }) => { if (!cancelled) setRows((data ?? []) as CalendarEvent[]) })
    return () => { cancelled = true }
  }, [tick])

  return { rows, refetch: () => setTick((n) => n + 1) }
}
