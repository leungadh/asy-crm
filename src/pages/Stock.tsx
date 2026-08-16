import { useMemo, useState } from 'react'
import { Package, AlertTriangle, CircleAlert, CircleCheck, Plus, Pencil, Home, Store } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Button, Card, EmptyState, Input, Spinner, StatCard, type BadgeTone } from '@/components/ui'
import { StockAdjustForm, ProductForm } from '@/components/forms/StockForms'
import { useStockLevels } from '@/hooks/useStock'
import { useI18n } from '@/i18n'
import type { StockLevel } from '@/types/database'

const statusTone: Record<StockLevel['stock_status'], BadgeTone> = {
  ok: 'emerald', low: 'amber', critical: 'red',
}

export default function Stock() {
  const { t } = useI18n()
  const { data, loading, error, refetch } = useStockLevels()

  const [query, setQuery] = useState('')
  const [adjusting, setAdjusting] = useState<StockLevel | null>(null)
  const [editing, setEditing] = useState<StockLevel | null>(null)
  const [creating, setCreating] = useState(false)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data ?? []).filter((p) =>
      !q || p.code.toLowerCase().includes(q) || p.name_zh.toLowerCase().includes(q))
  }, [data, query])

  const stats = useMemo(() => {
    const d = data ?? []
    return {
      total: d.length,
      low: d.filter((p) => p.stock_status === 'low').length,
      critical: d.filter((p) => p.stock_status === 'critical').length,
      ok: d.filter((p) => p.stock_status === 'ok').length,
    }
  }, [data])

  return (
    <AppShell
      title={t.stock.title}
      actions={
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">{t.stock.addProduct}</span>
        </Button>
      }
    >
      {adjusting && (
        <StockAdjustForm product={adjusting} onClose={() => setAdjusting(null)} onSaved={refetch} />
      )}
      {creating && <ProductForm onClose={() => setCreating(false)} onSaved={refetch} />}
      {editing && <ProductForm existing={editing} onClose={() => setEditing(null)} onSaved={refetch} />}

      <p className="mb-4 text-sm text-ink-500">{t.stock.subtitle}</p>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={<Package className="size-5" />}      label={t.stock.totalProducts} value={stats.total}    tone="rose" />
        <StatCard icon={<AlertTriangle className="size-5" />} label={t.stock.lowStock}     value={stats.low}      tone="amber" />
        <StatCard icon={<CircleAlert className="size-5" />}   label={t.stock.needRestock}  value={stats.critical} tone="red" />
        <StatCard icon={<CircleCheck className="size-5" />}   label={t.stock.okStock}      value={stats.ok}       tone="emerald" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-cream-200 px-4 py-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
                 placeholder={`${t.stock.product}…`} className="max-w-xs" />
        </div>

        {loading && <Spinner label={t.common.loading} />}
        {error && <EmptyState>{t.common.error} — {error}</EmptyState>}
        {!loading && !error && rows.length === 0 && <EmptyState>{t.stock.empty}</EmptyState>}

        {!loading && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-rose-50/60 text-left text-[13px] text-ink-500">
                  <th className="px-4 py-3 font-medium">{t.stock.product}</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">{t.stock.category}</th>
                  <th className="px-4 py-3 text-right font-medium">
                    <span className="inline-flex items-center gap-1"><Store className="size-3.5" />Studio</span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    <span className="inline-flex items-center gap-1"><Home className="size-3.5" />Home</span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium">{t.stock.total}</th>
                  <th className="px-4 py-3 font-medium">{t.stock.statusLabel}</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">{t.stock.note}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-t border-cream-200 hover:bg-cream-50">
                    <td className="px-4 font-medium text-ink-700" style={{ paddingBlock: 'var(--row-py)' }}>
                      {p.code}
                    </td>
                    <td className="hidden px-4 sm:table-cell">
                      <Badge tone="violet">{p.category}</Badge>
                    </td>
                    <td className="px-4 text-right tabular-nums text-ink-600">{p.studio_qty}</td>
                    <td className="px-4 text-right tabular-nums text-ink-600">{p.home_qty}</td>
                    <td className="px-4 text-right font-semibold tabular-nums text-ink-800">{p.total_qty}</td>
                    <td className="px-4">
                      <Badge tone={statusTone[p.stock_status]}>{t.stock[p.stock_status]}</Badge>
                    </td>
                    <td className="hidden px-4 text-[13px] text-ink-500 lg:table-cell">
                      {p.note ?? t.common.none}
                    </td>
                    <td className="px-4">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" onClick={() => setAdjusting(p)}>{t.stock.adjust}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(p)} aria-label={t.common.edit}>
                          <Pencil className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-cream-200 px-4 py-3 text-xs text-ink-400">
          {t.stock.manualNote}
        </div>
      </Card>
    </AppShell>
  )
}
