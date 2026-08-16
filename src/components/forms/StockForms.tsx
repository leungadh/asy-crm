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

/** Stock take. The user enters what they COUNTED at each location; we store
 *  the DIFFERENCE, because stock is a movement ledger, not a stored quantity.
 *
 *  Both locations are shown at once deliberately. An earlier version had a
 *  Studio/Home toggle sharing one input, so a figure typed for one location
 *  stayed on screen after switching and was silently applied against the
 *  other location's current quantity. */
export function StockAdjustForm({ product, onClose, onSaved }: {
  product: StockLevel
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const { staff } = useAuth()

  const current: Record<StockLocation, number> = {
    studio: product.studio_qty,
    home: product.home_qty,
  }

  const [counted, setCounted] = useState<Record<StockLocation, string>>({
    studio: String(product.studio_qty),
    home: String(product.home_qty),
  })
  const [reason, setReason] = useState<MovementReason>('stock_take')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const [saving, setSaving] = useState(false)

  const deltaFor = (loc: StockLocation): number | null => {
    const raw = counted[loc].trim()
    if (raw === '') return null
    const n = Number(raw)
    if (Number.isNaN(n) || n < 0) return null
    return n - current[loc]
  }

  const studioDelta = deltaFor('studio')
  const homeDelta = deltaFor('home')
  const invalid = studioDelta === null || homeDelta === null
  const nothingChanged = studioDelta === 0 && homeDelta === 0

  const newTotal =
    invalid ? product.total_qty : Number(counted.studio) + Number(counted.home)

  async function submit() {
    if (invalid) return
    if (nothingChanged) { toast(t.stock.noChange); onClose(); return }

    setSaving(true)
    try {
      // One movement per changed location. recordStockCount is a no-op when
      // the delta is zero, so unchanged locations write nothing.
      for (const loc of ['studio', 'home'] as StockLocation[]) {
        await recordStockCount({
          product_id: product.id,
          location: loc,
          currentQty: current[loc],
          countedQty: Number(counted[loc]),
          reason,
          note,
          occurred_on: date,
        }, staff?.id)
      }
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
      title={`${t.stock.adjust} — ${product.code}`}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={submit} disabled={saving || invalid}>
            {saving ? t.form.saving : t.common.save}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-[13px] text-ink-500">{t.stock.countedQty}</p>

      <div className="grid grid-cols-2 gap-3">
        {(['studio', 'home'] as StockLocation[]).map((loc) => {
          const delta = loc === 'studio' ? studioDelta : homeDelta
          return (
            <div key={loc} className="rounded-lg border border-cream-200 px-3 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-medium capitalize text-ink-700">{loc}</span>
                <span className="text-xs text-ink-400">
                  {t.stock.currentQty}: {current[loc]}
                </span>
              </div>
              <Input
                value={counted[loc]}
                onChange={(e) => setCounted((c) => ({ ...c, [loc]: e.target.value }))}
                inputMode="numeric"
                className="text-right tabular-nums"
              />
              <p className={cn('mt-1.5 h-4 text-xs font-medium',
                delta === null ? 'text-red-600'
                  : delta > 0 ? 'text-emerald-600'
                  : delta < 0 ? 'text-red-600'
                  : 'text-ink-400')}>
                {delta === null
                  ? t.form.invalidAmount
                  : delta === 0
                    ? t.stock.noChange
                    : `${t.stock.delta} ${delta > 0 ? '+' : ''}${delta}`}
              </p>
            </div>
          )
        })}
      </div>

      <p className="mb-4 mt-1 text-right text-[13px] text-ink-500">
        {t.stock.total}:{' '}
        <span className="font-semibold text-ink-800 tabular-nums">{invalid ? '—' : newTotal}</span>
        {!invalid && newTotal !== product.total_qty && (
          <span className="ml-1 text-ink-400">（{product.total_qty} → {newTotal}）</span>
        )}
      </p>

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
