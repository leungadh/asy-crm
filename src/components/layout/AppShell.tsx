import { useState, type ReactNode } from 'react'
import { Menu, X, Bell } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

export function AppShell({ title, actions, children }:
  { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { staff, signOut } = useAuth()
  const { t, locale, setLocale } = useI18n()

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <div className="hidden lg:block"><Sidebar /></div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/25" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0"><Sidebar onNavigate={() => setOpen(false)} /></div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="safe-top flex h-16 shrink-0 items-center gap-3 border-b border-cream-200 bg-white px-4 lg:px-6">
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg p-1.5 text-ink-500 hover:bg-cream-100 lg:hidden"
            aria-label="Menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>

          <h1 className="truncate text-lg font-semibold text-ink-900">{title}</h1>

          <div className="ml-auto flex items-center gap-2">
            {actions}
            <button
              onClick={() => setLocale(locale === 'zh-HK' ? 'en' : 'zh-HK')}
              className="rounded-lg px-2 py-1 text-xs font-medium text-ink-500 hover:bg-cream-100"
              title="Switch language"
            >
              {locale === 'zh-HK' ? 'EN' : '中'}
            </button>
            <button className="relative rounded-lg p-1.5 text-ink-500 hover:bg-cream-100" aria-label="Notifications">
              <Bell className="size-[18px]" strokeWidth={1.75} />
            </button>
            <button
              onClick={signOut}
              className={cn('flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-cream-100')}
              title={t.auth.signOut}
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-cream-200 text-xs font-semibold text-ink-600">
                {staff?.initials || '··'}
              </span>
              <span className="hidden text-sm text-ink-600 sm:inline">{staff?.display_name}</span>
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">{children}</main>
      </div>
    </div>
  )
}
