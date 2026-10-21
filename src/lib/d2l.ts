/* D2L / Brightspace course dates. D2L calendars (tagged in Settings) are shown as deadline chips, not busy time,
   and compared with her own items to list additions and date changes. Nothing is changed automatically. */
import type { AppState, ExtEvent, Item, Kind } from '../store/types'
import { COURSE_KEYS } from '../data/courses'
import { daysBetween } from './dates'

export const D2L_NAME_RE = /d2l|brightspace|ucalgary/i
export function isD2l(e: ExtEvent, s: Pick<AppState, 'cal' | 'ics'>) {
  if (e.source === 'google') return !!s.cal.calendars.find(c => c.id === e.cal)?.d2l
  return !!s.ics[e.cal]?.d2l
}
export function courseOf(text: string) {
  const t = text.toUpperCase().replace(/\s+/g, ' ')
  return COURSE_KEYS.find(k => t.includes(k) || t.includes(k.replace(' ', ''))) || null
}
export function kindOf(title: string): Kind {
  if (/quiz|exam|midterm|final|test/i.test(title)) return 'test'
  return 'due'
}
/** Strip D2L noise ("FNCE 445 - ", " - Due", "Availability Ends") to compare titles. */
export function cleanTitle(t: string) {
  return t.replace(/\b(FNCE|MGST|SGMA)\s?\d{3}\b[^-:–]*[-:–]?/gi, '').replace(/\b(is due|due|availability ends|ends|starts|opens|closes)\b/gi, '').replace(/[-–:·]+\s*$/g, '').replace(/\s+/g, ' ').trim()
}
const norm = (t: string) => cleanTitle(t).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
export function similar(a: string, b: string) {
  const x = norm(a), y = norm(b)
  if (!x || !y) return false
  if (x === y || x.includes(y) || y.includes(x)) return true
  const wa = new Set(x.split(' ')), wb = y.split(' ')
  const common = wb.filter(w => wa.has(w)).length
  return common / Math.max(wa.size, wb.length) >= 0.6
}
export type D2lItem = { key: string; ev: ExtEvent; c: string; k: Kind; t: string; d: string }
export type D2lUpdate = { kind: 'new'; it: D2lItem } | { kind: 'moved'; it: D2lItem; item: Item }
export function d2lItems(events: ExtEvent[], s: Pick<AppState, 'cal' | 'ics'>): D2lItem[] {
  const out: D2lItem[] = []
  for (const e of events) {
    if (!isD2l(e, s)) continue
    const c = courseOf(e.title + ' ' + (e.desc || '')); if (!c) continue
    const d = e.start.slice(0, 10)
    out.push({ key: c + '|' + norm(e.title) + '|' + d, ev: e, c, k: kindOf(e.title), t: cleanTitle(e.title) || e.title, d })
  }
  return out
}
export function d2lUpdates(events: ExtEvent[], s: Pick<AppState, 'cal' | 'ics' | 'd2lIgnore'>, items: Item[]): D2lUpdate[] {
  const out: D2lUpdate[] = []
  for (const it of d2lItems(events, s)) {
    if (s.d2lIgnore[it.key]) continue
    const same = items.filter(i => i.c === it.c && similar(i.t, it.t))
    if (same.some(i => i.d && Math.abs(daysBetween(i.d, it.d)) <= 2)) {
      const m = same.find(i => i.d && i.d !== it.d && Math.abs(daysBetween(i.d, it.d)) <= 2)
      if (m && Math.abs(daysBetween(m.d!, it.d)) >= 1) out.push({ kind: 'moved', it, item: m })
      continue
    }
    const moved = same.find(i => i.d && !i.done)
    if (moved) out.push({ kind: 'moved', it, item: moved })
    else out.push({ kind: 'new', it })
  }
  return out
}
