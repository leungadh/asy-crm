import { useState, type ReactNode, type TextareaHTMLAttributes, type KeyboardEvent } from 'react'
import { X, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FormRow({ label, required, hint, error, children, className }: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4', className)}>
      <label className="mb-1.5 block text-[13px] font-medium text-ink-600">
        {label}
        {required && <span className="ml-0.5 text-[var(--accent-500)]">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      className={cn(
        'w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-700',
        'placeholder:text-ink-400 focus:border-[var(--accent-300)] focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}

/** Free-form tags — deliberately not a fixed list. */
export function TagInput({ value, onChange, placeholder }: {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const tag = draft.trim()
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
    // Backspace on an empty field removes the last tag — standard chip behaviour.
    else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-cream-200 bg-white px-2 py-1.5 focus-within:border-[var(--accent-300)]">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-cream-200 px-2 py-0.5 text-xs text-ink-600">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((v) => v !== tag))}
                  className="text-ink-400 hover:text-ink-600">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={add}
        placeholder={value.length ? '' : placeholder}
        className="min-w-24 flex-1 bg-transparent text-sm text-ink-700 placeholder:text-ink-400 focus:outline-none"
      />
    </div>
  )
}

export function StarRating({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          className="rounded p-0.5 hover:bg-cream-100"
          aria-label={`${n}`}
        >
          <Star
            className={cn('size-5', (value ?? 0) >= n ? 'fill-amber-400 text-amber-400' : 'text-cream-200')}
          />
        </button>
      ))}
    </div>
  )
}
