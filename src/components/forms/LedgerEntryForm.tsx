import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { FormRow, Textarea } from '@/components/ui/form'
import { Button, Input, Select } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/i18n'
import { useAuth } from '@/hooks/useAuth'
import { useLedgerCategories } from '@/hooks/useLedger'
import { saveLedgerEntry } from '@/lib/mutations'
import { PAYMENT_METHODS, type LedgerEntry, type LedgerDirection } from '@/types/database'
import { cn } from '@/lib/utils'

export function LedgerEntryForm({ open, onClose, onSaved, existing, defaultMonth }: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  existing?: LedgerEntry
  defaultMonth: string
}) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const { staff } = useAuth()
  const categories = useLedgerCategories()

  const firstOfMonth = `${defaultMonth}-01`
  const todayInMonth =
    new Date().toISOString().slice(0, 7) === defaultMonth
      ? new Date().toISOString().slice(0, 10)
      : firstOfMonth

  const [direction, setDirection] = useState<LedgerDirection>(existing?.direction ?? 'expense')
  const [date, setDate] = useState(existing?.entry_date ?? todayInMonth)
  const [category, setCategory] = useState(existing?.category ?? '')
  const [item, setItem] = useState(existing?.item ?? '')
  const [amount, setAmount] = useState(existing ? String(Number(existing.amount)) : '')
  const [payment, setPayment] = useState(existing?.payment_method ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const options = direction === 'income' ? categories.income : categories.expense

  async function submit() {
    const next: Record<string, string> = {}
    if (!item.trim()) next.item = t.form.required
    if (!category) next.category = t.form.required
    const amt = Number(amount)
    if (!amount.trim() || Number.isNaN(amt) || amt < 0) next.amount = t.form.invalidAmount
    if (Object.keys(next).length) { setErrors(next); return }

    setErrors({})
    setSaving(true)
    try {
      await saveLedgerEntry(
        { entry_date: date, direction, category, item, amount: amt,
          payment_method: payment, note },
        existing?.id, staff?.id,
      )
      toast(t.form.saved)
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
      open={open}
      onClose={onClose}
      width="sm"
      title={existing ? t.ledger.edit : t.ledger.add}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? t.form.saving : t.common.save}
          </Button>
        </>
      }
    >
      <FormRow label={t.ledger.type} required>
        <div className="flex gap-2">
          {(['income', 'expense'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => { setDirection(d); setCategory('') }}
              className={cn(
                'flex-1 rounded-lg border px-3 py-2 text-sm transition-colors',
                direction === d
                  ? d === 'income'
                    ? 'border-emerald-300 bg-emerald-50 font-medium text-emerald-700'
                    : 'border-red-300 bg-red-50 font-medium text-red-700'
                  : 'border-cream-200 text-ink-600 hover:bg-cream-100',
              )}
            >
              {d === 'income' ? t.ledger.income : t.ledger.expense}
            </button>
          ))}
        </div>
      </FormRow>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <FormRow label={t.ledger.date} required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormRow>

        <FormRow label={t.ledger.category} required error={errors.category}>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full">
            <option value="">{t.form.selectPlaceholder}</option>
            {options.map((c) => (
              <option key={c.id} value={c.name_zh}>
                {locale === 'en' ? c.name_en : c.name_zh}
              </option>
            ))}
          </Select>
        </FormRow>
      </div>

      <FormRow label={t.ledger.item} required error={errors.item}>
        <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="租金" autoFocus />
      </FormRow>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <FormRow label={t.ledger.amount} required error={errors.amount}>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)}
                 inputMode="decimal" placeholder="9000" />
        </FormRow>

        <FormRow label={t.ledger.payment}>
          <Select value={payment} onChange={(e) => setPayment(e.target.value)} className="w-full">
            <option value="">{t.form.selectPlaceholder}</option>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </FormRow>
      </div>

      <FormRow label={t.ledger.note}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </FormRow>
    </Modal>
  )
}
