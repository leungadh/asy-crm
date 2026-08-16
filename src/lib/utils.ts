import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** HKD, no decimals — the studio never charges cents. */
export function formatMoney(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0)
  return '$' + Math.round(n).toLocaleString('en-HK')
}

/** Initials for the generated avatars. No client photos are ever stored. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Deterministic pastel per person, so an avatar keeps its colour. */
export function avatarTone(seed: string): string {
  const tones = [
    'bg-rose-100 text-rose-600',
    'bg-amber-100 text-amber-700',
    'bg-violet-100 text-violet-700',
    'bg-emerald-100 text-emerald-700',
    'bg-sky-100 text-sky-700',
  ]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return tones[h % tones.length]
}

export function waLink(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  // Hong Kong numbers are 8 digits; prefix country code when it is missing.
  const intl = digits.length === 8 ? '852' + digits : digits
  const text = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${intl}${text}`
}
