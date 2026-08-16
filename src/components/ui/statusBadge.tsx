import type { CustomerStatus, DisplayStatus } from '@/types/database'
import { Badge, type BadgeTone } from './index'
import { useI18n } from '@/i18n'

const customerTone: Record<CustomerStatus, BadgeTone> = {
  active_followup: 'violet',
  pending_review: 'amber',
  dormant: 'slate',
  completed: 'emerald',
}

/** Mirrors the precedence in v_followup_board. Keep in sync with the view. */
const nodeTone: Record<DisplayStatus, BadgeTone> = {
  not_due: 'slate',
  due: 'amber',
  overdue: 'red',
  awaiting_reply: 'amber',
  replied: 'emerald',
  pending_booking: 'sky',
  booked: 'sky',
  done: 'emerald',
  skipped: 'slate',
}

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  const { t } = useI18n()
  return <Badge tone={customerTone[status]}>{t.status[status]}</Badge>
}

export function NodeStatusBadge({ status }: { status: DisplayStatus }) {
  const { t } = useI18n()
  return <Badge tone={nodeTone[status]}>{t.nodeStatus[status]}</Badge>
}
