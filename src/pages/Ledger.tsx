import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import {
  Wallet, TrendingDown, PiggyBank, Receipt, Plus, Download,
  CopyPlus, Pencil, Trash2, Lock,
} from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Button, Card, CardHeader, EmptyState, Input, Select, Spinner, StatCard } from '@/components/ui'
import { LedgerEntryForm } from '@/components/forms/LedgerEntryForm'
import { useToast } from '@/components/ui/toast'
import { useLedger, useAvailableMonths, previousMonth } from '@/hooks/useLedger'
import { useAuth } from '@/hooks/useAuth'
import { copyPreviousMonthExpenses, deleteLedgerEntry } from '@/lib/mutations'
import { useI18n } from '@/i18n'
import { cn, formatMoney } from '@/lib/utils'
import type { LedgerEntry } from '@/types/database'

const INCOME_COLOURS = ['#34d399', '#a7f3d0', '#fcd34d', '#93c5fd', '#c4b5fd']
const EXPENSE_COLOURS = ['#fb7185', '#fdba74', '#fca5a5', '#f9a8d4', '#d8b4fe']

const thisMonth = () => new Date().toISOString().slice(0, 7)

export default function Ledger() {
  const { t } = useI18n()
  const toast = useToast()
  const { staff } = useAuth()

  const [month, setMonth] = useState(thisMonth())
  const { entries, monthly, loading, error, refetch } = useLedger(month)
  const months = useAvailableMonths(monthly)

  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<LedgerEntry | null>(null)
  const [copying, setCopying] = useState(false)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (entries ?? []).filter((e) => {
      if (filter !== 'all' && e.direction !== filter) return false
      if (!q) return true
      return e.item.toLowerCase().includes(q) || (e.note ?? '').toLowerCase().includes(q)
    })
  }, [entries, filter, query])

  const totals = useMemo(() => {
    const all = entries ?? []
    const sum = (dir: 'income' | 'expense') =>
      all.filter((e) => e.direction === dir).reduce((a, e) => a + Number(e.amount), 0)
    const income = sum('income')
    const expense = sum('expense')
    return {
      income, expense, net: income - expense,
      count: all.length,
      incomeCount: all.filter((e) => e.direction === 'income').length,
      expenseCount: all.filter((e) => e.direction === 'expense').length,
    }
  }, [entries])

  const byCategory = (dir: 'income' | 'expense') => {
    const map = new Map<string, number>()
    for (const e of entries ?? []) {
      if (e.direction !== dir) continue
      map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount))
    }
    const total = [...map.values()].reduce((a, b) => a + b, 0)
    return [...map.entries()]
      .map(([name, value]) => ({ name, value, pct: total ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value)
  }

  const incomeCats = useMemo(() => byCategory('income'), [entries])
  const expenseCats = useMemo(() => byCategory('expense'), [entries])

  const prev = previousMonth(month)
  const prevRow = monthly.find((m) => m.month.slice(0, 7) === prev)
  const prevNet = prevRow ? Number(prevRow.net) : null
  const changePct =
    prevNet && prevNet !== 0 ? ((totals.net - prevNet) / Math.abs(prevNet)) * 100 : null

  function exportCsv() {
    const header = [t.ledger.date, t.ledger.type, t.ledger.item, t.ledger.category,
                    t.ledger.amount, t.ledger.payment, t.ledger.note]
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const lines = [
      header.map(esc).join(','),
      ...rows.map((e) => [
        e.entry_date,
        e.direction === 'income' ? t.ledger.income : t.ledger.expense,
        e.item, e.category, String(Number(e.amount)),
        e.payment_method ?? '', e.note ?? '',
      ].map(esc).join(',')),
    ]
    // BOM so Excel on macOS reads the Chinese columns as UTF-8 rather than mojibake.
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `asy-ledger-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function copyLastMonth() {
    setCopying(true)
    try {
      const { copied } = await copyPreviousMonthExpenses(prev, month, staff?.id)
      toast(copied ? t.ledger.copied.replace('{n}', String(copied)) : t.ledger.nothingToCopy)
      if (copied) refetch()
    } catch (e) {
      toast(`${t.form.saveFailed}: ${(e as Error).message}`, 'error')
    } finally {
      setCopying(false)
    }
  }

  async function remove(e: LedgerEntry) {
    if (!window.confirm(t.ledger.confirmDelete)) return
    try {
      await deleteLedgerEntry(e.id)
      toast(t.ledger.deleted)
      refetch()
    } catch (err) {
      toast(`${t.form.saveFailed}: ${(err as Error).message}`, 'error')
    }
  }

  return (
    <AppShell
      title={t.ledger.title}
      actions={
        <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" /><span className="hidden sm:inline">{t.ledger.add}</span>
        </Button>
      }
    >
      <LedgerEntryForm open={adding} onClose={() => setAdding(false)}
                       onSaved={refetch} defaultMonth={month} />
      {editing && (
        <LedgerEntryForm open onClose={() => setEditing(null)} onSaved={refetch}
                         existing={editing} defaultMonth={month} />
      )}

      <p className="mb-4 text-sm text-ink-500">{t.ledger.subtitle}</p>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={<Wallet className="size-5" />} label={t.ledger.monthIncome}
                  value={formatMoney(totals.income)} tone="emerald" />
        <StatCard icon={<TrendingDown className="size-5" />} label={t.ledger.monthExpense}
                  value={formatMoney(totals.expense)} tone="rose" />
        <StatCard icon={<PiggyBank className="size-5" />} label={t.ledger.monthNet}
                  value={formatMoney(totals.net)} tone="sky"
                  hint={changePct !== null
                    ? `${t.ledger.vsLastMonth} ${changePct > 0 ? '↑' : '↓'} ${Math.abs(changePct).toFixed(1)}%`
                    : undefined} />
        <StatCard icon={<Receipt className="size-5" />} label={t.ledger.monthCount}
                  value={totals.count} tone="amber"
                  hint={t.ledger.countHint
                    .replace('{i}', String(totals.incomeCount))
                    .replace('{e}', String(totals.expenseCount))} />
      </div>

      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-2 border-b border-cream-200 px-4 py-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
                 placeholder={t.ledger.search} className="min-w-[160px] max-w-xs flex-1" />

          <Select value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>

          <div className="flex gap-1">
            {(['all', 'income', 'expense'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn('rounded-lg px-3 py-1.5 text-[13px] transition-colors',
                  filter === f
                    ? f === 'income' ? 'bg-emerald-100 font-medium text-emerald-700'
                      : f === 'expense' ? 'bg-red-100 font-medium text-red-700'
                      : 'bg-cream-200 font-medium text-ink-700'
                    : 'text-ink-500 hover:bg-cream-100')}
              >
                {f === 'all' ? t.ledger.all : f === 'income' ? t.ledger.income : t.ledger.expense}
              </button>
            ))}
          </div>

          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={copyLastMonth} disabled={copying}>
              <CopyPlus className="size-3.5" />
              <span className="hidden lg:inline">{t.ledger.copyLastMonth}</span>
            </Button>
            <Button size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="size-3.5" />
              <span className="hidden lg:inline">{t.ledger.export}</span>
            </Button>
          </div>
        </div>

        {loading && <Spinner label={t.common.loading} />}
        {error && <EmptyState>{t.common.error} — {error}</EmptyState>}
        {!loading && !error && rows.length === 0 && <EmptyState>{t.ledger.empty}</EmptyState>}

        {!loading && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-rose-50/60 text-left text-[13px] text-ink-500">
                  <th className="px-4 py-3 font-medium">{t.ledger.date}</th>
                  <th className="px-4 py-3 font-medium">{t.ledger.type}</th>
                  <th className="px-4 py-3 font-medium">{t.ledger.item}</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">{t.ledger.category}</th>
                  <th className="px-4 py-3 text-right font-medium">{t.ledger.amount}</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">{t.ledger.payment}</th>
                  <th className="hidden px-4 py-3 font-medium xl:table-cell">{t.ledger.note}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-t border-cream-200 hover:bg-cream-50">
                    <td className="whitespace-nowrap px-4 text-ink-600" style={{ paddingBlock: 'var(--row-py)' }}>
                      {e.entry_date}
                    </td>
                    <td className="px-4">
                      <Badge tone={e.direction === 'income' ? 'emerald' : 'amber'}>
                        {e.direction === 'income' ? t.ledger.income : t.ledger.expense}
                      </Badge>
                    </td>
                    <td className="px-4">
                      <span className="text-ink-700">{e.item}</span>
                      {e.is_auto && (
                        <span title={t.ledger.autoRowHint}
                              className="ml-2 inline-flex items-center gap-1 text-[11px] text-ink-400">
                          <Lock className="size-3" />{t.ledger.autoRow}
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 text-ink-600 md:table-cell">{e.category}</td>
                    <td className={cn('whitespace-nowrap px-4 text-right font-medium tabular-nums',
                      e.direction === 'income' ? 'text-emerald-600' : 'text-red-600')}>
                      {e.direction === 'income' ? '' : '−'}{formatMoney(e.amount)}
                    </td>
                    <td className="hidden px-4 text-ink-600 lg:table-cell">
                      {e.payment_method ?? t.common.none}
                    </td>
                    <td className="hidden px-4 text-[13px] text-ink-500 xl:table-cell">
                      {e.note ?? t.common.none}
                    </td>
                    <td className="px-4">
                      <div className="flex justify-end gap-1">
                        {/* Auto rows are owned by a treatment or purchase. Editing
                            them here would desync the two records. */}
                        <Button size="sm" variant="ghost" disabled={e.is_auto}
                                onClick={() => setEditing(e)}
                                title={e.is_auto ? t.ledger.autoRowHint : t.common.edit}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" disabled={e.is_auto}
                                onClick={() => remove(e)}
                                title={e.is_auto ? t.ledger.autoRowHint : ''}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <CategoryDonut title={t.ledger.incomeByCategory} data={incomeCats}
                       total={totals.income} colours={INCOME_COLOURS} />
        <CategoryDonut title={t.ledger.expenseByCategory} data={expenseCats}
                       total={totals.expense} colours={EXPENSE_COLOURS} />

        <Card>
          <CardHeader title={t.ledger.summary} />
          <div className="divide-y divide-cream-200 px-5 py-1">
            <Row label={t.ledger.lastMonthNet}
                 value={prevNet === null ? t.common.none : formatMoney(prevNet)} />
            <Row label={t.ledger.thisMonthNet} value={formatMoney(totals.net)} strong />
            <Row
              label={t.ledger.change}
              value={changePct === null ? t.common.none
                : `${changePct > 0 ? '↑' : '↓'} ${Math.abs(changePct).toFixed(1)}%`}
              tone={changePct === null ? undefined : changePct >= 0 ? 'up' : 'down'}
            />
          </div>
        </Card>
      </div>
    </AppShell>
  )
}

function CategoryDonut({ title, data, total, colours }: {
  title: string
  data: { name: string; value: number; pct: number }[]
  total: number
  colours: string[]
}) {
  const { t } = useI18n()
  return (
    <Card>
      <CardHeader title={title} />
      {data.length === 0 ? (
        <EmptyState>{t.ledger.empty}</EmptyState>
      ) : (
        <div className="px-5 py-4">
          <div className="relative h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name"
                     innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                  {data.map((_, i) => <Cell key={i} fill={colours[i % colours.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatMoney(Number(v ?? 0))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-semibold text-ink-900">{formatMoney(total)}</span>
              <span className="text-[11px] text-ink-400">{t.ledger.total}</span>
            </div>
          </div>

          <ul className="mt-3 space-y-1.5">
            {data.map((d, i) => (
              <li key={d.name} className="flex items-center gap-2 text-[13px]">
                <span className="size-2.5 shrink-0 rounded-full"
                      style={{ background: colours[i % colours.length] }} />
                <span className="flex-1 truncate text-ink-600">{d.name}</span>
                <span className="tabular-nums text-ink-700">{formatMoney(d.value)}</span>
                <span className="w-12 text-right tabular-nums text-ink-400">{d.pct.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function Row({ label, value, strong, tone }: {
  label: string; value: string; strong?: boolean; tone?: 'up' | 'down'
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[13px] text-ink-500">{label}</span>
      <span className={cn('text-sm tabular-nums',
        strong ? 'font-semibold text-ink-900' : 'text-ink-700',
        tone === 'up' && 'text-emerald-600',
        tone === 'down' && 'text-red-600')}>
        {value}
      </span>
    </div>
  )
}
