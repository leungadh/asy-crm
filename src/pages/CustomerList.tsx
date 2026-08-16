import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, HeartHandshake, CalendarClock, Moon, UserPlus, Search, Plus, X } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import {
  Avatar, Badge, Button, Card, EmptyState, Field, Input, Select, Spinner, StatCard,
} from '@/components/ui'
import { CustomerStatusBadge, NodeStatusBadge } from '@/components/ui/statusBadge'
import { useCustomerList, useServices } from '@/hooks/useCustomers'
import { useI18n } from '@/i18n'
import { cn, formatMoney, waLink } from '@/lib/utils'
import type { CustomerSummary, CustomerStatus } from '@/types/database'

type SortKey = 'recent' | 'spend' | 'visits' | 'name'

export default function CustomerList() {
  const { t, locale } = useI18n()
  const { data, loading, error } = useCustomerList()
  const services = useServices()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<CustomerStatus | 'all'>('all')
  const [service, setService] = useState('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const [selected, setSelected] = useState<CustomerSummary | null>(null)

  const rows = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()

    const filtered = data.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !(c.phone ?? '').includes(q)) return false
      if (status !== 'all' && c.status !== status) return false
      if (service !== 'all' && c.last_service_zh !== service) return false
      return true
    })

    const num = (v: string | null) => Number(v ?? 0)
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'spend':  return num(b.lifetime_value) - num(a.lifetime_value)
        case 'visits': return (b.visit_count ?? 0) - (a.visit_count ?? 0)
        case 'name':   return a.name.localeCompare(b.name)
        default:
          return (b.last_visit_date ?? '').localeCompare(a.last_visit_date ?? '')
      }
    })
  }, [data, query, status, service, sort])

  const stats = useMemo(() => {
    const d = data ?? []
    return {
      total: d.length,
      active: d.filter((c) => c.status === 'active_followup').length,
      review: d.filter((c) => c.status === 'pending_review').length,
      dormant: d.filter((c) => c.status === 'dormant').length,
      fresh: d.filter((c) => c.is_new).length,
    }
  }, [data])

  return (
    <AppShell
      title={t.customers.title}
      actions={
        <Button variant="primary" size="sm" className="hidden sm:inline-flex">
          <Plus className="size-4" /> {t.customers.add}
        </Button>
      }
    >
      <h2 className="mb-4 text-xl font-semibold text-ink-900">{t.customers.overview}</h2>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={<Users className="size-5" />}          label={t.customers.total}          value={stats.total}   tone="rose" />
        <StatCard icon={<HeartHandshake className="size-5" />} label={t.customers.activeFollowup} value={stats.active}  tone="violet" />
        <StatCard icon={<CalendarClock className="size-5" />}  label={t.customers.pendingReview}  value={stats.review}  tone="amber" />
        <StatCard icon={<Moon className="size-5" />}           label={t.customers.dormant}        value={stats.dormant} tone="sky" />
        <StatCard icon={<UserPlus className="size-5" />}       label={t.customers.newCustomers}   value={stats.fresh}   tone="emerald" />
      </div>

      <div className="flex gap-5">
        <div className="min-w-0 flex-1">
          <Card>
            <div className="flex flex-wrap items-center gap-2 border-b border-cream-200 px-4 py-3">
              <div className="relative min-w-[180px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                <Input
                  value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.customers.search} className="pl-9"
                />
              </div>

              <Select value={status} onChange={(e) => setStatus(e.target.value as CustomerStatus | 'all')}>
                <option value="all">{t.customers.filterStatus}：{t.customers.all}</option>
                {(['active_followup', 'pending_review', 'dormant', 'completed'] as const).map((s) => (
                  <option key={s} value={s}>{t.status[s]}</option>
                ))}
              </Select>

              <Select value={service} onChange={(e) => setService(e.target.value)}>
                <option value="all">{t.customers.filterService}：{t.customers.all}</option>
                {services.map((s) => (
                  <option key={s.id} value={s.name_zh}>{locale === 'en' ? s.name_en : s.name_zh}</option>
                ))}
              </Select>

              <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="recent">{t.customers.sort}：{t.customers.columns.lastDate}</option>
                <option value="spend">{t.detail.lifetimeValue}</option>
                <option value="visits">{t.detail.visits}</option>
                <option value="name">{t.customers.columns.customer}</option>
              </Select>
            </div>

            {loading && <Spinner label={t.common.loading} />}
            {error && <EmptyState>{t.common.error} — {error}</EmptyState>}
            {!loading && !error && rows.length === 0 && <EmptyState>{t.customers.empty}</EmptyState>}

            {!loading && !error && rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-rose-50/60 text-left text-[13px] text-ink-500">
                      <th className="px-4 py-3 font-medium">{t.customers.columns.customer}</th>
                      <th className="px-4 py-3 font-medium">{t.customers.columns.phone}</th>
                      <th className="hidden px-4 py-3 font-medium md:table-cell">{t.customers.columns.lastService}</th>
                      <th className="hidden px-4 py-3 font-medium lg:table-cell">{t.customers.columns.lastDate}</th>
                      <th className="hidden px-4 py-3 font-medium xl:table-cell">{t.customers.columns.nextFollowup}</th>
                      <th className="px-4 py-3 font-medium">{t.customers.columns.status}</th>
                      <th className="hidden px-4 py-3 font-medium lg:table-cell">{t.customers.columns.tags}</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => setSelected(c)}
                        className={cn(
                          'cursor-pointer border-t border-cream-200 transition-colors hover:bg-cream-50',
                          selected?.id === c.id && 'bg-rose-50/50',
                        )}
                      >
                        <td className="px-4" style={{ paddingBlock: 'var(--row-py)' }}>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={c.name} size="sm" />
                            <span className="font-medium text-ink-700">{c.name}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 text-ink-600">{c.phone ?? t.common.none}</td>
                        <td className="hidden px-4 md:table-cell">
                          <div className="text-ink-700">{c.last_service_zh ?? t.common.none}</div>
                          {c.last_detail && <div className="text-xs text-ink-400">{c.last_detail}</div>}
                        </td>
                        <td className="hidden whitespace-nowrap px-4 text-ink-600 lg:table-cell">
                          {c.last_visit_date ?? t.common.none}
                        </td>
                        <td className="hidden px-4 xl:table-cell">
                          {c.next_followup_at ? (
                            <>
                              <div className="whitespace-nowrap text-ink-700">{c.next_followup_at.slice(0, 10)}</div>
                              <div className="text-xs text-[var(--accent-600)]">{c.next_followup_label}</div>
                            </>
                          ) : <span className="text-ink-400">{t.common.none}</span>}
                        </td>
                        <td className="px-4"><CustomerStatusBadge status={c.status} /></td>
                        <td className="hidden px-4 lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {c.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} tone={tag === 'VIP' ? 'rose' : 'slate'}>{tag}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 text-right">
                          <Link to={`/customers/${c.id}`} onClick={(e) => e.stopPropagation()}>
                            <Button size="sm">{t.customers.view}</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && rows.length > 0 && (
              <div className="border-t border-cream-200 px-4 py-3 text-[13px] text-ink-500">
                {t.customers.showing(1, rows.length, rows.length)}
              </div>
            )}
          </Card>
        </div>

        {/* Quick preview — desktop only, mirrors the mockup's right rail */}
        {selected && (
          <div className="hidden w-80 shrink-0 2xl:block">
            <Card className="sticky top-0 px-5 py-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-ink-900">{t.customers.quickPreview}</h3>
                <button onClick={() => setSelected(null)} className="rounded p-1 text-ink-400 hover:bg-cream-100">
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex flex-col items-center pb-4 text-center">
                <Avatar name={selected.name} size="xl" />
                <p className="mt-3 text-lg font-semibold text-ink-900">{selected.name}</p>
                <div className="mt-1 flex items-center gap-2 text-sm text-ink-600">
                  {selected.phone}
                  {waLink(selected.phone) && (
                    <a href={waLink(selected.phone)!} target="_blank" rel="noreferrer"
                       className="text-emerald-600 hover:underline">{t.common.whatsapp}</a>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-1">
                  {selected.tags.map((tag) => (
                    <Badge key={tag} tone={tag === 'VIP' ? 'rose' : 'slate'}>{tag}</Badge>
                  ))}
                </div>
                {selected.source && (
                  <p className="mt-2 text-xs text-ink-400">{t.customers.source}：{selected.source}</p>
                )}
              </div>

              <div className="divide-y divide-cream-200 border-y border-cream-200">
                <Field label={t.customers.columns.lastService}>{selected.last_service_zh ?? t.common.none}</Field>
                <Field label={t.customers.columns.lastDate}>{selected.last_visit_date ?? t.common.none}</Field>
                <Field label={t.detail.visits}>{selected.visit_count ?? 0}</Field>
                <Field label={t.detail.lifetimeValue}>{formatMoney(selected.lifetime_value)}</Field>
                <Field label={t.customers.columns.status}>
                  <CustomerStatusBadge status={selected.status} />
                </Field>
                {selected.next_followup_status && (
                  <Field label={t.customers.columns.nextFollowup}>
                    <div className="flex flex-col items-end gap-1">
                      <span>{selected.next_followup_at?.slice(0, 10)}</span>
                      <NodeStatusBadge status={selected.next_followup_status} />
                    </div>
                  </Field>
                )}
              </div>

              {selected.remark && (
                <div className="mt-4 rounded-lg bg-cream-100 px-3 py-3">
                  <ul className="space-y-1 text-[13px] leading-relaxed text-ink-600">
                    {selected.remark.split('\n').filter(Boolean).map((line, i) => (
                      <li key={i} className="flex gap-1.5"><span>·</span><span>{line}</span></li>
                    ))}
                  </ul>
                </div>
              )}

              <Link to={`/customers/${selected.id}`} className="mt-4 block">
                <Button variant="primary" className="w-full">{t.customers.fullProfile}</Button>
              </Link>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  )
}
