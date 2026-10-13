import { useMemo, useState } from 'react'
import { ChevronDown, CalendarPlus, CalendarClock, AlertTriangle } from 'lucide-react'
import { Badge, Button, Card, CardHeader, EmptyState, type BadgeTone } from '@/components/ui'
import { NodeStatusBadge } from '@/components/ui/statusBadge'
import { NodeActions } from '@/components/forms/NodeActions'
import { useI18n } from '@/i18n'
import { cn, formatMoney } from '@/lib/utils'
import type { CustomerDetailData } from '@/hooks/useCustomers'
import type { FollowupBoardRow } from '@/types/database'

const accentTone: Record<string, BadgeTone> = {
  rose: 'rose', violet: 'violet', pink: 'pink', amber: 'amber',
  emerald: 'emerald', sky: 'sky',
}

/** One row in the 即將到來 band. Scheduled treatments and 回診 appointments live
 *  in different tables with different shapes, so they are normalised to this
 *  before being merged — otherwise the sort and the markup both fork. */
interface UpcomingRow {
  id: string
  kind: 'treatment' | 'review'
  /** Sort key. Local-time ISO so a date without a time still orders sensibly. */
  sortAt: string
  date: string
  time: string | null
  serviceName: string | null
  accent: string | null
  detail: string | null
  /** The booked time is in the past but nothing has closed the booking off. */
  overdue: boolean
}

export function TreatmentHistory({ treatments, appointments, nodes, onChanged }: {
  treatments: CustomerDetailData['treatments']
  appointments: CustomerDetailData['appointments']
  nodes: FollowupBoardRow[]
  onChanged: () => void
}) {
  const { t, locale } = useI18n()

  // Follow-ups belong to a specific visit. Showing them in one flat list is
  // unreadable once a client has been in more than twice.
  const nodesByTreatment = useMemo(() => {
    const map = new Map<string, FollowupBoardRow[]>()
    for (const n of nodes) {
      const list = map.get(n.treatment_id) ?? []
      list.push(n)
      map.set(n.treatment_id, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.sequence - b.sequence)
    return map
  }, [nodes])

  // A booking is not a visit. Keeping the two apart matters for more than
  // layout: visit numbering, the (n) count and "newest visit" all become wrong
  // the moment a future booking is allowed into the list.
  const past = useMemo(
    () => treatments.filter((tx) => tx.status !== 'scheduled'),
    [treatments],
  )

  const upcoming = useMemo<UpcomingRow[]>(() => {
    const now = new Date()
    const today = toLocalDate(now)

    const rows: UpcomingRow[] = treatments
      .filter((tx) => tx.status === 'scheduled')
      .map((tx) => ({
        id: tx.id,
        kind: 'treatment' as const,
        sortAt: `${tx.treatment_date}T${tx.start_time ?? '00:00'}`,
        date: tx.treatment_date,
        time: tx.start_time ? tx.start_time.slice(0, 5) : null,
        serviceName: locale === 'en' ? tx.service.name_en : tx.service.name_zh,
        accent: tx.service.accent,
        detail: tx.detail,
        overdue: tx.treatment_date < today,
      }))

    for (const a of appointments) {
      const d = new Date(a.starts_at)
      rows.push({
        id: a.id,
        kind: 'review',
        sortAt: `${toLocalDate(d)}T${toLocalTime(d)}`,
        date: toLocalDate(d),
        time: toLocalTime(d),
        serviceName: a.service
          ? (locale === 'en' ? a.service.name_en : a.service.name_zh)
          : null,
        accent: a.service?.accent ?? null,
        detail: a.notes,
        overdue: d.getTime() < now.getTime(),
      })
    }

    return rows.sort((x, y) => x.sortAt.localeCompare(y.sortAt))
  }, [treatments, appointments, locale])

  // Newest visit open by default; the rest collapsed.
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(past.length ? [past[0].id] : []),
  )

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const allOpen = open.size === past.length && past.length > 0

  if (past.length === 0 && upcoming.length === 0) {
    return (
      <Card>
        <CardHeader title={t.detail.history} />
        <EmptyState>{t.detail.noTreatments}</EmptyState>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title={
          <span>
            {t.detail.history}
            <span className="ml-2 text-xs font-normal text-ink-400">
              （{past.length}）
            </span>
          </span>
        }
        action={
          past.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOpen(allOpen ? new Set() : new Set(past.map((x) => x.id)))}
            >
              {allOpen ? t.detail.collapseAll : t.detail.expandAll}
            </Button>
          )
        }
      />

      {/* ── 即將到來 ───────────────────────────────────────────────────────
          Pinned above the history, tinted differently, and outside the <ul>
          below so it takes no visit number and no place in the count. */}
      {upcoming.length > 0 && (
        <div className="border-b border-cream-200 bg-[var(--accent-50,theme(colors.rose.50))]/70 px-5 py-3.5">
          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-ink-500">
            <CalendarClock className="size-3.5" />
            {t.detail.upcoming}
            <span className="font-normal text-ink-400">· {t.detail.upcomingHint}</span>
          </p>

          <ul className="space-y-2">
            {upcoming.map((u) => (
              <li
                key={`${u.kind}-${u.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-cream-200 bg-white px-3.5 py-2.5"
              >
                <span className="whitespace-nowrap text-sm font-medium text-ink-700">
                  {u.date}
                </span>
                <span className="whitespace-nowrap text-[13px] text-ink-500">
                  {u.time ?? t.detail.noTimeSet}
                </span>

                <Badge tone={u.kind === 'review' ? 'violet' : 'sky'}>
                  {u.kind === 'review' ? t.detail.apptReview : t.detail.apptTreatment}
                </Badge>

                {u.serviceName && (
                  <Badge tone={accentTone[u.accent ?? ''] ?? 'slate'}>{u.serviceName}</Badge>
                )}

                {u.detail && (
                  <span className="truncate text-[13px] text-ink-500">{u.detail}</span>
                )}

                <span className="ml-auto flex items-center gap-2">
                  {u.overdue && (
                    <span className="flex items-center gap-1 whitespace-nowrap text-xs text-amber-700">
                      <AlertTriangle className="size-3.5" />
                      {t.detail.apptPassed}
                    </span>
                  )}
                  {u.kind === 'treatment' && (
                    <span className="whitespace-nowrap text-xs text-ink-400">
                      {t.detail.amountPending}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="divide-y divide-cream-200">
        {past.map((tx, idx) => {
          const isOpen = open.has(tx.id)
          const txNodes = nodesByTreatment.get(tx.id) ?? []
          const done = txNodes.filter(
            (n) => n.display_status === 'done' || n.display_status === 'skipped',
          ).length
          const visitNo = past.length - idx   // oldest visit is #1
          const review = txNodes.find((n) => n.node_type === 'review')

          return (
            <li key={tx.id}>
              <button
                onClick={() => toggle(tx.id)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-cream-50"
                aria-expanded={isOpen}
              >
                <ChevronDown
                  className={cn('size-4 shrink-0 text-ink-400 transition-transform',
                    isOpen && 'rotate-180')}
                />

                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="whitespace-nowrap text-sm font-medium text-ink-700">
                    {tx.treatment_date}
                  </span>
                  <Badge tone={accentTone[tx.service.accent] ?? 'slate'}>
                    {locale === 'en' ? tx.service.name_en : tx.service.name_zh}
                  </Badge>
                  {tx.detail && <span className="truncate text-[13px] text-ink-500">{tx.detail}</span>}
                  <span className="text-xs text-ink-400">
                    {t.detail.visitNo.replace('{n}', String(visitNo))}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {txNodes.length > 0 && (
                    <span className="hidden text-xs text-ink-400 sm:inline">
                      {done}/{txNodes.length}
                    </span>
                  )}
                  <span className="whitespace-nowrap text-sm font-semibold text-ink-800">
                    {tx.amount === null ? t.detail.amountPending : formatMoney(tx.amount)}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="bg-cream-50/60 px-5 pb-5 pt-1">
                  <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
                    <Detail label={t.detail.pigment} value={tx.pigment_used} />
                    <Detail label={t.detail.payment} value={tx.payment_method} />
                    <Detail label={t.customers.columns.status} value={statusLabel(tx.status, t)} />
                  </dl>

                  {tx.remark && (
                    <div className="mb-4 rounded-lg border border-cream-200 bg-white px-4 py-3">
                      <p className="mb-1 text-xs text-ink-400">{t.detail.situation}</p>
                      <p className="text-[13px] leading-relaxed text-ink-600">{tx.remark}</p>
                    </div>
                  )}

                  <p className="mb-2 text-xs font-medium text-ink-500">{t.detail.thisVisitFollowups}</p>

                  {txNodes.length === 0 ? (
                    <p className="rounded-lg border border-cream-200 bg-white px-4 py-3 text-[13px] text-ink-400">
                      {t.detail.noNodes}
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-cream-200 bg-white">
                      <table className="w-full text-sm">
                        <tbody>
                          {txNodes.map((n) => (
                            <tr key={n.id} className="border-b border-cream-200 last:border-0">
                              <td className="py-2.5 pl-4 pr-3">
                                <div className="flex items-center gap-2">
                                  <span className={cn('size-1.5 shrink-0 rounded-full',
                                    n.node_type === 'review'
                                      ? 'bg-[var(--accent-500)]'
                                      : 'bg-[var(--accent-300)]')} />
                                  <span className="whitespace-nowrap text-ink-700">
                                    {locale === 'en' ? n.label_en : n.label_zh}
                                  </span>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-[13px] text-ink-600">
                                {n.window_end_date ? `${n.due_date} – ${n.window_end_date}` : n.due_date}
                              </td>
                              <td className="px-3 py-2.5">
                                <NodeStatusBadge status={n.display_status} />
                              </td>
                              <td className="hidden px-3 py-2.5 text-[13px] text-ink-500 md:table-cell">
                                {n.note ?? t.common.none}
                              </td>
                              <td className="py-2.5 pl-3 pr-4">
                                <NodeActions node={n} onChanged={onChanged} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {review && review.display_status !== 'done' && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
                      <CalendarPlus className="size-3.5" />
                      {t.detail.suggestedWindow}：{review.due_date}
                      {review.window_end_date && ` – ${review.window_end_date}`}
                    </p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/** Exhaustive on purpose. The previous `=== 'completed' ? … : inProgress`
 *  silently labelled a future booking as 跟進中, which read as a visit that had
 *  already happened. A new status landing here should be visible, not absorbed. */
function statusLabel(status: string, t: ReturnType<typeof useI18n>['t']): string {
  switch (status) {
    case 'completed':   return t.treatments.completed
    case 'in_progress': return t.treatments.inProgress
    case 'scheduled':   return t.treatments.scheduled
    default:            return status
  }
}

/** Local-time YYYY-MM-DD. `toISOString()` is UTC, which in Hong Kong (UTC+8)
 *  pushes anything before 08:00 back onto the previous day. */
function toLocalDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function toLocalTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  const { t } = useI18n()
  return (
    <div>
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-ink-700">{value || t.common.none}</dd>
    </div>
  )
}
