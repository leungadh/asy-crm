import { useState } from 'react'
import { MessageCircle, Check, SkipForward, RotateCcw, CalendarPlus } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { FormRow, Textarea } from '@/components/ui/form'
import { Button, Input } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/i18n'
import { useAuth } from '@/hooks/useAuth'
import { updateNodeStatus, bookReview } from '@/lib/mutations'
import { waLink } from '@/lib/utils'
import type { FollowupBoardRow, NodeStatus } from '@/types/database'

/** Row-level actions on a follow-up node. Marking "message sent" opens
 *  WhatsApp via wa.me and records the action — we cannot observe the send,
 *  so the click is the signal. */
export function NodeActions({ node, onChanged }: { node: FollowupBoardRow; onChanged: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [booking, setBooking] = useState(false)

  const terminal = node.status === 'done' || node.status === 'skipped'

  async function mark(status: NodeStatus) {
    setBusy(true)
    try {
      await updateNodeStatus(node.id, status)
      toast(t.form.saved)
      onChanged()
    } catch (e) {
      toast(`${t.form.saveFailed}: ${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function contactViaWhatsApp() {
    const url = waLink(node.customer_phone,
      `${node.customer_name}，你好！${node.service_name} 療程後的${node.label_zh}，想了解一下你的情況。`)
    if (url) window.open(url, '_blank', 'noopener')
    await mark('contacted')
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {!terminal && node.node_type === 'follow_up' && node.status === 'pending' && node.customer_phone && (
          <Button size="sm" variant="whatsapp" disabled={busy} onClick={contactViaWhatsApp}
                  title={t.form.markContacted}>
            <MessageCircle className="size-3.5" />
          </Button>
        )}
        {!terminal && node.status === 'contacted' && (
          <Button size="sm" disabled={busy} onClick={() => mark('replied')}>{t.form.markReplied}</Button>
        )}
        {!terminal && node.node_type === 'review' && node.status !== 'booked' && (
          <Button size="sm" variant="primary" disabled={busy} onClick={() => setBooking(true)}>
            <CalendarPlus className="size-3.5" />
          </Button>
        )}
        {!terminal && (
          <>
            <Button size="sm" disabled={busy} onClick={() => mark('done')} title={t.form.markDone}>
              <Check className="size-3.5" />
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => mark('skipped')}
                    title={t.form.markSkipped}>
              <SkipForward className="size-3.5" />
            </Button>
          </>
        )}
        {terminal && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => mark('pending')}
                  title={t.form.reopen}>
            <RotateCcw className="size-3.5" />
          </Button>
        )}
      </div>

      {booking && (
        <BookReviewModal node={node} onClose={() => setBooking(false)} onSaved={onChanged} />
      )}
    </>
  )
}

function BookReviewModal({ node, onClose, onSaved }: {
  node: FollowupBoardRow
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const { staff } = useAuth()
  const [saving, setSaving] = useState(false)
  // Default to the first day of the suggested window at 11:00.
  const [when, setWhen] = useState(`${node.due_date}T11:00`)
  const [notes, setNotes] = useState('')

  async function submit() {
    setSaving(true)
    try {
      await bookReview({
        customer_id: node.customer_id,
        service_id: node.service_id,
        followup_node_id: node.id,
        starts_at: new Date(when).toISOString(),
        notes,
      }, staff?.id)
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
      title={t.form.bookReview}
      width="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? t.form.saving : t.common.save}
          </Button>
        </>
      }
    >
      <p className="mb-4 rounded-lg bg-cream-100 px-3 py-2.5 text-[13px] text-ink-600">
        {node.customer_name} · {node.service_name} · {node.label_zh}
        <br />
        <span className="text-ink-400">
          {t.detail.suggestedWindow}：{node.due_date}
          {node.window_end_date && ` – ${node.window_end_date}`}
        </span>
      </p>

      <FormRow label={t.form.appointmentTime} required>
        <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      </FormRow>

      <FormRow label={t.form.note}>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </FormRow>
    </Modal>
  )
}
