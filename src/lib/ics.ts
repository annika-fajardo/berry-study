/* Small iCalendar (.ics) reader and writer.
   Reads VEVENTs: UID, SUMMARY, DESCRIPTION, DTSTART/DTEND/DURATION (UTC, floating, TZID or all-day),
   TRANSP, STATUS, EXDATE and weekly/daily RRULEs (INTERVAL, COUNT, UNTIL, BYDAY). Writes study blocks as UTC events. */
import type { ExtEvent } from '../store/types'
import { toLocal, fromLocal, pad } from './time'

function unfold(text: string) { return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n') }
const unescape = (v: string) => v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
const escape = (v: string) => v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')

/** Wall-clock time in an IANA zone → Date (exact instant), via Intl offset lookup. */
export function zonedToDate(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s)
  try {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const off = (t: number) => {
      const p: Record<string, string> = {}
      for (const x of f.formatToParts(new Date(t))) p[x.type] = x.value
      return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - t
    }
    let t = guess - off(guess); t = guess - off(t)
    return new Date(t)
  } catch { return new Date(y, mo - 1, d, h, mi, s) }
}
type DT = { date: Date; allDay: boolean }
function parseDT(value: string, params: Record<string, string>): DT | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/)
  if (!m) return null
  const [, y, mo, d, h, mi, s, z] = m
  if (!h || params.VALUE === 'DATE') return { date: new Date(+y, +mo - 1, +d), allDay: true }
  if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0))), allDay: false }
  if (params.TZID) return { date: zonedToDate(+y, +mo, +d, +h, +mi, +(s || 0), params.TZID.replace(/^"|"$/g, '')), allDay: false }
  return { date: new Date(+y, +mo - 1, +d, +h, +mi, +(s || 0)), allDay: false }
}
function parseDuration(v: string) {
  const m = v.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/); if (!m) return 0
  return ((+(m[2] || 0) * 7 + +(m[3] || 0)) * 86400 + +(m[4] || 0) * 3600 + +(m[5] || 0) * 60 + +(m[6] || 0)) * 1000
}
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const localDay = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())

export type ParseOpts = { cal: string; from?: Date; to?: Date }
export function parseIcs(text: string, opts: ParseOpts): ExtEvent[] {
  const from = opts.from ?? new Date(Date.now() - 60 * 864e5), to = opts.to ?? new Date(Date.now() + 200 * 864e5)
  const lines = unfold(text)
  const out: ExtEvent[] = []
  let cur: Record<string, { v: string; p: Record<string, string> }[]> | null = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue }
    if (line === 'END:VEVENT') { if (cur) out.push(...expand(cur, opts.cal, from, to)); cur = null; continue }
    if (!cur) continue
    const i = line.indexOf(':'); if (i < 0) continue
    const [name, ...ps] = line.slice(0, i).split(';')
    const p: Record<string, string> = {}
    for (const x of ps) { const [k, v] = x.split('='); if (k) p[k.toUpperCase()] = v || '' }
    ;(cur[name.toUpperCase()] ||= []).push({ v: line.slice(i + 1), p })
  }
  return out
}
function expand(ev: Record<string, { v: string; p: Record<string, string> }[]>, cal: string, from: Date, to: Date): ExtEvent[] {
  const g = (k: string) => ev[k]?.[0]
  if (g('STATUS')?.v.toUpperCase() === 'CANCELLED') return []
  const ds = g('DTSTART'); if (!ds) return []
  const start = parseDT(ds.v, ds.p); if (!start) return []
  let dur: number
  const de = g('DTEND')
  if (de) { const e = parseDT(de.v, de.p); dur = e ? e.date.getTime() - start.date.getTime() : 0 }
  else if (g('DURATION')) dur = parseDuration(g('DURATION')!.v)
  else dur = start.allDay ? 864e5 : 0
  const uid = g('UID')?.v || Math.random().toString(36).slice(2)
  const title = unescape(g('SUMMARY')?.v || '(no title)')
  const desc = g('DESCRIPTION') ? unescape(g('DESCRIPTION')!.v) : undefined
  const busy = (g('TRANSP')?.v.toUpperCase() || 'OPAQUE') !== 'TRANSPARENT'
  const ex = new Set<number>()
  for (const x of ev.EXDATE || []) for (const v of x.v.split(',')) { const d = parseDT(v, x.p); if (d) ex.add(d.date.getTime()) }
  const starts: Date[] = []
  const rr = g('RRULE')?.v
  if (!rr) starts.push(start.date)
  else {
    const r: Record<string, string> = {}
    for (const part of rr.split(';')) { const [k, v] = part.split('='); r[k.toUpperCase()] = v }
    const interval = Math.max(1, +(r.INTERVAL || 1)), count = r.COUNT ? +r.COUNT : Infinity
    const until = r.UNTIL ? parseDT(r.UNTIL, {})?.date ?? null : null
    const freq = r.FREQ
    let n = 0
    if (freq === 'WEEKLY') {
      const byday = (r.BYDAY ? r.BYDAY.split(',').map(x => DAYS.indexOf(x.slice(-2))) : [start.date.getDay()]).filter(x => x >= 0).sort()
      const wk0 = new Date(start.date); wk0.setDate(wk0.getDate() - wk0.getDay())
      for (let w = 0; w < 600 && n < count; w += interval) {
        for (const dd of byday) {
          const t = new Date(wk0); t.setDate(wk0.getDate() + w * 7 + dd)
          t.setHours(start.date.getHours(), start.date.getMinutes(), start.date.getSeconds(), 0)
          if (t < start.date) continue
          if (until && t > until) { w = 1e9; break }
          if (n >= count) break
          n++; starts.push(t)
        }
        if (until == null && count === Infinity && starts.length && starts[starts.length - 1] > to) break
      }
    } else if (freq === 'DAILY') {
      for (let k = 0; k < 2000 && n < count; k += interval) {
        const t = new Date(start.date); t.setDate(t.getDate() + k)
        if (until && t > until) break
        if (t > to) break
        n++; starts.push(t)
      }
    } else starts.push(start.date)
  }
  return starts.filter(s => !ex.has(s.getTime()) && s.getTime() + dur >= from.getTime() && s <= to).map((s, k) => {
    const e = new Date(s.getTime() + dur)
    return {
      id: 'ics:' + cal + ':' + uid + (starts.length > 1 ? ':' + k : ''), cal, source: 'ics' as const, title, desc, busy,
      allDay: start.allDay,
      start: start.allDay ? localDay(s) : toLocal(s),
      end: start.allDay ? localDay(new Date(e.getTime() - 1)) : toLocal(e),
    }
  })
}

const stamp = (d: Date) => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'
function fold(line: string) { const out: string[] = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74) } out.push(s); return out.join('\r\n') }
export function toIcs(events: { uid: string; title: string; start: string; end: string; desc?: string }[], name = 'Berry Study') {
  const now = stamp(new Date())
  const body = events.map(e => [
    'BEGIN:VEVENT', 'UID:' + e.uid + '@berry-study', 'DTSTAMP:' + now,
    'DTSTART:' + stamp(fromLocal(e.start)), 'DTEND:' + stamp(fromLocal(e.end)),
    'SUMMARY:' + escape(e.title), ...(e.desc ? ['DESCRIPTION:' + escape(e.desc)] : []), 'END:VEVENT',
  ].map(fold).join('\r\n')).join('\r\n')
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Berry Study//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:' + escape(name), body, 'END:VCALENDAR'].filter(Boolean).join('\r\n') + '\r\n'
}
