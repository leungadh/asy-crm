import { useMemo, useState } from 'react'
import { ChevronDown, Star, CalendarPlus } from 'lucide-react'
import { Badge, Button, Card, CardHeader, EmptyState, type BadgeTone } from '@/components/ui'
import { NodeStatusBadge } from '@/components/ui/statusBadge'
import { NodeActions } from '@/components/forms/NodeActions'
import { useI18n } from '@/i18n'
import { cn, formatMoney } from '@/lib/utils'
import type { CustomerDetailData } from '@/hooks/useCustomers'
import type { FollowupBoardRow } from '@/types/database'

const accentTone: Record<string, BadgeTone> = {
  rose: 'rose', violet: 'violet', pink: 'pink', amber: 'amber',
}

export function TreatmentHistory({ treatments, nodes, onChanged }: {
  treatments: CustomerDetailData['treatments']
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

  // Newest visit open by default; the rest collapsed.
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(treatments.length ? [treatments[0].id] : []),
  )

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const allOpen = open.size === treatments.length && treatments.length > 0

  if (treatments.length === 0) {
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
              （{treatments.length}）
            </span>
          </span>
        }
        action={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOpen(allOpen ? new Set() : new Set(treatments.map((x) => x.id)))}
          >
            {allOpen ? t.detail.collapseAll : t.detail.expandAll}
          </Button>
        }
      />

      <ul className="divide-y divide-cream-200">
        {treatments.map((tx, idx) => {
          const isOpen = open.has(tx.id)
          const txNodes = nodesByTreatment.get(tx.id) ?? []
          const done = txNodes.filter(
            (n) => n.display_status === 'done' || n.display_status === 'skipped',
          ).length
          const visitNo = treatments.length - idx   // oldest visit is #1
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
                    {formatMoney(tx.amount)}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="bg-cream-50/60 px-5 pb-5 pt-1">
                  <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-4">
                    <Detail label={t.detail.pigment} value={tx.pigment_used} />
                    <Detail label={t.detail.payment} value={tx.payment_method} />
                    <Detail
                      label={t.detail.ratingLabel}
                      value={
                        tx.rating ? (
                          <span className="inline-flex items-center gap-0.5">
                            {tx.rating}
                            <Star className="size-3 fill-amber-400 text-amber-400" />
                          </span>
                        ) : null
                      }
                    />
                    <Detail label={t.customers.columns.status}
                            value={tx.status === 'completed' ? t.treatments.completed : t.treatments.inProgress} />
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

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  const { t } = useI18n()
  return (
    <div>
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-ink-700">{value || t.common.none}</dd>
    </div>
  )
}
