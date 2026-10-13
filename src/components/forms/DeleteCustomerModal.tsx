import { useEffect, useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Button, Input, Spinner } from '@/components/ui'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/i18n'
import { formatMoney } from '@/lib/utils'
import { deleteCustomer, getCustomerImpact, type CustomerImpact } from '@/lib/mutations'

/** Deleting a customer cascades through treatments, bookings, purchases and the
 *  income rows behind them. There is no undo short of a backup restore.
 *
 *  So the dialog does two things a plain "are you sure?" cannot: it shows what
 *  will actually be destroyed, counted from the database rather than guessed at,
 *  and it requires the customer's name to be typed. A test client reads as all
 *  zeroes, which is the signal that it is safe to remove. */
export function DeleteCustomerModal({ open, onClose, onDeleted, customerId, customerName }: {
  open: boolean
  onClose: () => void
  onDeleted: () => void
  customerId: string
  customerName: string
}) {
  const { t } = useI18n()
  const toast = useToast()
  const [impact, setImpact] = useState<CustomerImpact | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) { setImpact(null); setTyped(''); setLoadError(null); return }
    let cancelled = false
    getCustomerImpact(customerId)
      .then((r) => { if (!cancelled) setImpact(r) })
      .catch((e) => { if (!cancelled) setLoadError(e.message) })
    return () => { cancelled = true }
  }, [open, customerId])

  // Trim only. Names are compared as typed otherwise — a near-miss should fail.
  const confirmed = typed.trim() === customerName.trim()
  const isEmpty = impact !== null
    && impact.treatments === 0 && impact.bookings === 0
    && impact.purchases === 0 && impact.appointments === 0

  async function onDelete() {
    setBusy(true)
    try {
      await deleteCustomer(customerId)
      toast(t.detail.deleted.replace('{name}', customerName))
      onDeleted()
      onClose()
    } catch (e) {
      toast(`${t.detail.deleteFailed}: ${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.detail.deleteTitle}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>{t.common.cancel}</Button>
          <Button
            variant="danger"
            onClick={onDelete}
            disabled={!confirmed || busy || impact === null}
          >
            <Trash2 className="size-4" />
            {busy ? t.detail.deleting : t.detail.deleteConfirm}
          </Button>
        </>
      }
    >
      {loadError && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{loadError}</p>
      )}

      {!impact && !loadError && <Spinner label={t.common.loading} />}

      {impact && (
        <div className="space-y-4">
          <p className="text-sm text-ink-700">
            {t.detail.deleteIntro.replace('{name}', customerName)}
          </p>

          {isEmpty ? (
            <p className="rounded-lg border border-cream-200 bg-cream-50 px-4 py-3 text-[13px] text-ink-600">
              {t.detail.deleteNoRecords}
            </p>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3">
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-amber-800">
                <AlertTriangle className="size-4" />
                {t.detail.deleteWillRemove}
              </p>
              <ul className="space-y-1 text-[13px] text-ink-700">
                <Line label={t.detail.deleteTreatments} value={String(impact.treatments)} />
                <Line label={t.detail.deleteBookings} value={String(impact.bookings)} />
                <Line label={t.detail.deletePurchases} value={String(impact.purchases)} />
                <Line label={t.detail.deleteAppointments} value={String(impact.appointments)} />
                <Line label={t.detail.deleteIncome} value={formatMoney(impact.income)} strong />
              </ul>
              {impact.income > 0 && (
                <p className="mt-2 text-xs text-amber-800">{t.detail.deleteRevenueWarning}</p>
              )}
              {impact.detachedEntries > 0 && (
                <p className="mt-2 text-xs text-ink-500">
                  {t.detail.deleteDetached.replace('{n}', String(impact.detachedEntries))}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[13px] text-ink-600">
              {t.detail.deleteTypeName.replace('{name}', customerName)}
            </label>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={customerName}
              autoComplete="off"
            />
          </div>
        </div>
      )}
    </Modal>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-4">
      <span className="text-ink-600">{label}</span>
      <span className={strong ? 'font-semibold text-ink-900' : 'text-ink-800'}>{value}</span>
    </li>
  )
}
