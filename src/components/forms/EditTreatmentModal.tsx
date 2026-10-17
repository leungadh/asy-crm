import { useEffect, useState } from 'react'
import { AlertTriangle, Info, Trash2 } from 'lucide-react'
import { Button, Input, Select } from '@/components/ui'
import { FormRow, Textarea } from '@/components/ui/form'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/i18n'
import { useServices } from '@/hooks/useCustomers'
import { formatMoney } from '@/lib/utils'
import {
  updateTreatment, deleteTreatment, getTreatmentImpact, type TreatmentImpact,
} from '@/lib/mutations'
import { PAYMENT_METHODS, type Treatment } from '@/types/database'

const DURATIONS = [30, 60, 90, 120, 150, 180]

/** Edit or delete a treatment that has already been performed.
 *
 *  Changing the date here is not cosmetic: the income row moves with it, and
 *  0016's trigger shifts any follow-up still pending by the same number of
 *  days. Nodes already contacted or done keep their original dates, because
 *  those record something that really happened. The hint at the foot says so,
 *  since the effect is invisible from this form. */
export function EditTreatmentModal({ open, onClose, onSaved, treatment }: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  treatment: Treatment
}) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const services = useServices()

  const [serviceId, setServiceId] = useState(treatment.service_id)
  const [detail, setDetail] = useState(treatment.detail ?? '')
  const [date, setDate] = useState(treatment.treatment_date)
  const [startTime, setStartTime] = useState(treatment.start_time?.slice(0, 5) ?? '')
  const [duration, setDuration] = useState(treatment.duration_minutes ?? 90)
  const [amount, setAmount] = useState(treatment.amount ?? '')
  const [payment, setPayment] = useState(treatment.payment_method ?? '')
  const [pigment, setPigment] = useState(treatment.pigment_used ?? '')
  const [remark, setRemark] = useState(treatment.remark ?? '')

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [impact, setImpact] = useState<TreatmentImpact | null>(null)

  // Re-seed when a different treatment is opened through the same instance.
  useEffect(() => {
    if (!open) { setConfirmingDelete(false); setImpact(null); setErrors({}); return }
    setServiceId(treatment.service_id)
    setDetail(treatment.detail ?? '')
    setDate(treatment.treatment_date)
    setStartTime(treatment.start_time?.slice(0, 5) ?? '')
    setDuration(treatment.duration_minutes ?? 90)
    setAmount(treatment.amount ?? '')
    setPayment(treatment.payment_method ?? '')
    setPigment(treatment.pigment_used ?? '')
    setRemark(treatment.remark ?? '')
  }, [open, treatment])

  const dateMoved = date !== treatment.treatment_date

  async function openDeleteConfirm() {
    setConfirmingDelete(true)
    try {
      setImpact(await getTreatmentImpact(treatment.id))
    } catch (e) {
      toast((e as Error).message, 'error')
      setConfirmingDelete(false)
    }
  }

  async function save() {
    const next: Record<string, string> = {}
    if (!serviceId) next.service = t.form.required
    const amt = Number(amount)
    if (!String(amount).trim() || Number.isNaN(amt) || amt < 0) next.amount = t.form.invalidAmount
    if (Object.keys(next).length) { setErrors(next); return }

    setErrors({})
    setSaving(true)
    try {
      await updateTreatment(treatment.id, {
        service_id: serviceId,
        detail,
        treatment_date: date,
        start_time: startTime,
        duration_minutes: duration,
        amount: amt,
        payment_method: payment,
        pigment_used: pigment,
        remark,
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

  async function doDelete() {
    setSaving(true)
    try {
      await deleteTreatment(treatment.id)
      toast(t.editTreatment.deleted)
      onSaved()
      onClose()
    } catch (e) {
      toast(`${t.editTreatment.deleteFailed}: ${(e as Error).message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (confirmingDelete) {
    return (
      <Modal
        open={open}
        onClose={() => setConfirmingDelete(false)}
        title={t.editTreatment.deleteTitle}
        width="sm"
        footer={
          <>
            <Button onClick={() => setConfirmingDelete(false)} disabled={saving}>
              {t.common.cancel}
            </Button>
            <Button variant="danger" onClick={doDelete} disabled={saving || impact === null}>
              <Trash2 className="size-4" />
              {saving ? t.editTreatment.deleting : t.editTreatment.deleteConfirm}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-700">
            {t.editTreatment.deleteIntro.replace('{date}', treatment.treatment_date)}
          </p>
          {impact && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3">
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-amber-800">
                <AlertTriangle className="size-4" />
                {t.editTreatment.deleteWillRemove}
              </p>
              <ul className="space-y-1 text-[13px]">
                <Line label={t.editTreatment.deleteIncome}
                      value={impact.incomeRows === 0
                        ? t.common.none
                        : formatMoney(impact.amount ?? 0)} />
                <Line label={t.editTreatment.deleteNodes} value={String(impact.nodes)} />
              </ul>
              {impact.actionedNodes > 0 && (
                <p className="mt-2 text-xs text-amber-800">
                  {t.editTreatment.deleteActioned.replace('{n}', String(impact.actionedNodes))}
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.editTreatment.title}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={openDeleteConfirm}
            disabled={saving}
            className="mr-auto text-red-600 hover:bg-red-50"
          >
            <Trash2 className="size-4" />{t.common.delete}
          </Button>
          <Button onClick={onClose} disabled={saving}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? t.form.saving : t.common.save}
          </Button>
        </>
      }
    >
      <div className="grid gap-x-4 sm:grid-cols-2">
        <FormRow label={t.form.service} required error={errors.service}>
          <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="w-full">
            {services.map((s) => (
              <option key={s.id} value={s.id}>{locale === 'en' ? s.name_en : s.name_zh}</option>
            ))}
          </Select>
        </FormRow>

        <FormRow label={t.form.detail}>
          <Input value={detail} onChange={(e) => setDetail(e.target.value)} />
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

        <FormRow label={t.form.amount} required error={errors.amount}>
          <Input value={String(amount)} onChange={(e) => setAmount(e.target.value)}
                 inputMode="decimal" />
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

      <FormRow label={t.form.treatmentRemark}>
        <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} />
      </FormRow>

      <div className="flex gap-2 rounded-lg bg-cream-100 px-3 py-2.5 text-xs text-ink-500">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>{dateMoved ? t.editTreatment.dateMovedHint : t.editTreatment.hint}</span>
      </div>
    </Modal>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-4">
      <span className="text-ink-600">{label}</span>
      <span className="font-medium text-ink-900">{value}</span>
    </li>
  )
}
