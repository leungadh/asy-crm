import { buildIcs, type IcsEvent } from './ics'

export interface Env {
  ASSETS: Fetcher
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

async function calendarFeed(request: Request, env: Env, token: string): Promise<Response> {
  // Trim both sides. `openssl rand -hex 32` emits 64 characters plus a
  // newline, and pasting that into a dashboard field stores 65 — which fails
  // the length check with no way to see why, since secrets are write-only.
  const expected = (env.ICS_TOKEN ?? '').trim()
  const supplied = token.trim()

  if (!expected || !safeEqual(supplied, expected)) {
    // The response is identical either way, so the endpoint's existence is not
    // confirmed to someone guessing. The log distinguishes them, because
    // "not configured" and "wrong token" need completely different fixes and
    // are otherwise indistinguishable from outside.
    console.log(
      expected
        ? `calendar: token mismatch (supplied ${supplied.length} chars, expected ${expected.length})`
        : 'calendar: ICS_TOKEN is not configured on this Worker',
    )
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

  if (!res.ok) return new Response(`Upstream error: ${res.status}`, { status: 502 })

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
      'Cache-Control': 'public, max-age=900',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

/** Supabase pauses a free project after 7 days of no API traffic. Yoyo using
 *  the app daily prevents that on its own, but a holiday or a quiet spell
 *  would not — and the failure is silent until someone tries to sign in.
 *
 *  A single cheap read is enough to count as activity. */
async function keepAlive(env: Env): Promise<void> {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/app_settings?select=key&limit=1`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  )

  // Logged rather than thrown: a failed ping is worth seeing in `wrangler tail`
  // but must not retry aggressively or mark the schedule as failing.
  if (res.ok) {
    console.log('keep-alive ok')
  } else {
    console.error(`keep-alive failed: ${res.status} ${await res.text()}`)
  }
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(keepAlive(env))
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // run_worker_first in wrangler.toml means only /calendar/* reaches here
    // ahead of the assets; everything else is served directly.
    const match = url.pathname.match(/^\/calendar\/([^/]+?)(?:\.ics)?$/)
    if (match) {
      if (request.method !== 'GET') {
        return new Response('Method not allowed', { status: 405 })
      }
      return calendarFeed(request, env, match[1])
    }

    // Defensive: if routing ever changes, fall back to the static assets
    // rather than returning nothing.
    return env.ASSETS.fetch(request)
  },
}
