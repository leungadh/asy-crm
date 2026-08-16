import { useMemo, useState } from 'react'
import { Search, UserPlus, X, Check } from 'lucide-react'
import { Avatar, Button, Input } from '@/components/ui'
import { CustomerForm } from './CustomerForm'
import { useCustomerList } from '@/hooks/useCustomers'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

/** Search, click a name to select it, and create the customer inline when
 *  there is no match. The previous multi-select list box gave no feedback
 *  about what had been chosen. */
export function CustomerPicker({ value, onChange, error }: {
  value: string
  onChange: (id: string) => void
  error?: string
}) {
  const { t } = useI18n()
  const { data, refetch } = useCustomerList()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const selected = useMemo(
    () => (data ?? []).find((c) => c.id === value) ?? null,
    [data, value],
  )

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return (data ?? []).slice(0, 6)
    return (data ?? [])
      .filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q))
      .slice(0, 8)
  }, [data, query])

  const exactMatch = (data ?? []).some(
    (c) => c.name.trim().toLowerCase() === query.trim().toLowerCase(),
  )

  // ── Selected state ──────────────────────────────────────────────────────
  if (selected) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-[var(--accent-300)] bg-[var(--accent-50)] px-3 py-2">
        <Avatar name={selected.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-800">{selected.name}</p>
          {selected.phone && <p className="truncate text-xs text-ink-500">{selected.phone}</p>}
        </div>
        <button type="button" onClick={() => { onChange(''); setQuery('') }}
                className="rounded p-1 text-ink-400 hover:bg-white" aria-label={t.common.close}>
          <X className="size-4" />
        </button>
      </div>
    )
  }

  // ── Search state ────────────────────────────────────────────────────────
  return (
    <>
      {creating && (
        <CustomerForm
          open
          onClose={() => setCreating(false)}
          onSaved={(id) => { refetch(); onChange(id); setQuery('') }}
          initialName={query.trim()}
        />
      )}

      <div className={cn('rounded-lg border', error ? 'border-red-300' : 'border-cream-200')}>
        <div className="relative border-b border-cream-200">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.treatments.searchCustomer}
            className="border-0 pl-9"
            autoFocus
          />
        </div>

        <ul className="max-h-52 overflow-y-auto">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => { onChange(c.id); setQuery('') }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-cream-50"
              >
                <Avatar name={c.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink-700">{c.name}</p>
                  {c.phone && <p className="truncate text-xs text-ink-400">{c.phone}</p>}
                </div>
                <Check className="size-4 shrink-0 text-transparent" />
              </button>
            </li>
          ))}

          {matches.length === 0 && (
            <li className="px-3 py-3 text-center text-[13px] text-ink-400">
              {t.customers.empty}
            </li>
          )}
        </ul>

        <div className="border-t border-cream-200 p-2">
          <Button type="button" size="sm" className="w-full" onClick={() => setCreating(true)}>
            <UserPlus className="size-3.5" />
            {query.trim() && !exactMatch
              ? t.treatments.createNamed.replace('{name}', query.trim())
              : t.customers.add}
          </Button>
        </div>
      </div>
    </>
  )
}
