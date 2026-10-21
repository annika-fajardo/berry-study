/* Schema migrations, keyed by the version they produce.
   v1 = the raw Course Desk export (collections only, as in seed.json).
   v2 = Berry Study: XP ledger, sessions (garden), written answers, settings, timer. */
import type { AppState, Item, Session } from './types'
import { COLLECTION_KEYS } from './types'
import { itemXp, makeXp, plantFor, XP } from '../lib/game'
import { todayStr } from '../lib/dates'

export const CURRENT_SCHEMA = 2
type Loose = Record<string, any>

export const DEFAULT_SETTINGS = { theme: 'auto' as const, catName: 'Tux', onboarded: false, planOpen: true, ch5only: false }

const MIGRATIONS: Record<number, (s: Loose) => Loose> = {
  2: (s) => {
    const out: Loose = { ...s, schema: 2 }
    for (const k of COLLECTION_KEYS) out[k] = out[k] && typeof out[k] === 'object' ? out[k] : {}
    out.xp = {}; out.sessions = {}; out.written = out.written || {}
    out.settings = { ...DEFAULT_SETTINGS, ...(out.settings || {}) }
    out.timer = null
    out.meta = out.meta || { createdAt: new Date().toISOString(), seededFrom: 'course-desk' }
    // Turn existing Course Desk history into XP so the level card reflects work already done.
    const t = todayStr()
    for (const [id, i] of Object.entries(out.items as Record<string, Item>)) {
      if (i.done) { const e = makeXp(itemXp(i), 'Ticked off: ' + i.c + ' ' + i.t, { ref: 'item:' + id, c: i.c }, i.d || t); out.xp[e.id] = e }
    }
    for (const [id, p] of Object.entries(out.practice as Loose)) {
      if (p.correct > 0) { const e = makeXp(p.correct * XP.correct, 'Course Desk history: ' + p.label + ' (' + p.correct + ' correct)', { ref: 'hist-practice:' + id, c: p.c }, p.last || t); out.xp[e.id] = e }
    }
    for (const [id, m] of Object.entries(out.mastery as Loose)) {
      if (m.correct > 0) { const e = makeXp(m.correct * XP.correct, 'Course Desk history: ' + m.concept + ' (' + m.correct + ' correct)', { ref: 'hist-mastery:' + id, c: m.c }, m.last || t); out.xp[e.id] = e }
    }
    for (const [d, day] of Object.entries(out.study as Loose)) {
      for (const [c, mins] of Object.entries(day as Record<string, number>)) {
        const m = Math.round(Number(mins) || 0); if (m < 1) continue
        const sid = 'cd-' + d + '-' + c.replace(/\s+/g, '')
        const sess: Session = { id: sid, c, date: d, minutes: m, source: 'course-desk', status: 'grown', plant: plantFor(m), ts: d + 'T12:00:00.000Z' }
        out.sessions[sid] = sess
        const e = makeXp(m * XP.perMinute, 'Course Desk study timer: ' + c + ' ' + m + ' min', { ref: 'session:' + sid, c }, d); out.xp[e.id] = e
      }
    }
    return out
  },
}

export function migrate(raw: Loose): AppState {
  let s: Loose = { ...raw }
  let v = typeof s.schema === 'number' ? s.schema : 1
  if (v > CURRENT_SCHEMA) throw new Error('This backup comes from a newer version of Berry Study.')
  while (v < CURRENT_SCHEMA) { v++; s = MIGRATIONS[v](s) }
  s.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) }
  return s as AppState
}
