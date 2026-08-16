import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, CalendarDays, ClipboardList,
  Package, CircleDollarSign, BarChart3, Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { Brand } from './Brand'

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n()

  const items = [
    { to: '/',           icon: LayoutDashboard,   label: t.nav.dashboard },
    { to: '/customers',  icon: Users,             label: t.nav.customers },
    { to: '/calendar',   icon: CalendarDays,      label: t.nav.calendar },
    { to: '/treatments', icon: ClipboardList,     label: t.nav.treatments },
    { to: '/stock',      icon: Package,           label: t.nav.stock },
    { to: '/ledger',     icon: CircleDollarSign,  label: t.nav.ledger },
    { to: '/reports',    icon: BarChart3,         label: t.nav.reports },
    { to: '/settings',   icon: Settings,          label: t.nav.settings },
  ]

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-cream-200 bg-cream-100">
      <div className="safe-top px-6 pb-6 pt-7">
        <Brand />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to} to={to} end={to === '/'} onClick={onNavigate}
            className={({ isActive }) =>
              cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-white font-medium text-[var(--accent-600)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                  : 'text-ink-600 hover:bg-white/60')
            }
          >
            <Icon className="size-[18px] shrink-0" strokeWidth={1.75} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="safe-bottom m-3 rounded-[--radius-card] bg-gradient-to-br from-cream-200 to-rose-50 px-4 py-5">
        <p className="text-[12px] leading-relaxed text-ink-500">{t.brand.motto}</p>
        <p className="mt-2 text-[11px] tracking-wider text-ink-400">— ASY BEAUTE</p>
      </div>
    </aside>
  )
}
