import { useEffect, useState } from 'react'
import { Palette, SlidersHorizontal, Tags, UserCircle, Plus, Check, EyeOff, Eye, Lock, Pencil } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Button, Card, CardHeader, Input, Select, Spinner } from '@/components/ui'
import { FormRow } from '@/components/ui/form'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { usePreferences } from '@/hooks/usePreferences'
import { useAppSettings, useAllLedgerCategories, TUNABLE_KEYS, type TunableKey } from '@/hooks/useSettings'
import { useAuth } from '@/hooks/useAuth'
import { useI18n, type Locale } from '@/i18n'
import {
  saveAppSetting, createLedgerCategory, renameLedgerCategory, setLedgerCategoryActive,
} from '@/lib/mutations'
import { cn } from '@/lib/utils'
import type { LedgerCategory } from '@/types/database'

export default function Settings() {
  const { t, locale, setLocale } = useI18n()
  const { staff, signOut } = useAuth()
  const { prefs, update } = usePreferences()
  const toast = useToast()

  return (
    <AppShell title={t.settings.title}>
      <p className="mb-5 text-sm text-ink-500">{t.settings.subtitle}</p>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Appearance ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Palette className="size-4 text-ink-400" />{t.settings.appearance}
              </span>
            }
          />
          <div className="space-y-4 px-5 py-4">
            <p className="text-xs text-ink-400">{t.settings.appearanceHint}</p>

            <Choice
              label={t.settings.theme}
              value={prefs?.theme ?? 'rose'}
              onChange={(v) => update({ theme: v as 'rose' | 'blue' | 'sage' })}
              options={[
                { value: 'rose', label: t.settings.themeRose, swatch: '#e14d70' },
                { value: 'blue', label: t.settings.themeBlue, swatch: '#3b82f6' },
                { value: 'sage', label: t.settings.themeSage, swatch: '#5f9c76' },
              ]}
            />

            <Choice
              label={t.settings.density}
              value={prefs?.density ?? 'comfortable'}
              onChange={(v) => update({ density: v as 'compact' | 'comfortable' | 'spacious' })}
              options={[
                { value: 'compact', label: t.settings.densityCompact },
                { value: 'comfortable', label: t.settings.densityComfortable },
                { value: 'spacious', label: t.settings.densitySpacious },
              ]}
            />

            <Choice
              label={t.settings.radius}
              value={prefs?.corner_radius ?? 'medium'}
              onChange={(v) => update({ corner_radius: v as 'sharp' | 'medium' | 'round' })}
              options={[
                { value: 'sharp', label: t.settings.radiusSharp },
                { value: 'medium', label: t.settings.radiusMedium },
                { value: 'round', label: t.settings.radiusRound },
              ]}
            />

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-ink-600">
                {t.settings.fontSize}
                <span className="ml-2 font-normal text-ink-400">
                  {Math.round(Number(prefs?.font_scale ?? 1) * 100)}%
                </span>
              </label>
              <input
                type="range" min={0.8} max={1.4} step={0.05}
                value={Number(prefs?.font_scale ?? 1)}
                onChange={(e) => update({ font_scale: e.target.value })}
                className="w-full accent-[var(--accent-500)]"
              />
            </div>

            <div className="rounded-[--radius-card] border border-cream-200 bg-cream-50 px-4 py-3">
              <p className="mb-1 text-xs text-ink-400">{t.settings.preview}</p>
              <p className="text-sm text-ink-700">Carrie Chan · Areola · $4,680</p>
              <div className="mt-2 flex gap-1.5">
                <Badge tone="rose">VIP</Badge>
                <Badge tone="violet">跟進中</Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Business rules ─────────────────────────────────────────── */}
        <BusinessRules />

        {/* ── Categories ─────────────────────────────────────────────── */}
        <LedgerCategories />

        {/* ── Account ────────────────────────────────────────────────── */}
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <UserCircle className="size-4 text-ink-400" />{t.settings.account}
              </span>
            }
          />
          <div className="space-y-4 px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-ink-500">{t.settings.signedInAs}</span>
              <span className="text-sm text-ink-700">{staff?.display_name} · {staff?.email}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[13px] text-ink-500">{t.settings.language}</span>
              <Select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
                <option value="zh-HK">繁體中文</option>
                <option value="en">English</option>
              </Select>
            </div>

            <Button className="w-full" onClick={() => { toast(t.auth.signOut); signOut() }}>
              {t.auth.signOut}
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  )
}

function Choice({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string; swatch?: string }[]
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-ink-600">{label}</label>
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] transition-colors',
              value === o.value
                ? 'border-[var(--accent-300)] bg-[var(--accent-50)] font-medium text-[var(--accent-600)]'
                : 'border-cream-200 text-ink-600 hover:bg-cream-100')}
          >
            {o.swatch && <span className="size-3 rounded-full" style={{ background: o.swatch }} />}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function BusinessRules() {
  const { t } = useI18n()
  const toast = useToast()
  const { values, loading, refetch } = useAppSettings()
  const [draft, setDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    if (values) setDraft(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)])))
  }, [values])

  const meta: Record<TunableKey, { label: string; hint: string; unit: string; min: number; max: number }> = {
    dormant_after_days:    { label: t.settings.dormantDays,     hint: t.settings.dormantDaysHint,     unit: t.settings.days,   min: 30, max: 365 },
    new_customer_days:     { label: t.settings.newCustomerDays, hint: t.settings.newCustomerDaysHint, unit: t.settings.days,   min: 7,  max: 180 },
    followup_reminder_hour:{ label: t.settings.reminderHour,    hint: t.settings.reminderHourHint,    unit: t.settings.oclock, min: 0,  max: 23 },
    overdue_grace_days:    { label: t.settings.graceDays,       hint: t.settings.graceDaysHint,       unit: t.settings.days,   min: 0,  max: 30 },
  }

  async function save(key: TunableKey) {
    const n = Number(draft[key])
    const m = meta[key]
    if (Number.isNaN(n) || n < m.min || n > m.max) {
      toast(`${m.label}: ${m.min}–${m.max}`, 'error')
      return
    }
    try {
      await saveAppSetting(key, n)
      toast(t.settings.saved)
      refetch()
    } catch (e) {
      toast(`${t.form.saveFailed}: ${(e as Error).message}`, 'error')
    }
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-ink-400" />{t.settings.businessRules}
          </span>
        }
      />
      {loading ? <Spinner /> : (
        <div className="space-y-4 px-5 py-4">
          <p className="text-xs text-ink-400">{t.settings.businessRulesHint}</p>
          {TUNABLE_KEYS.map((key) => (
            <div key={key}>
              <label className="mb-1 block text-[13px] font-medium text-ink-600">
                {meta[key].label}
              </label>
              <div className="flex gap-2">
                <Input
                  value={draft[key] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  inputMode="numeric"
                  className="w-24 text-right tabular-nums"
                />
                <span className="self-center text-[13px] text-ink-400">{meta[key].unit}</span>
                <Button
                  size="sm"
                  className="ml-auto"
                  disabled={String(values?.[key] ?? '') === (draft[key] ?? '')}
                  onClick={() => save(key)}
                >
                  <Check className="size-3.5" />{t.common.save}
                </Button>
              </div>
              <p className="mt-1 text-xs text-ink-400">{meta[key].hint}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function LedgerCategories() {
  const { t, locale } = useI18n()
  const toast = useToast()
  const { rows, refetch } = useAllLedgerCategories()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<LedgerCategory | null>(null)

  async function toggle(cat: LedgerCategory) {
    try {
      await setLedgerCategoryActive(cat.id, !cat.is_active)
      refetch()
    } catch (e) {
      toast(`${t.form.saveFailed}: ${(e as Error).message}`, 'error')
    }
  }

  const groups: ['income' | 'expense', string][] = [
    ['income', t.ledger.income],
    ['expense', t.ledger.expense],
  ]

  return (
    <>
      {adding && <CategoryModal onClose={() => setAdding(false)} onSaved={refetch} />}
      {editing && <CategoryModal existing={editing} onClose={() => setEditing(null)} onSaved={refetch} />}

      <Card className="lg:col-span-2">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Tags className="size-4 text-ink-400" />{t.settings.categories}
            </span>
          }
          action={
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" />{t.settings.addCategory}
            </Button>
          }
        />
        <div className="grid gap-x-8 px-5 py-4 sm:grid-cols-2">
          {groups.map(([dir, label]) => (
            <div key={dir}>
              <p className="mb-2 text-[13px] font-medium text-ink-600">{label}</p>
              <ul className="divide-y divide-cream-200">
                {rows.filter((r) => r.direction === dir).map((cat) => (
                  <li key={cat.id} className="flex items-center gap-2 py-2">
                    <span className={cn('flex-1 truncate text-[13px]',
                      cat.is_active ? 'text-ink-700' : 'text-ink-400 line-through')}>
                      {locale === 'en' ? cat.name_en : cat.name_zh}
                    </span>

                    {cat.is_system ? (
                      <span title={t.settings.systemLocked}>
                        <Lock className="size-3.5 text-ink-300" />
                      </span>
                    ) : (
                      <>
                        {!cat.is_active && <Badge tone="slate">{t.settings.hidden}</Badge>}
                        <Button size="sm" variant="ghost" title={t.settings.rename}
                                onClick={() => setEditing(cat)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost"
                                title={cat.is_active ? t.settings.hide : t.settings.unhide}
                                onClick={() => toggle(cat)}>
                          {cat.is_active ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="border-t border-cream-200 px-5 py-3 text-xs text-ink-400">
          {t.settings.categoriesHint}
        </p>
      </Card>
    </>
  )
}

function CategoryModal({ existing, onClose, onSaved }: {
  existing?: LedgerCategory
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const [direction, setDirection] = useState<'income' | 'expense'>(existing?.direction ?? 'expense')
  const [nameZh, setNameZh] = useState(existing?.name_zh ?? '')
  const [nameEn, setNameEn] = useState(existing?.name_en ?? '')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!nameZh.trim()) return
    setSaving(true)
    try {
      if (existing) await renameLedgerCategory(existing.id, nameZh, nameEn)
      else await createLedgerCategory({ direction, name_zh: nameZh, name_en: nameEn })
      toast(t.settings.saved)
      onSaved()
      onClose()
    } catch (e) {
      toast(`${t.form.saveFailed}: ${(e as Error).message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open onClose={onClose} width="sm"
      title={existing ? t.settings.rename : t.settings.addCategory}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={submit} disabled={saving || !nameZh.trim()}>
            {saving ? t.form.saving : t.common.save}
          </Button>
        </>
      }
    >
      {!existing && (
        <FormRow label={t.ledger.type} required>
          <Select value={direction} onChange={(e) => setDirection(e.target.value as 'income' | 'expense')}
                  className="w-full">
            <option value="expense">{t.ledger.expense}</option>
            <option value="income">{t.ledger.income}</option>
          </Select>
        </FormRow>
      )}
      <FormRow label="中文名稱" required>
        <Input value={nameZh} onChange={(e) => setNameZh(e.target.value)} autoFocus placeholder="租金" />
      </FormRow>
      <FormRow label="English name">
        <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Rent" />
      </FormRow>
      {existing && (
        <p className="rounded-lg bg-cream-100 px-3 py-2.5 text-xs text-ink-500">
          {t.settings.categoriesHint}
        </p>
      )}
    </Modal>
  )
}
