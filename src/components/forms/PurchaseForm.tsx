import { useState } from 'react'
import { Info } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { FormRow, Textarea } from '@/components/ui/form'
import { Button, Input, Select } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/i18n'
import { useProducts } from '@/hooks/useCustomers'
import { useAuth } from '@/hooks/useAuth'
import { createPurchase } from '@/lib/mutations'
import { PAYMENT_METHODS, type StockLocation } from '@/types/database'

const today = () => new Date().toISOString().slice(0, 10)

export function PurchaseForm({ open, onClose, onSaved, customerId }: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  customerId: string
}) {
  const { t } = useI18n()
  const toast = useToast()
  const products = useProducts()
  const { staff } = useAuth()

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [amount, setAmount] = useState('')
  const [payment, setPayment] = useState('')
  const [shipFrom, setShipFrom] = useState<StockLocation>('studio')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')

  async function submit() {
    const next: Record<string, string> = {}
    if (!productId) next.product = t.form.required
    const qty = Number(quantity)
    if (!Number.isInteger(qty) || qty < 1) next.quantity = t.form.required
    const amt = Number(amount)
    if (!amount.trim() || Number.isNaN(amt) || amt < 0) next.amount = t.form.invalidAmount
    if (Object.keys(next).length) { setErrors(next); return }

    setErrors({})
    setSaving(true)
    try {
      await createPurchase(
        { customer_id: customerId, product_id: productId, quantity: qty, amount: amt,
          payment_method: payment, ship_from: shipFrom, purchase_date: date, note },
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.form.addPurchase}
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
        <FormRow label={t.form.product} required error={errors.product}>
          <Select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full">
            <option value="">{t.form.selectPlaceholder}</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
          </Select>
        </FormRow>

        <FormRow label={t.form.quantity} required error={errors.quantity}>
          <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" />
        </FormRow>

        <FormRow label={t.form.amount} required error={errors.amount}>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="380" />
        </FormRow>

        <FormRow label={t.form.paymentMethod}>
          <Select value={payment} onChange={(e) => setPayment(e.target.value)} className="w-full">
            <option value="">{t.form.selectPlaceholder}</option>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </FormRow>

        <FormRow label={t.form.shipFrom}>
          <Select value={shipFrom} onChange={(e) => setShipFrom(e.target.value as StockLocation)} className="w-full">
            <option value="studio">Studio</option>
            <option value="home">Home</option>
          </Select>
        </FormRow>

        <FormRow label={t.form.date} required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormRow>
      </div>

      <FormRow label={t.form.note}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </FormRow>

      <div className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>{t.form.autoPurchaseNote}</span>
      </div>
    </Modal>
  )
}
