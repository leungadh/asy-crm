/** RFC 5545 iCalendar generation.
 *
 *  Written by hand rather than pulled from npm: the output is ~60 lines, and a
 *  Pages Function should stay small. The fiddly parts of the spec that break
 *  real calendar clients are all handled below — CRLF endings, 75-octet line
 *  folding, and TEXT escaping.
 */

export interface IcsEvent {
  uid: string
  start: Date
  /** Omit for an all-day event. */
  durationMinutes?: number
  summary: string
  description?: string
  /** CONFIRMED for a booking, TENTATIVE for something not yet agreed. */
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED'
}

/** Escape per RFC 5545 §3.3.11. Backslash first, or it double-escapes. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Fold to 75 OCTETS, not characters. Chinese names are 3 bytes each in UTF-8,
 *  so counting characters would produce lines that break strict parsers. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line

  const out: string[] = []
  let current = ''
  let bytes = 0

  for (const char of line) {                       // iterates code points
    const size = encoder.encode(char).length
    // Continuation lines start with a space, which itself costs an octet.
    if (bytes + size > (out.length === 0 ? 75 : 74)) {
      out.push(current)
      current = ''
      bytes = 0
    }
    current += char
    bytes += size
  }
  if (current) out.push(current)

  return out[0] + out.slice(1).map((l) => '\r\n ' + l).join('')
}

function utc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function dateOnly(d: Date): string {
  return utc(d).slice(0, 8)
}

export interface IcsCalendarOptions {
  name: string
  description?: string
  /** Minutes a client should wait before refetching. */
  refreshMinutes?: number
}

export function buildIcs(events: IcsEvent[], options: IcsCalendarOptions): string {
  const stamp = utc(new Date())
  const refresh = options.refreshMinutes ?? 60

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ASY Beaute//CRM//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(options.name)}`,
    `NAME:${escapeText(options.name)}`,
    `REFRESH-INTERVAL;VALUE=DURATION:PT${refresh}M`,
    `X-PUBLISHED-TTL:PT${refresh}M`,
  ]

  if (options.description) {
    lines.push(`X-WR-CALDESC:${escapeText(options.description)}`)
  }

  for (const e of events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${e.uid}`)
    lines.push(`DTSTAMP:${stamp}`)

    if (e.durationMinutes && e.durationMinutes > 0) {
      const end = new Date(e.start.getTime() + e.durationMinutes * 60_000)
      lines.push(`DTSTART:${utc(e.start)}`)
      lines.push(`DTEND:${utc(end)}`)
    } else {
      // All-day: DTEND is exclusive, so it must be the following day.
      const next = new Date(e.start)
      next.setUTCDate(next.getUTCDate() + 1)
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(e.start)}`)
      lines.push(`DTEND;VALUE=DATE:${dateOnly(next)}`)
    }

    lines.push(`SUMMARY:${escapeText(e.summary)}`)
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`)
    lines.push(`STATUS:${e.status ?? 'CONFIRMED'}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  // CRLF is mandatory (§3.1). Lone LF is the single most common reason a feed
  // silently fails to parse.
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
