// Validates the .ics output against the parts of RFC 5545 that actually break
// calendar clients. Run: npm run test:ics
import { buildIcs, foldLine } from '../functions/_lib/ics.ts'

let failures = 0
const check = (label, actual, expected) => {
  const ok = String(actual) === String(expected)
  console.log(`${ok ? '✅' : '❌'} ${label}${ok ? '' : ` → got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`)
  if (!ok) failures++
}
const assert = (label, cond) => {
  console.log(`${cond ? '✅' : '❌'} ${label}`)
  if (!cond) failures++
}

console.log('════ ICS OUTPUT ════')

const ics = buildIcs([
  {
    uid: 'treatment-abc@asy-crm',
    start: new Date('2026-08-20T06:30:00.000Z'),   // 14:30 Hong Kong
    durationMinutes: 120,
    summary: 'Carrie Chan · Areola',
    description: '☎ 9123 4567',
    status: 'CONFIRMED',
  },
  {
    uid: 'followup-def@asy-crm',
    start: new Date('2026-08-21T03:00:00.000Z'),
    summary: 'Mandy Lee · 1星期跟進',
  },
  {
    uid: 'escape-test@asy-crm',
    start: new Date('2026-08-22T03:00:00.000Z'),
    durationMinutes: 60,
    summary: 'Semi;colon, comma \\ backslash',
    description: 'line one\nline two',
  },
], { name: 'ASY Beaute', description: 'Bookings and reviews', refreshMinutes: 60 })

// ── Structure ─────────────────────────────────────────────────────────────
assert('Wrapped in VCALENDAR', ics.startsWith('BEGIN:VCALENDAR') && ics.trimEnd().endsWith('END:VCALENDAR'))
check('Three VEVENTs emitted', (ics.match(/BEGIN:VEVENT/g) || []).length, 3)
assert('Declares VERSION:2.0', ics.includes('VERSION:2.0'))
assert('Declares a PRODID', /PRODID:.+/.test(ics))

// ── Line endings: the most common silent failure ─────────────────────────
const lfOnly = ics.split('\n').filter((l, i, arr) => i < arr.length - 1 && !l.endsWith('\r'))
check('Every line ends CRLF, none bare LF', lfOnly.length, 0)

// ── Timed vs all-day ─────────────────────────────────────────────────────
assert('Timed event uses UTC DTSTART', ics.includes('DTSTART:20260820T063000Z'))
assert('DTEND is start plus duration', ics.includes('DTEND:20260820T083000Z'))
assert('Untimed event becomes all-day', ics.includes('DTSTART;VALUE=DATE:20260821'))
assert('All-day DTEND is the next day (exclusive)', ics.includes('DTEND;VALUE=DATE:20260822'))

// ── Escaping ─────────────────────────────────────────────────────────────
assert('Semicolon escaped', ics.includes('Semi\\;colon'))
assert('Comma escaped', ics.includes('\\, comma'))
assert('Backslash escaped', ics.includes('\\\\ backslash'))
assert('Newline escaped as \\n', ics.includes('line one\\nline two'))

// ── Folding at 75 OCTETS, not characters ─────────────────────────────────
const longAscii = 'SUMMARY:' + 'a'.repeat(200)
const foldedAscii = foldLine(longAscii)
assert('Long ASCII line is folded', foldedAscii.includes('\r\n '))
const asciiSegments = foldedAscii.split('\r\n ')
assert('No folded ASCII segment exceeds 75 octets',
  asciiSegments.every((seg, i) => new TextEncoder().encode(i === 0 ? seg : ' ' + seg).length <= 75))

const longChinese = 'SUMMARY:' + '客'.repeat(60)   // 3 bytes each = 180 octets
const foldedChinese = foldLine(longChinese)
const chineseSegments = foldedChinese.split('\r\n ')
assert('Chinese line is folded', chineseSegments.length > 1)
assert('No folded Chinese segment exceeds 75 octets',
  chineseSegments.every((seg, i) => new TextEncoder().encode(i === 0 ? seg : ' ' + seg).length <= 75))
assert('Folding never splits a multi-byte character',
  chineseSegments.join('').includes('客客客'))

// ── Refresh hints ────────────────────────────────────────────────────────
assert('Publishes a refresh interval', ics.includes('REFRESH-INTERVAL;VALUE=DURATION:PT60M'))
assert('Publishes X-PUBLISHED-TTL for older clients', ics.includes('X-PUBLISHED-TTL:PT60M'))

// ── Stability ────────────────────────────────────────────────────────────
const again = buildIcs([{ uid: 'treatment-abc@asy-crm', start: new Date('2026-08-20T06:30:00.000Z'),
                          durationMinutes: 120, summary: 'Carrie Chan · Areola' }],
                       { name: 'ASY Beaute' })
assert('UID is stable across regenerations, so clients update not duplicate',
  again.includes('UID:treatment-abc@asy-crm'))

console.log(failures ? `\n🔴 ${failures} FAILURE(S)` : '\n🟢 ALL ICS CHECKS PASSED')
process.exit(failures ? 1 : 0)
