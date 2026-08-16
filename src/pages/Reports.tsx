import { useMemo, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, PieChart, Pie, Cell, LabelList,
} from 'recharts'
import {
  DollarSign, PiggyBank, Users, Receipt, Download,
  Trophy, Sparkles, ShieldCheck, CircleCheck, Clock, CalendarCheck,
} from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Card, CardHeader, EmptyState, Select, Spinner, StatCard, Button } from '@/components/ui'
import { useReports } from '@/hooks/useReports'
import { useI18n } from '@/i18n'
import { cn, formatMoney } from '@/lib/utils'

const SOURCE_COLOURS = ['#f9a8d4', '#c4b5fd', '#fdba74', '#a7f3d0', '#93c5fd']
const monthKey = (iso: string) => iso.slice(0, 7)
const thisMonth = () => new Date().toISOString().slice(0, 7)

export default function Reports() {
  const { t, locale } = useI18n()
  const { data, loading, error } = useReports()
  const [month, setMonth] = useState(thisMonth())

  const months = useMemo(() => {
    const set = new Set((data?.monthly ?? []).map((m) => monthKey(m.month)))
    set.add(thisMonth())
    return [...set].sort().reverse()
  }, [data])

  const prevMonth = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7)
  }, [month])

  const ledger = data?.monthly.find((m) => monthKey(m.month) === month)
  const ledgerPrev = data?.monthly.find((m) => monthKey(m.month) === prevMonth)
  const cust = data?.customers.find((c) => monthKey(c.month) === month)
  const custPrev = data?.customers.find((c) => monthKey(c.month) === prevMonth)

  const services = useMemo(
    () => (data?.services ?? [])
      .filter((s) => monthKey(s.month) === month)
      .map((s) => ({ ...s, revenueNum: Number(s.revenue) }))
      .sort((a, b) => b.revenueNum - a.revenueNum),
    [data, month],
  )

  const serviceTotal = services.reduce((a, s) => a + s.revenueNum, 0)

  const trend = useMemo(
    () => (data?.monthly ?? []).slice(-12).map((m) => ({
      month: monthKey(m.month).slice(2),
      revenue: Number(m.income ?? 0),
      net: Number(m.net),
    })),
    [data],
  )

  const delta = (now?: number, before?: number) => {
    if (now === undefined || before === undefined || before === 0) return null
    return ((now - before) / Math.abs(before)) * 100
  }

  const fmtDelta = (d: number | null) =>
    d === null ? undefined : `${d >= 0 ? '↑' : '↓'} ${Math.abs(d).toFixed(1)}%`

  function exportCsv() {
    const rows = [
      ['month', 'revenue', 'expense', 'net', 'clients', 'treatments', 'new', 'returning', 'repeat_rate', 'avg_ticket'],
      ...(data?.monthly ?? []).map((m) => {
        const c = data?.customers.find((x) => x.month === m.month)
        return [
          monthKey(m.month), m.income ?? '0', m.expense ?? '0', m.net,
          c?.treatment_customers ?? 0, c?.treatment_count ?? 0,
          c?.new_customers ?? 0, c?.returning_customers ?? 0,
          c?.repeat_rate ?? '0', c?.avg_ticket ?? '0',
        ]
      }),
    ]
    const blob = new Blob(['﻿' + rows.map((r) => r.join(',')).join('\n')],
      { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `asy-report-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <AppShell title={t.reports.title}><Spinner label={t.common.loading} /></AppShell>
  if (error) return <AppShell title={t.reports.title}><EmptyState>{t.common.error} — {error}</EmptyState></AppShell>

  const top = services[0]
  const topSource = data?.sources[0]
  const fu = data?.followups
  const rr = data?.reviewRate

  return (
    <AppShell
      title={t.reports.title}
      actions={
        <>
          <Select value={month} onChange={(e) => setMonth(e.target.value)} className="h-8">
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
          <Button size="sm" onClick={exportCsv}>
            <Download className="size-3.5" /><span className="hidden sm:inline">{t.reports.export}</span>
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-ink-500">{t.reports.subtitle}</p>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={<DollarSign className="size-5" />} label={t.reports.revenue}
                  value={formatMoney(ledger?.income ?? 0)} tone="rose"
                  hint={fmtDelta(delta(Number(ledger?.income ?? 0), Number(ledgerPrev?.income ?? 0)))} />
        <StatCard icon={<PiggyBank className="size-5" />} label={t.reports.net}
                  value={formatMoney(ledger?.net ?? 0)} tone="emerald"
                  hint={fmtDelta(delta(Number(ledger?.net ?? 0), Number(ledgerPrev?.net ?? 0)))} />
        <StatCard icon={<Users className="size-5" />} label={t.reports.customers}
                  value={`${cust?.treatment_customers ?? 0} ${t.reports.people}`} tone="violet"
                  hint={fmtDelta(delta(cust?.treatment_customers, custPrev?.treatment_customers))} />
        <StatCard icon={<Receipt className="size-5" />} label={t.reports.avgTicket}
                  value={formatMoney(cust?.avg_ticket ?? 0)} tone="amber"
                  hint={fmtDelta(delta(Number(cust?.avg_ticket ?? 0), Number(custPrev?.avg_ticket ?? 0)))} />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={t.reports.trend} />
          <div className="h-64 px-3 py-4">
            {trend.length === 0 ? <EmptyState>{t.reports.noData}</EmptyState> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e14d70" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#e14d70" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5e9e6" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9c9490' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9c9490' }} axisLine={false} tickLine={false}
                         tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} width={38} />
                  <Tooltip formatter={(v) => formatMoney(Number(v ?? 0))} />
                  <Area type="monotone" dataKey="revenue" stroke="#e14d70" strokeWidth={2} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={t.reports.serviceRanking} />
          <div className="h-64 px-3 py-4">
            {services.length === 0 ? <EmptyState>{t.reports.noData}</EmptyState> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={services} layout="vertical"
                          margin={{ top: 4, right: 56, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5e9e6" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey={locale === 'en' ? 'name_en' : 'name_zh'}
                         tick={{ fontSize: 12, fill: '#6f6663' }} axisLine={false} tickLine={false} width={72} />
                  <Tooltip formatter={(v) => formatMoney(Number(v ?? 0))} />
                  <Bar dataKey="revenueNum" fill="#c4b5fd" radius={[0, 6, 6, 0]} barSize={22}>
                    <LabelList dataKey="revenueNum" position="right"
                               formatter={(v: unknown) => formatMoney(Number(v ?? 0))}
                               style={{ fontSize: 11, fill: '#6f6663' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        <Card>
          <CardHeader title={t.reports.sources} />
          {(data?.sources ?? []).length === 0 ? <EmptyState>{t.reports.noData}</EmptyState> : (
            <div className="px-5 py-4">
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data!.sources} dataKey="customer_count" nameKey="source"
                         innerRadius={40} outerRadius={62} paddingAngle={2} stroke="none">
                      {data!.sources.map((_, i) => (
                        <Cell key={i} fill={SOURCE_COLOURS[i % SOURCE_COLOURS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 space-y-1.5">
                {data!.sources.map((s, i) => (
                  <li key={s.source} className="flex items-center gap-2 text-[13px]">
                    <span className="size-2.5 shrink-0 rounded-full"
                          style={{ background: SOURCE_COLOURS[i % SOURCE_COLOURS.length] }} />
                    <span className="flex-1 truncate text-ink-600">{s.source}</span>
                    <span className="tabular-nums text-ink-400">{s.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title={t.reports.customerAnalysis} />
          <div className="grid grid-cols-2 gap-3 px-5 py-4">
            <Metric label={t.reports.newCustomers} value={cust?.new_customers ?? 0} tone="amber" />
            <Metric label={t.reports.returningCustomers} value={cust?.returning_customers ?? 0} tone="emerald" />
            <Metric label={t.reports.repeatRate} value={`${cust?.repeat_rate ?? 0}%`} tone="violet" />
            <Metric label={t.reports.reviewRate} value={`${rr?.rate ?? 0}%`} tone="rose" />
          </div>
        </Card>

        <Card>
          <CardHeader title={t.reports.followupStatus} />
          <div className="space-y-2.5 px-5 py-4">
            <Line icon={<CircleCheck className="size-4 text-emerald-600" />}
                  label={t.reports.done} value={fu?.done ?? 0} />
            <Line icon={<Clock className="size-4 text-amber-600" />}
                  label={t.reports.outstanding} value={fu?.outstanding ?? 0} />
            <Line icon={<CalendarCheck className="size-4 text-sky-600" />}
                  label={t.reports.booked} value={fu?.booked ?? 0} />
          </div>
        </Card>

        <Card>
          <CardHeader title={t.reports.summary} />
          <div className="space-y-4 px-5 py-4">
            {top && serviceTotal > 0 && (
              <Insight
                icon={<Trophy className="size-4 text-amber-500" />}
                title={t.reports.topService.replace('{name}', locale === 'en' ? top.name_en : top.name_zh)}
                body={t.reports.topServiceDetail
                  .replace(/\{name\}/g, locale === 'en' ? top.name_en : top.name_zh)
                  .replace('{amount}', formatMoney(top.revenueNum))
                  .replace('{pct}', ((top.revenueNum / serviceTotal) * 100).toFixed(1))}
              />
            )}
            {topSource && (
              <Insight
                icon={<Sparkles className="size-4 text-violet-500" />}
                title={t.reports.topSource.replace('{name}', topSource.source)}
                body={t.reports.topSourceDetail
                  .replace(/\{name\}/g, topSource.source)
                  .replace('{pct}', String(topSource.pct))}
              />
            )}
            {rr && (
              <Insight
                icon={<ShieldCheck className="size-4 text-emerald-600" />}
                title={t.reports.reviewSteady.replace('{rate}', String(rr.rate))}
                body={t.reports.reviewDetail}
              />
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  )
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  const bg: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-700', emerald: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700', rose: 'bg-rose-50 text-rose-700',
  }
  return (
    <div className={cn('rounded-lg px-3 py-2.5', bg[tone])}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function Line({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <span className="flex-1 text-[13px] text-ink-600">{label}</span>
      <span className="text-lg font-semibold tabular-nums text-ink-800">{value}</span>
    </div>
  )
}

function Insight({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink-800">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{body}</p>
      </div>
    </div>
  )
}
