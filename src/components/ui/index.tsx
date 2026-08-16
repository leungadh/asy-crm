import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react'
import { cn, initials, avatarTone } from '@/lib/utils'

/* ─── Card ──────────────────────────────────────────────────────────────── */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-[--radius-card] border border-cream-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ title, action, className }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 border-b border-cream-200 px-5 py-4', className)}>
      <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
      {action}
    </div>
  )
}

/* ─── Button ────────────────────────────────────────────────────────────── */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost' | 'whatsapp'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'outline', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-500)]',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-9 px-4 text-sm',
        variant === 'primary' &&
          'bg-[var(--accent-500)] text-white hover:bg-[var(--accent-600)]',
        variant === 'outline' &&
          'border border-cream-200 bg-white text-ink-600 hover:bg-cream-100',
        variant === 'ghost' && 'text-ink-500 hover:bg-cream-100',
        variant === 'whatsapp' &&
          'border border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50',
        className,
      )}
      {...props}
    />
  )
}

/* ─── Badge ─────────────────────────────────────────────────────────────── */
const badgeTones = {
  rose:    'bg-rose-100 text-rose-700',
  violet:  'bg-violet-100 text-violet-700',
  pink:    'bg-pink-100 text-pink-700',
  amber:   'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  sky:     'bg-sky-100 text-sky-700',
  slate:   'bg-slate-100 text-slate-600',
  red:     'bg-red-100 text-red-700',
} as const

export type BadgeTone = keyof typeof badgeTones

export function Badge({ tone = 'slate', children, className }:
  { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
      badgeTones[tone], className)}>
      {children}
    </span>
  )
}

/* ─── Avatar (generated initials — no photos are ever stored) ───────────── */
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const dims = { sm: 'size-8 text-[11px]', md: 'size-9 text-xs', lg: 'size-12 text-sm', xl: 'size-24 text-2xl' }[size]
  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold', dims, avatarTone(name))}
         aria-hidden>
      {initials(name)}
    </div>
  )
}

/* ─── Form controls ─────────────────────────────────────────────────────── */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-lg border border-cream-200 bg-white px-3 text-sm text-ink-700',
        'placeholder:text-ink-400 focus:border-[var(--accent-300)] focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 rounded-lg border border-cream-200 bg-white px-3 text-sm text-ink-600',
        'focus:border-[var(--accent-300)] focus:outline-none',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

/* ─── Stat card ─────────────────────────────────────────────────────────── */
export function StatCard({ icon, label, value, hint, tone = 'rose' }:
  { icon: ReactNode; label: string; value: ReactNode; hint?: ReactNode; tone?: BadgeTone }) {
  return (
    <Card className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', badgeTones[tone])}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] text-ink-500">{label}</p>
          <p className="text-2xl font-semibold leading-tight text-ink-900">{value}</p>
          {hint && <p className="text-xs text-ink-400">{hint}</p>}
        </div>
      </div>
    </Card>
  )
}

/* ─── Misc ──────────────────────────────────────────────────────────────── */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-[13px] text-ink-500">{label}</span>
      <span className="text-right text-[13px] font-medium text-ink-700">{children}</span>
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-400">
      <span className="size-4 animate-spin rounded-full border-2 border-cream-200 border-t-[var(--accent-500)]" />
      {label}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="py-16 text-center text-sm text-ink-400">{children}</div>
}
