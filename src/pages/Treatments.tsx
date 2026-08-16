import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Plus, Search } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Avatar, Badge, Button, Card, EmptyState, Input, Select, Spinner, StatCard, type BadgeTone } from '@/components/ui'
import { NodeStatusBadge } from '@/components/ui/statusBadge'
import { TreatmentForm } from '@/components/forms/TreatmentForm'
import { useTreatments } from '@/hooks/useStock'
import { useServices } from '@/hooks/useCustomers'
import { useI18n } from '@/i18n'
import { formatMoney } from '@/lib/utils'

const accentTone: Record<string, BadgeTone> = {
  rose: 'rose', violet: 'violet', pink: 'pink', amber: 'amber',
}

export default function Treatments() {
  const { t, locale } = useI18n()
  const { rows, nodes, loading, error, refetch } = useTreatments()
  const services = useServices()

  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [serviceCode, setServiceCode] = useState('all')

  // Follow-up progress per treatment, computed from the board rows.
  const progress = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>()
    for (const n of nodes) {
      const cur = map.get(n.treatment_id) ?? { done: 0, total: 0 }
      cur.total += 1
      if (n.display_status === 'done' || n.display_status === 'skipped') cur.done += 1
      map.set(n.treatment_id, cur)
    }
    return map
  }, [nodes])

  const nextNode = useMemo(() => {
    const map = new Map<string, (typeof nodes)[number]>()
    for (const n of [...nodes].sort((a, b) => a.due_at.localeCompare(b.due_at))) {
      if (n.display_status === 'done' || n.display_status === 'skipped') continue
      if (!map.has(n.treatment_id)) map.set(n.treatment_id, n)
    }
    return map
  }, [nodes])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (rows ?? []).filter((r) => {
      if (serviceCode !== 'all' && r.service.code !== serviceCode) return false
      if (!q) return true
      return r.customer.name.toLowerCase().includes(q) || (r.customer.phone ?? '').includes(q)
    })
  }, [rows, query, serviceCode])

  const monthCount = useMemo(() => {
    const prefix = new Date().toISOString().slice(0, 7)
    return (rows ?? []).filter((r) => r.treatment_date.startsWith(prefix)).length
  }, [rows])

  const byService = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rows ?? []) counts.set(r.service.code, (counts.get(r.service.code) ?? 0) + 1)
    return counts
  }, [rows])

  return (
    <AppShell
      title={t.treatments.title}
      actions={
        <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">{t.treatments.add}</span>
        </Button>
      }
    >
      <TreatmentForm open={adding} onClose={() => setAdding(false)} onSaved={refetch} />

      <p className="mb-4 text-sm text-ink-500">{t.treatments.subtitle}</p>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={<ClipboardList className="size-5" />} label={t.treatments.thisMonth}
                  value={monthCount} tone="rose" />
        {services.map((s) => (
          <StatCard
            key={s.id}
            icon={<span className="text-sm font-semibold">{s.name_en.slice(0, 2)}</span>}
            label={locale === 'en' ? s.name_en : s.name_zh}
            value={byService.get(s.code) ?? 0}
            tone={accentTone[s.accent] ?? 'slate'}
          />
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-cream-200 px-4 py-3">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)}
                   placeholder={t.treatments.searchCustomer} className="pl-9" />
          </div>
          <Select value={serviceCode} onChange={(e) => setServiceCode(e.target.value)}>
            <option value="all">{t.treatments.allServices}</option>
            {services.map((s) => (
              <option key={s.id} value={s.code}>{locale === 'en' ? s.name_en : s.name_zh}</option>
            ))}
          </Select>
        </div>

        {loading && <Spinner label={t.common.loading} />}
        {error && <EmptyState>{t.common.error} — {error}</EmptyState>}
        {!loading && !error && filtered.length === 0 && <EmptyState>{t.treatments.empty}</EmptyState>}

        {!loading && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-rose-50/60 text-left text-[13px] text-ink-500">
                  <th className="px-4 py-3 font-medium">{t.treatments.date}</th>
                  <th className="px-4 py-3 font-medium">{t.treatments.customer}</th>
                  <th className="px-4 py-3 font-medium">{t.treatments.service}</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">{t.treatments.detail}</th>
                  <th className="px-4 py-3 text-right font-medium">{t.treatments.amount}</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">{t.treatments.followup}</th>
                  <th className="hidden px-4 py-3 font-medium xl:table-cell">{t.treatments.statusLabel}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const p = progress.get(r.id)
                  const nx = nextNode.get(r.id)
                  return (
                    <tr key={r.id} className="border-t border-cream-200 hover:bg-cream-50">
                      <td className="whitespace-nowrap px-4 text-ink-600" style={{ paddingBlock: 'var(--row-py)' }}>
                        {r.treatment_date}
                      </td>
                      <td className="px-4">
                        <Link to={`/customers/${r.customer.id}`}
                              className="flex items-center gap-2.5 hover:underline">
                          <Avatar name={r.customer.name} size="sm" />
                          <span className="font-medium text-ink-700">{r.customer.name}</span>
                        </Link>
                      </td>
                      <td className="px-4">
                        <Badge tone={accentTone[r.service.accent] ?? 'slate'}>
                          {locale === 'en' ? r.service.name_en : r.service.name_zh}
                        </Badge>
                      </td>
                      <td className="hidden px-4 text-ink-600 md:table-cell">{r.detail ?? t.common.none}</td>
                      <td className="whitespace-nowrap px-4 text-right font-medium text-ink-700">
                        {formatMoney(r.amount)}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 text-ink-600 lg:table-cell">
                        {p ? `${p.done}/${p.total}` : t.common.none}
                      </td>
                      <td className="hidden px-4 xl:table-cell">
                        {nx ? <NodeStatusBadge status={nx.display_status} />
                            : <Badge tone="emerald">{t.treatments.completed}</Badge>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  )
}
