import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, MessageCircle, AlertTriangle } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, Spinner, type BadgeTone } from '@/components/ui'
import { useCalendar, useOutstanding, monthGrid, localDay, todayKey } from '@/hooks/useCalendar'
import { useI18n } from '@/i18n'
import { cn, waLink } from '@/lib/utils'
import type { CalendarEvent } from '@/types/database'

type Filter = 'all' | 'treatment' | 'follow_up' | 'review' | 'overdue'

const typeTone: Record<string, BadgeTone> = {
  treatment: 'rose', follow_up: 'violet', review: 'amber',
}

/** End time, so the grid shows chair time rather than just arrival. */
function timeRange(iso: string, minutes: number): string {
  const start = new Date(iso)
  const end = new Date(start.getTime() + minutes * 60_000)
  const f = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return minutes > 0 ? `${f(start)}–${f(end)}` : f(start)
}

/** Overdue is a status, not a type, so it wins over the type colour. */
function tone(e: CalendarEvent): BadgeTone {
  if (e.event_status === 'overdue') return 'red'
  // Treatment rows carry treatment_status, not node status.
  if (e.event_status === 'done' || e.event_status === 'completed') return 'emerald'
  if (e.event_status === 'in_progress') return 'emerald'
  return typeTone[e.event_type] ?? 'slate'
}

const dotClass: Record<BadgeTone, string> = {
  rose: 'bg-rose-400', violet: 'bg-violet-400', amber: 'bg-amber-400',
  red: 'bg-red-500', emerald: 'bg-emerald-500', pink: 'bg-pink-400',
  sky: 'bg-sky-400', slate: 'bg-slate-400',
}

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

const monthOf = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + by, 1)
  return monthOf(d)
}

export default function Calendar() {
  const { t } = useI18n()
  const [month, setMonth] = useState(monthOf())
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = useState<'month' | 'list'>('month')

  const { events, byDay, loading, error } = useCalendar(month)
  const { rows: outstanding } = useOutstanding()

  const today = todayKey()
  const grid = useMemo(() => monthGrid(month), [month])

  const passes = (e: CalendarEvent) => {
    if (filter === 'all') return true
    if (filter === 'overdue') return e.event_status === 'overdue'
    return e.event_type === filter
  }

  const todays = (byDay.get(today) ?? []).filter(passes)
  const todayAppointments = todays.filter((e) => e.duration_minutes > 0)
  const todayFollowUps = todays.filter((e) => e.event_type === 'follow_up')
  const todayReviews = todays.filter((e) => e.event_type === 'review')

  const overdue = outstanding.filter((e) => e.event_status === 'overdue')

  const next7 = useMemo(() => {
    const out: CalendarEvent[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      out.push(...(byDay.get(d.toLocaleDateString('en-CA')) ?? []).filter(passes))
    }
    return out.sort((a, b) => a.event_at.localeCompare(b.event_at))
  }, [byDay, filter])

  const filtered = useMemo(
    () => (events ?? []).filter(passes).sort((a, b) => a.event_at.localeCompare(b.event_at)),
    [events, filter],
  )

  const daysLate = (iso: string) =>
    Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))

  return (
    <AppShell title={t.calendar.title}>
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <Card>
            {/* ── toolbar ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2 border-b border-cream-200 px-4 py-3">
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setMonth(shiftMonth(month, -1))}
                        aria-label="Previous month">
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-28 text-center text-sm font-semibold text-ink-800">{month}</span>
                <Button size="sm" variant="ghost" onClick={() => setMonth(shiftMonth(month, 1))}
                        aria-label="Next month">
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <Button size="sm" onClick={() => setMonth(monthOf())}>{t.calendar.today}</Button>

              <div className="ml-auto flex gap-1">
                {(['month', 'list'] as const).map((v) => (
                  <button key={v} onClick={() => setView(v)}
                          className={cn('rounded-lg px-3 py-1.5 text-[13px]',
                            view === v ? 'bg-cream-200 font-medium text-ink-700'
                                       : 'text-ink-500 hover:bg-cream-100')}>
                    {v === 'month' ? t.calendar.month : t.calendar.list}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 border-b border-cream-200 px-4 py-2.5">
              <span className="mr-1 text-[13px] text-ink-400">{t.calendar.show}</span>
              {([['all', t.calendar.all, 'slate'],
                 ['treatment', t.calendar.treatment, 'rose'],
                 ['follow_up', t.calendar.followUp, 'violet'],
                 ['review', t.calendar.review, 'amber'],
                 ['overdue', t.calendar.overdue, 'red']] as [Filter, string, BadgeTone][])
                .map(([key, label, tn]) => (
                  <button key={key} onClick={() => setFilter(key)}
                          className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] transition-colors',
                            filter === key ? 'bg-cream-200 font-medium text-ink-700'
                                           : 'text-ink-500 hover:bg-cream-100')}>
                    <span className={cn('size-2 rounded-full', dotClass[tn])} />
                    {label}
                  </button>
                ))}
            </div>

            {loading && <Spinner label={t.common.loading} />}
            {error && <EmptyState>{t.common.error} — {error}</EmptyState>}

            {/* ── month grid ──────────────────────────────────────────── */}
            {!loading && !error && view === 'month' && (
              <div className="p-2 sm:p-3">
                <div className="mb-1 grid grid-cols-7 gap-1">
                  {(t.calendar.weekdays as string[]).map((d) => (
                    <div key={d} className="py-1.5 text-center text-xs font-medium text-ink-400">{d}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {grid.map((day) => {
                    const inMonth = day.slice(0, 7) === month
                    const dayEvents = (byDay.get(day) ?? []).filter(passes)
                    const isToday = day === today
                    return (
                      <div key={day}
                           className={cn('min-h-24 rounded-lg border p-1.5',
                             inMonth ? 'border-cream-200 bg-white' : 'border-transparent bg-cream-50/50',
                             isToday && 'ring-2 ring-[var(--accent-300)]')}>
                        <div className="mb-1 flex justify-end">
                          <span className={cn('flex size-5 items-center justify-center rounded-full text-xs',
                            isToday ? 'bg-[var(--accent-500)] font-semibold text-white'
                                    : inMonth ? 'text-ink-600' : 'text-ink-300')}>
                            {Number(day.slice(8, 10))}
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 3).map((e) => (
                            <Link key={e.id + e.source} to={`/customers/${e.customer_id}`}
                                  className={cn('block truncate rounded px-1 py-0.5 text-[11px] leading-tight hover:opacity-80',
                                    tone(e) === 'red' ? 'bg-red-50 text-red-700'
                                      : tone(e) === 'emerald' ? 'bg-emerald-50 text-emerald-700'
                                      : tone(e) === 'violet' ? 'bg-violet-50 text-violet-700'
                                      : tone(e) === 'amber' ? 'bg-amber-50 text-amber-700'
                                      : 'bg-rose-50 text-rose-700')}>
                              {e.duration_minutes > 0 && (
                                <span className="mr-1 font-medium">{hhmm(e.event_at)}</span>
                              )}
                              {e.customer_name}
                            </Link>
                          ))}
                          {dayEvents.length > 3 && (
                            <p className="px-1 text-[10px] text-ink-400">
                              {t.calendar.more.replace('{n}', String(dayEvents.length - 3))}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── list view ───────────────────────────────────────────── */}
            {!loading && !error && view === 'list' && (
              filtered.length === 0 ? <EmptyState>{t.calendar.nothingUpcoming}</EmptyState> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-rose-50/60 text-left text-[13px] text-ink-500">
                        <th className="px-4 py-3 font-medium">{t.ledger.date}</th>
                        <th className="px-4 py-3 font-medium">{t.calendar.time}</th>
                        <th className="px-4 py-3 font-medium">{t.calendar.customer}</th>
                        <th className="px-4 py-3 font-medium">{t.calendar.type}</th>
                        <th className="hidden px-4 py-3 font-medium md:table-cell">{t.calendar.item}</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((e) => (
                        <tr key={e.id + e.source} className="border-t border-cream-200 hover:bg-cream-50">
                          <td className="whitespace-nowrap px-4 py-2.5 text-ink-600">{localDay(e.event_at)}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-ink-600">
                            {e.duration_minutes > 0
                              ? timeRange(e.event_at, e.duration_minutes)
                              : t.common.none}
                          </td>
                          <td className="px-4 py-2.5">
                            <Link to={`/customers/${e.customer_id}`}
                                  className="flex items-center gap-2 hover:underline">
                              <Avatar name={e.customer_name} size="sm" />
                              <span className="font-medium text-ink-700">{e.customer_name}</span>
                            </Link>
                          </td>
                          <td className="px-4 py-2.5"><Badge tone={tone(e)}>{e.label ?? e.event_type}</Badge></td>
                          <td className="hidden px-4 py-2.5 text-ink-600 md:table-cell">
                            {e.service_name ?? t.common.none}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {waLink(e.customer_phone) && (
                              <a href={waLink(e.customer_phone)!} target="_blank" rel="noreferrer">
                                <Button size="sm" variant="whatsapp"><MessageCircle className="size-3.5" /></Button>
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </Card>
        </div>

        {/* ── right rail ────────────────────────────────────────────── */}
        <div className="space-y-5">
          <Card>
            <CardHeader title={`${t.calendar.todayPanel} · ${today}`} />
            <div className="space-y-4 px-5 py-4">
              <Bucket label={t.calendar.appointments} items={todayAppointments} showTime />
              <Bucket label={t.calendar.followUps} items={todayFollowUps} />
              <Bucket label={t.calendar.reviews} items={todayReviews} />
              {todays.length === 0 && (
                <p className="py-4 text-center text-[13px] text-ink-400">{t.calendar.nothingToday}</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="size-4 text-red-500" />
                  {t.calendar.overduePanel}
                  {overdue.length > 0 && <Badge tone="red">{overdue.length}</Badge>}
                </span>
              }
            />
            {overdue.length === 0 ? (
              <p className="px-5 py-6 text-center text-[13px] text-ink-400">{t.calendar.nothingOverdue}</p>
            ) : (
              <ul className="divide-y divide-cream-200">
                {overdue.slice(0, 8).map((e) => (
                  <li key={e.id} className="flex items-center gap-2 px-5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link to={`/customers/${e.customer_id}`}
                            className="block truncate text-[13px] font-medium text-ink-700 hover:underline">
                        {e.customer_name}
                      </Link>
                      <p className="truncate text-xs text-ink-400">
                        {e.service_name} · {e.label}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-red-600">
                      {t.calendar.daysLate.replace('{n}', String(daysLate(e.event_at)))}
                    </span>
                    {waLink(e.customer_phone) && (
                      <a href={waLink(e.customer_phone)!} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="whatsapp"><MessageCircle className="size-3.5" /></Button>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t.calendar.next7} />
            {next7.length === 0 ? (
              <p className="px-5 py-6 text-center text-[13px] text-ink-400">{t.calendar.nothingUpcoming}</p>
            ) : (
              <ul className="divide-y divide-cream-200">
                {next7.slice(0, 10).map((e) => (
                  <li key={e.id + e.source} className="flex items-center gap-2 px-5 py-2.5">
                    <span className={cn('size-2 shrink-0 rounded-full', dotClass[tone(e)])} />
                    <span className="w-16 shrink-0 text-xs text-ink-500">{localDay(e.event_at).slice(5)}</span>
                    <Link to={`/customers/${e.customer_id}`}
                          className="min-w-0 flex-1 truncate text-[13px] text-ink-700 hover:underline">
                      {e.customer_name}
                    </Link>
                    <span className="shrink-0 truncate text-xs text-ink-400">{e.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  )
}

function Bucket({ label, items, showTime }: {
  label: string
  items: CalendarEvent[]
  showTime?: boolean
}) {
  const { t } = useI18n()
  if (items.length === 0) return null
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-ink-500">
        {label} <span className="text-ink-400">({items.length})</span>
      </p>
      <ul className="space-y-1.5">
        {items.map((e) => (
          <li key={e.id + e.source} className="flex items-center gap-2">
            {showTime && (
              <span className="w-24 shrink-0 text-xs font-medium text-ink-600">
                {timeRange(e.event_at, e.duration_minutes)}
              </span>
            )}
            <Avatar name={e.customer_name} size="sm" />
            <div className="min-w-0 flex-1">
              <Link to={`/customers/${e.customer_id}`}
                    className="block truncate text-[13px] font-medium text-ink-700 hover:underline">
                {e.customer_name}
              </Link>
              <p className="truncate text-xs text-ink-400">{e.service_name ?? e.label}</p>
            </div>
            {waLink(e.customer_phone) && (
              <a href={waLink(e.customer_phone)!} target="_blank" rel="noreferrer"
                 title={t.common.whatsapp}>
                <Button size="sm" variant="whatsapp"><MessageCircle className="size-3.5" /></Button>
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
