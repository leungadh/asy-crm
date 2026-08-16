import { buildIcs, type IcsEvent } from '../_lib/ics'

interface Env {
  SUPABASE_URL: string
  /** Server-side only. Never exposed to the browser, never committed. */
  SUPABASE_SERVICE_ROLE_KEY: string
  /** Long random string; whoever holds it can read the schedule. */
  ICS_TOKEN: string
}

interface CalendarRow {
  id: string
  source: string
  event_type: string
  event_at: string
  duration_minutes: number
  customer_name: string
  customer_phone: string | null
  service_name: string | null
  label: string | null
  event_status: string
}

/** Length-independent comparison so the token cannot be recovered by timing
 *  the response. Cheap insurance on a public endpoint. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export const onRequestGet: PagesFunction<Env> = async ({ params, request, env }) => {
  const token = String(params.token ?? '').replace(/\.ics$/, '')

  if (!env.ICS_TOKEN || !safeEqual(token, env.ICS_TOKEN)) {
    return new Response('Not found', { status: 404 })
  }

  const url = new URL(request.url)
  const includeFollowUps = url.searchParams.get('followups') === '1'

  // Six months back gives context without making the feed enormous.
  const from = new Date()
  from.setMonth(from.getMonth() - 6)

  const query = new URLSearchParams({
    select: 'id,source,event_type,event_at,duration_minutes,customer_name,customer_phone,service_name,label,event_status',
    event_at: `gte.${from.toISOString()}`,
    order: 'event_at.asc',
  })

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/v_calendar_events?${query}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  })

  if (!res.ok) {
    return new Response(`Upstream error: ${res.status}`, { status: 502 })
  }

  const rows = (await res.json()) as CalendarRow[]

  const events: IcsEvent[] = rows
    .filter((r) => {
      // Follow-ups are WhatsApp check-ins, not chair time. Off by default so
      // the calendar reflects where Yoyo physically needs to be.
      if (r.source === 'followup' || r.source === 'review_window') return includeFollowUps
      return true
    })
    .map((r) => {
      const timed = r.duration_minutes > 0
      const parts = [r.customer_name, r.service_name].filter(Boolean)

      return {
        // Stable across refreshes so clients update rather than duplicate.
        uid: `${r.source}-${r.id}@asy-crm`,
        start: new Date(r.event_at),
        durationMinutes: timed ? r.duration_minutes : undefined,
        summary: timed ? parts.join(' · ') : `${r.customer_name} · ${r.label ?? ''}`.trim(),
        description: [
          r.customer_phone ? `☎ ${r.customer_phone}` : null,
          r.label && r.label !== r.service_name ? r.label : null,
        ].filter(Boolean).join('\n') || undefined,
        status: r.event_status === 'scheduled' ? 'CONFIRMED' as const : 'TENTATIVE' as const,
      }
    })

  const body = buildIcs(events, {
    name: 'ASY Beaute',
    description: 'Bookings and reviews',
    refreshMinutes: 60,
  })

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="asy-beaute.ics"',
      // Google refetches on its own schedule regardless; this stops any proxy
      // in between serving a stale copy for longer.
      'Cache-Control': 'public, max-age=900',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
