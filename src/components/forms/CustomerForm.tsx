import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { FormRow, TagInput, Textarea } from '@/components/ui/form'
import { Button, Input, Select } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/i18n'
import { saveCustomer, type CustomerInput } from '@/lib/mutations'
import { CUSTOMER_SOURCES, type Customer, type CustomerStatus } from '@/types/database'

export function CustomerForm({ open, onClose, onSaved, existing }: {
  open: boolean
  onClose: () => void
  onSaved: (id: string) => void
  existing?: Customer
}) {
  const { t } = useI18n()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState<CustomerInput>({
    name: existing?.name ?? '',
    phone: existing?.phone ?? '',
    source: existing?.source ?? '',
    instagram: existing?.instagram ?? '',
    birthday: existing?.birthday ?? '',
    occupation: existing?.occupation ?? '',
    tags: existing?.tags ?? [],
    remark: existing?.remark ?? '',
    status: existing?.status ?? 'active_followup',
  })

  const set = <K extends keyof CustomerInput>(k: K, v: CustomerInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  async function submit() {
    if (!form.name.trim()) { setErrors({ name: t.form.required }); return }
    setErrors({})
    setSaving(true)
    try {
      const id = await saveCustomer(form, existing?.id)
      toast(t.form.saved)
      onSaved(id)
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
      title={existing ? t.form.editCustomer : t.form.addCustomer}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? t.form.saving : t.common.save}
          </Button>
        </>
      }
    >
      <FormRow label={t.form.name} required error={errors.name}>
        <Input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
      </FormRow>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <FormRow label={t.form.phone}>
          <Input value={form.phone} onChange={(e) => set('phone', e.target.value)}
                 inputMode="tel" placeholder="9123 4567" />
        </FormRow>
        <FormRow label={t.form.instagram}>
          <Input value={form.instagram} onChange={(e) => set('instagram', e.target.value)}
                 placeholder="username" />
        </FormRow>
        <FormRow label={t.form.source}>
          <Select value={form.source} onChange={(e) => set('source', e.target.value)} className="w-full">
            <option value="">{t.form.selectPlaceholder}</option>
            {CUSTOMER_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </FormRow>
        <FormRow label={t.form.occupation}>
          <Input value={form.occupation} onChange={(e) => set('occupation', e.target.value)} />
        </FormRow>
        <FormRow label={t.form.birthday}>
          <Input type="date" value={form.birthday} onChange={(e) => set('birthday', e.target.value)} />
        </FormRow>
        <FormRow label={t.form.status}>
          <Select value={form.status}
                  onChange={(e) => set('status', e.target.value as CustomerStatus)} className="w-full">
            {(['active_followup', 'pending_review', 'dormant', 'completed'] as const).map((s) => (
              <option key={s} value={s}>{t.status[s]}</option>
            ))}
          </Select>
        </FormRow>
      </div>

      <FormRow label={t.form.tags} hint={t.form.tagsHint}>
        <TagInput value={form.tags} onChange={(tags) => set('tags', tags)} placeholder="VIP, 敏感肌…" />
      </FormRow>

      <FormRow label={t.form.remark} hint={t.detail.remarkHint}>
        <Textarea value={form.remark} onChange={(e) => set('remark', e.target.value)} rows={4} />
      </FormRow>
    </Modal>
  )
}
