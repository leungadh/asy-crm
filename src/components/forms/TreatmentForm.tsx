import { useState } from 'react'
import { Info } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { FormRow, StarRating, Textarea } from '@/components/ui/form'
import { Button, Input, Select } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/i18n'
import { useServices } from '@/hooks/useCustomers'
import { useAuth } from '@/hooks/useAuth'
import { createTreatment } from '@/lib/mutations'
import { PAYMENT_METHODS } from '@/types/database'

const today = () => new Date().toISOString().slice(0, 10)

export function TreatmentForm({ open, onClose, onSaved, customerId }: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  customerId: string
}) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const services = useServices()
  const { staff } = useAuth()

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serviceId, setServiceId] = useState('')
  const [detail, setDetail] = useState('')
  const [date, setDate] = useState(today())
  const [amount, setAmount] = useState('')
  const [payment, setPayment] = useState('')
  const [pigment, setPigment] = useState('')
  const [remark, setRemark] = useState('')
  const [rating, setRating] = useState<number | null>(null)

  async function submit() {
    const next: Record<string, string> = {}
    if (!serviceId) next.service = t.form.required
    const amt = Number(amount)
    if (!amount.trim() || Number.isNaN(amt) || amt < 0) next.amount = t.form.invalidAmount
    if (Object.keys(next).length) { setErrors(next); return }

    setErrors({})
    setSaving(true)
    try {
      await createTreatment(
        { customer_id: customerId, service_id: serviceId, detail, treatment_date: date,
          amount: amt, payment_method: payment, pigment_used: pigment, remark, rating },
        staff?.id,
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

  const selected = services.find((s) => s.id === serviceId)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.form.addTreatment}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? t.form.saving : t.common.save}
          </Button>
        </>
      }
    >
      <div className="grid gap-x-4 sm:grid-cols-2">
        <FormRow label={t.form.service} required error={errors.service}>
          <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="w-full">
            <option value="">{t.form.selectPlaceholder}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{locale === 'en' ? s.name_en : s.name_zh}</option>
            ))}
          </Select>
        </FormRow>

        <FormRow label={t.form.detail}>
          <Input value={detail} onChange={(e) => setDetail(e.target.value)}
                 placeholder={selected?.code === 'vio' ? 'V+I+O' : '雙側乳暈'} />
        </FormRow>

        <FormRow label={t.form.date} required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormRow>

        <FormRow label={t.form.amount} required hint={t.form.amountHint} error={errors.amount}>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)}
                 inputMode="decimal" placeholder="4680" />
        </FormRow>

        <FormRow label={t.form.paymentMethod}>
          <Select value={payment} onChange={(e) => setPayment(e.target.value)} className="w-full">
            <option value="">{t.form.selectPlaceholder}</option>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </FormRow>

        <FormRow label={t.form.pigment}>
          <Input value={pigment} onChange={(e) => setPigment(e.target.value)} placeholder="Areola Mix 2" />
        </FormRow>
      </div>

      <FormRow label={t.form.rating}>
        <StarRating value={rating} onChange={setRating} />
      </FormRow>

      <FormRow label={t.form.treatmentRemark}>
        <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} />
      </FormRow>

      <div className="flex gap-2 rounded-lg bg-cream-100 px-3 py-2.5 text-xs text-ink-500">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>{t.form.autoFollowupNote}。{t.form.autoIncomeNote}。</span>
      </div>
    </Modal>
  )
}
