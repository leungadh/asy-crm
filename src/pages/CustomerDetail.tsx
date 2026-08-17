import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, AtSign, Phone, Plus, Pencil } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, Field, Spinner } from '@/components/ui'
import { CustomerStatusBadge, NodeStatusBadge } from '@/components/ui/statusBadge'
import { useCustomerDetail } from '@/hooks/useCustomers'
import { useI18n } from '@/i18n'
import { formatMoney, waLink } from '@/lib/utils'
import { CustomerForm } from '@/components/forms/CustomerForm'
import { TreatmentForm } from '@/components/forms/TreatmentForm'
import { PurchaseForm } from '@/components/forms/PurchaseForm'
import { TreatmentHistory } from '@/components/TreatmentHistory'

export default function CustomerDetail() {
  const { id } = useParams()
  const { t } = useI18n()
  const { data, loading, error, refetch } = useCustomerDetail(id)
  const [editing, setEditing] = useState(false)
  const [addingTreatment, setAddingTreatment] = useState(false)
  const [addingPurchase, setAddingPurchase] = useState(false)

  if (loading) return <AppShell title={t.common.loading}><Spinner label={t.common.loading} /></AppShell>
  if (error || !data) return <AppShell title={t.common.error}><EmptyState>{error}</EmptyState></AppShell>

  const { customer: c, treatments, nodes, purchases } = data
  const wa = waLink(c.phone)

  // Purchase totals, as the mockup's 累計購買總結 chips
  const totals = purchases.reduce<Record<string, number>>((acc, p) => {
    const code = p.product?.code ?? '?'
    acc[code] = (acc[code] ?? 0) + p.quantity
    return acc
  }, {})

  const age = c.birthday ? new Date().getFullYear() - new Date(c.birthday).getFullYear() : null
  const reviewNode = nodes.find((n) => n.node_type === 'review' && n.display_status !== 'done')

  return (
    <AppShell
      title={
        <span className="flex items-center gap-1.5 text-base">
          <Link to="/customers" className="text-ink-400 hover:text-ink-600">{t.customers.title}</Link>
          <span className="text-ink-300">/</span>
          <span>{c.name}</span>
        </span>
      }
      actions={
        <>
          <Button size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" /><span className="hidden sm:inline">{t.common.edit}</span>
          </Button>
          <Button size="sm" variant="primary" onClick={() => setAddingTreatment(true)}>
            <Plus className="size-4" /><span className="hidden sm:inline">{t.customers.addTreatment}</span>
          </Button>
        </>
      }
    >
      <CustomerForm
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={() => refetch()}
        existing={c}
      />
      <TreatmentForm
        open={addingTreatment}
        onClose={() => setAddingTreatment(false)}
        onSaved={() => refetch()}
        customerId={c.id}
      />
      <PurchaseForm
        open={addingPurchase}
        onClose={() => setAddingPurchase(false)}
        onSaved={() => refetch()}
        customerId={c.id}
      />

      <Link to="/customers" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700 lg:hidden">
        <ChevronLeft className="size-4" />{t.detail.back}
      </Link>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <Card className="mb-5 px-5 py-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <Avatar name={c.name} size="xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold text-ink-900">{c.name}</h2>
                {c.tags.includes('VIP') && <Badge tone="rose">VIP</Badge>}
              </div>
              <div className="mt-2 space-y-1 text-sm text-ink-600">
                {c.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="size-3.5 text-ink-400" />{c.phone}
                  </p>
                )}
                {c.instagram && (
                  <p className="flex items-center gap-1.5">
                    <AtSign className="size-3.5 text-ink-400" />@{c.instagram}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-3 gap-x-6 gap-y-3 border-cream-200 lg:border-l lg:pl-6">
            <Stat label={t.detail.visits} value={String(c.visit_count ?? 0)} />
            <Stat label={t.detail.lifetimeValue} value={formatMoney(c.lifetime_value)} />
            <Stat label={t.customers.columns.status} value={<CustomerStatusBadge status={c.status} />} />
          </div>

          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="shrink-0">
              <Button variant="whatsapp">{t.common.whatsapp}</Button>
            </a>
          )}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        {/* ── Left column ─────────────────────────────────────────────── */}
        <div className="space-y-5">
          <Card>
            <CardHeader title={t.detail.info} />
            <div className="divide-y divide-cream-200 px-5 py-1">
              <Field label={t.detail.source}>{c.source ?? t.common.none}</Field>
              <Field label={t.detail.firstVisit}>{c.first_visit_date ?? t.common.none}</Field>
              <Field label={t.detail.birthday}>
                {c.birthday ? `${c.birthday}${age ? `（${age}）` : ''}` : t.common.none}
              </Field>
              <Field label={t.detail.occupation}>{c.occupation ?? t.common.none}</Field>
              <Field label={t.detail.tags}>
                <div className="flex flex-wrap justify-end gap-1">
                  {c.tags.length
                    ? c.tags.map((tag) => <Badge key={tag} tone={tag === 'VIP' ? 'rose' : 'slate'}>{tag}</Badge>)
                    : t.common.none}
                </div>
              </Field>
              <Field label={t.detail.lastUpdated}>{c.updated_at.slice(0, 10)}</Field>
            </div>
          </Card>

          {c.remark && (
            <Card>
              <CardHeader title={
                <span>{t.detail.remark}
                  <span className="ml-2 text-xs font-normal text-ink-400">（{t.detail.remarkHint}）</span>
                </span>
              } />
              <ul className="space-y-2 px-5 py-4 text-[13px] leading-relaxed text-ink-600">
                {c.remark.split('\n').filter(Boolean).map((line, i) => (
                  <li key={i} className="flex gap-2"><span className="text-[var(--accent-300)]">•</span><span>{line}</span></li>
                ))}
              </ul>
            </Card>
          )}

        </div>

        {/* ── Right column ────────────────────────────────────────────── */}
        <div className="space-y-5">
          <TreatmentHistory treatments={treatments} nodes={nodes} onChanged={refetch} />

          <Card>
            <CardHeader
              title={t.detail.purchases}
              action={
                <Button size="sm" onClick={() => setAddingPurchase(true)}>
                  <Plus className="size-3.5" />{t.detail.addPurchase}
                </Button>
              }
            />
            {purchases.length === 0 ? (
              <EmptyState>{t.common.none}</EmptyState>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-rose-50/60 text-left text-[13px] text-ink-500">
                        <th className="px-5 py-2.5 font-medium">{t.detail.date}</th>
                        <th className="px-4 py-2.5 font-medium">{t.detail.product}</th>
                        <th className="px-4 py-2.5 font-medium">{t.detail.qty}</th>
                        <th className="hidden px-4 py-2.5 font-medium sm:table-cell">{t.detail.shipFrom}</th>
                        <th className="px-4 py-2.5 text-right font-medium">{t.detail.lifetimeValue}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.map((p) => (
                        <tr key={p.id} className="border-t border-cream-200">
                          <td className="whitespace-nowrap px-5 py-3 text-ink-600">{p.purchase_date}</td>
                          <td className="px-4 py-3 font-medium text-ink-700">{p.product?.code}</td>
                          <td className="px-4 py-3 text-ink-600">{p.quantity}</td>
                          <td className="hidden px-4 py-3 text-ink-600 sm:table-cell">
                            {p.ship_from === 'studio' ? 'Studio' : 'Home'}
                          </td>
                          <td className="px-4 py-3 text-right text-ink-700">{formatMoney(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-cream-200 px-5 py-4">
                  <p className="mb-2 text-[13px] text-ink-500">{t.detail.purchaseTotals}</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(totals).map(([code, qty]) => (
                      <Badge key={code} tone={qty > 0 ? 'rose' : 'slate'}>{code} × {qty}</Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </Card>

          {reviewNode && (
            <Card>
              <CardHeader title={t.detail.nextReview} />
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <p className="text-sm text-ink-600">
                  {t.detail.suggestedWindow}：
                  <span className="ml-1 font-medium text-ink-800">
                    {reviewNode.due_date}
                    {reviewNode.window_end_date && ` – ${reviewNode.window_end_date}`}
                  </span>
                </p>
                <NodeStatusBadge status={reviewNode.display_status} />
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-ink-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink-800">{value}</p>
    </div>
  )
}
