import { useState } from 'react'
import { Info } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { FormRow, Textarea } from '@/components/ui/form'
import { Button, Input, Select } from '@/components/ui'
import { CustomerPicker } from './CustomerPicker'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/i18n'
import { useServices } from '@/hooks/useCustomers'
import { useAuth } from '@/hooks/useAuth'
import { createTreatment } from '@/lib/mutations'
import { PAYMENT_METHODS } from '@/types/database'
import { cn } from '@/lib/utils'

const today = () => new Date().toISOString().slice(0, 10)
const DURATIONS = [30, 60, 90, 120, 150, 180]

/** One form, two modes. A booking is a treatment with status 'scheduled':
 *  same row, filled in later. */
export function TreatmentForm({ open, onClose, onSaved, customerId, defaultMode = 'booking' }: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** Omit to show the customer picker. */
  customerId?: string
  defaultMode?: 'booking' | 'record'
}) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const services = useServices()
  const { staff } = useAuth()

  const [mode, setMode] = useState<'booking' | 'record'>(defaultMode)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [pickedCustomer, setPickedCustomer] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [detail, setDetail] = useState('')
  const [date, setDate] = useState(today())
  const [startTime, setStartTime] = useState('11:00')
  const [duration, setDuration] = useState(90)
  const [amount, setAmount] = useState('')
  const [payment, setPayment] = useState('')
  const [pigment, setPigment] = useState('')
  const [remark, setRemark] = useState('')

  const targetCustomer = customerId ?? pickedCustomer

  function reset() {
    setPickedCustomer(''); setServiceId(''); setDetail(''); setAmount('')
    setPigment(''); setRemark(''); setPayment('')
    setDate(today()); setStartTime('11:00'); setDuration(90)
  }

  async function submit() {
    const next: Record<string, string> = {}
    if (!targetCustomer) next.customer = t.form.required
    if (!serviceId) next.service = t.form.required

    const amt = Number(amount)
    if (mode === 'record' && (!amount.trim() || Number.isNaN(amt) || amt < 0)) {
      next.amount = t.form.invalidAmount
    }
    if (Object.keys(next).length) { setErrors(next); return }

    setErrors({})
    setSaving(true)
    try {
      await createTreatment({
        customer_id: targetCustomer,
        service_id: serviceId,
        detail,
        treatment_date: date,
        start_time: startTime,
        duration_minutes: duration,
        amount: mode === 'record' ? amt : null,
        payment_method: mode === 'record' ? payment : undefined,
        pigment_used: mode === 'record' ? pigment : undefined,
        remark: mode === 'record' ? remark : undefined,
        // Ratings were dropped from the UI; the column stays for the
        // history already recorded.
        rating: null,
        status: mode === 'record' ? 'in_progress' : 'scheduled',
      }, staff?.id)

      toast(t.form.saved)
      reset()
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
      title={mode === 'booking' ? t.treatments.bookingMode : t.treatments.recordMode}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? t.form.saving : t.common.save}
          </Button>
        </>
      }
    >
      <div className="mb-4 flex gap-2">
        {(['booking', 'record'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn('flex-1 rounded-lg border px-3 py-2 text-sm transition-colors',
              mode === m
                ? 'border-[var(--accent-300)] bg-[var(--accent-50)] font-medium text-[var(--accent-600)]'
                : 'border-cream-200 text-ink-600 hover:bg-cream-100')}
          >
            {m === 'booking' ? t.treatments.booking : t.treatments.recordNow}
          </button>
        ))}
      </div>

      {!customerId && (
        <FormRow label={t.treatments.customer} required error={errors.customer}>
          <CustomerPicker value={pickedCustomer} onChange={setPickedCustomer} error={errors.customer} />
        </FormRow>
      )}

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

        <FormRow label={t.treatments.startTime}>
          <div className="flex gap-2">
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            <Select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>{d} {t.treatments.minutes}</option>
              ))}
            </Select>
          </div>
        </FormRow>
      </div>

      {mode === 'record' && (
        <>
          <div className="grid gap-x-4 sm:grid-cols-2">
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

          <FormRow label={t.form.treatmentRemark}>
            <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} />
          </FormRow>
        </>
      )}

      <div className="flex gap-2 rounded-lg bg-cream-100 px-3 py-2.5 text-xs text-ink-500">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {mode === 'booking'
            ? t.treatments.bookingHint
            : `${t.form.autoFollowupNote}。${t.form.autoIncomeNote}。`}
        </span>
      </div>
    </Modal>
  )
}
