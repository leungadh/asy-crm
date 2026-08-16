import { useState } from 'react'
import { Info } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { FormRow, StarRating, Textarea } from '@/components/ui/form'
import { Button, Input, Select } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/i18n'
import { completeTreatment } from '@/lib/mutations'
import { PAYMENT_METHODS, type TreatmentRow } from '@/types/database'

/** Turns a booking into a performed treatment. Saving is what makes the
 *  database generate the follow-up timeline and the income row. */
export function CompleteTreatmentForm({ treatment, onClose, onSaved }: {
  treatment: TreatmentRow
  onClose: () => void
  onSaved: () => void
}) {
  const { t, locale } = useI18n()
  const toast = useToast()

  const [date, setDate] = useState(treatment.treatment_date)
  const [amount, setAmount] = useState('')
  const [payment, setPayment] = useState(treatment.payment_method ?? '')
  const [pigment, setPigment] = useState(treatment.pigment_used ?? '')
  const [remark, setRemark] = useState(treatment.remark ?? '')
  const [rating, setRating] = useState<number | null>(treatment.rating)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    const amt = Number(amount)
    if (!amount.trim() || Number.isNaN(amt) || amt < 0) { setError(t.form.invalidAmount); return }
    setError('')
    setSaving(true)
    try {
      await completeTreatment(treatment.id, {
        amount: amt, payment_method: payment, pigment_used: pigment,
        remark, rating, treatment_date: date,
      })
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
      open
      onClose={onClose}
      width="sm"
      title={t.treatments.completeTitle}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? t.form.saving : t.treatments.complete}
          </Button>
        </>
      }
    >
      <p className="mb-4 rounded-lg bg-cream-100 px-3 py-2.5 text-[13px] text-ink-600">
        {treatment.customer.name} ·{' '}
        {locale === 'en' ? treatment.service.name_en : treatment.service.name_zh}
        {treatment.detail && ` · ${treatment.detail}`}
      </p>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <FormRow label={t.form.date} required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormRow>
        <FormRow label={t.form.amount} required error={error}>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)}
                 inputMode="decimal" placeholder="4680" autoFocus />
        </FormRow>
        <FormRow label={t.form.paymentMethod}>
          <Select value={payment} onChange={(e) => setPayment(e.target.value)} className="w-full">
            <option value="">{t.form.selectPlaceholder}</option>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </FormRow>
        <FormRow label={t.form.pigment}>
          <Input value={pigment} onChange={(e) => setPigment(e.target.value)} />
        </FormRow>
      </div>

      <FormRow label={t.form.rating}>
        <StarRating value={rating} onChange={setRating} />
      </FormRow>

      <FormRow label={t.form.treatmentRemark}>
        <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} />
      </FormRow>

      <div className="flex gap-2 rounded-lg bg-cream-100 px-3 py-2.5 text-xs text-ink-500">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>{t.form.autoFollowupNote}。{t.form.autoIncomeNote}。</span>
      </div>
    </Modal>
  )
}
