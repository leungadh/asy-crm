import { useState } from 'react'
import { Info } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { FormRow, Textarea } from '@/components/ui/form'
import { Button, Input, Select } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/i18n'
import { useAuth } from '@/hooks/useAuth'
import { recordStockCount, saveProduct, type ProductInput } from '@/lib/mutations'
import type { StockLevel, StockLocation, MovementReason } from '@/types/database'
import { cn } from '@/lib/utils'

const today = () => new Date().toISOString().slice(0, 10)

/** Stock take. The user enters what they COUNTED; we store the difference,
 *  because stock is a movement ledger, not a stored quantity. */
export function StockAdjustForm({ product, onClose, onSaved }: {
  product: StockLevel
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const { staff } = useAuth()

  const [location, setLocation] = useState<StockLocation>('studio')
  const [counted, setCounted] = useState('')
  const [reason, setReason] = useState<MovementReason>('stock_take')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const [saving, setSaving] = useState(false)

  const current = location === 'studio' ? product.studio_qty : product.home_qty
  const countedNum = counted.trim() === '' ? null : Number(counted)
  const delta = countedNum === null || Number.isNaN(countedNum) ? null : countedNum - current

  async function submit() {
    if (countedNum === null || Number.isNaN(countedNum) || countedNum < 0) return
    setSaving(true)
    try {
      const res = await recordStockCount({
        product_id: product.id, location, currentQty: current, countedQty: countedNum,
        reason, note, occurred_on: date,
      }, staff?.id)
      toast(res.changed ? t.form.saved : t.stock.noChange)
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
      title={`${t.stock.adjust} — ${product.code}`}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={submit} disabled={saving || delta === null}>
            {saving ? t.form.saving : t.common.save}
          </Button>
        </>
      }
    >
      <FormRow label={t.stock.location} required>
        <div className="flex gap-2">
          {(['studio', 'home'] as const).map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setLocation(loc)}
              className={cn(
                'flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition-colors',
                location === loc
                  ? 'border-[var(--accent-300)] bg-[var(--accent-50)] font-medium text-[var(--accent-600)]'
                  : 'border-cream-200 text-ink-600 hover:bg-cream-100',
              )}
            >
              {loc}
              <span className="ml-1.5 text-xs text-ink-400">
                {loc === 'studio' ? product.studio_qty : product.home_qty}
              </span>
            </button>
          ))}
        </div>
      </FormRow>

      <FormRow label={t.stock.countedQty} required
               hint={`${t.stock.currentQty}: ${current}`}>
        <Input value={counted} onChange={(e) => setCounted(e.target.value)}
               inputMode="numeric" autoFocus placeholder={String(current)} />
      </FormRow>

      {delta !== null && delta !== 0 && (
        <p className={cn('-mt-2 mb-4 text-sm font-medium',
          delta > 0 ? 'text-emerald-600' : 'text-red-600')}>
          {t.stock.delta}: {delta > 0 ? '+' : ''}{delta}
        </p>
      )}

      <div className="grid gap-x-4 sm:grid-cols-2">
        <FormRow label={t.stock.reason}>
          <Select value={reason} onChange={(e) => setReason(e.target.value as MovementReason)} className="w-full">
            <option value="stock_take">{t.stock.reasonStockTake}</option>
            <option value="purchase_in">{t.stock.reasonPurchaseIn}</option>
            <option value="sale_out">{t.stock.reasonSaleOut}</option>
            <option value="adjustment">{t.stock.reasonAdjustment}</option>
          </Select>
        </FormRow>
        <FormRow label={t.form.date}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormRow>
      </div>

      <FormRow label={t.stock.note}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </FormRow>

      <div className="flex gap-2 rounded-lg bg-cream-100 px-3 py-2.5 text-xs text-ink-500">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>{t.stock.manualNote}</span>
      </div>
    </Modal>
  )
}

export function ProductForm({ existing, onClose, onSaved }: {
  existing?: StockLevel
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState<ProductInput>({
    code: existing?.code ?? '',
    name_zh: existing?.name_zh ?? '',
    category: existing?.category ?? '保養產品',
    unit: existing?.unit ?? '件',
    low_stock_threshold: existing?.low_stock_threshold ?? 5,
    critical_stock_threshold: existing?.critical_stock_threshold ?? 3,
    note: existing?.note ?? '',
  })

  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  async function submit() {
    if (!form.code.trim()) { setErrors({ code: t.form.required }); return }
    setErrors({})
    setSaving(true)
    try {
      await saveProduct({ ...form, name_zh: form.name_zh.trim() || form.code.trim() }, existing?.id)
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
      title={existing ? t.stock.editProduct : t.stock.addProduct}
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
        <FormRow label={t.stock.code} required error={errors.code}>
          <Input value={form.code} onChange={(e) => set('code', e.target.value)} autoFocus placeholder="AL1" />
        </FormRow>
        <FormRow label={t.stock.name}>
          <Input value={form.name_zh} onChange={(e) => set('name_zh', e.target.value)} />
        </FormRow>
        <FormRow label={t.stock.category}>
          <Input value={form.category} onChange={(e) => set('category', e.target.value)} />
        </FormRow>
        <FormRow label={t.stock.unit}>
          <Input value={form.unit} onChange={(e) => set('unit', e.target.value)} />
        </FormRow>
        <FormRow label={t.stock.lowThreshold}>
          <Input value={String(form.low_stock_threshold)} inputMode="numeric"
                 onChange={(e) => set('low_stock_threshold', Number(e.target.value) || 0)} />
        </FormRow>
        <FormRow label={t.stock.criticalThreshold}>
          <Input value={String(form.critical_stock_threshold)} inputMode="numeric"
                 onChange={(e) => set('critical_stock_threshold', Number(e.target.value) || 0)} />
        </FormRow>
      </div>
      <FormRow label={t.stock.note}>
        <Textarea value={form.note} onChange={(e) => set('note', e.target.value)} rows={2} />
      </FormRow>
    </Modal>
  )
}
