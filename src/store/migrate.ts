/* Schema migrations, keyed by the version they produce.
   v1 = the raw Course Desk export (collections only, as in seed.json).
   v2 = Berry Study: XP ledger, sessions (garden), written answers, settings, timer. */
import type { AppState, Item, Session } from './types'
import { COLLECTION_KEYS } from './types'
import { itemXp, makeXp, plantFor, XP } from '../lib/game'
import { todayStr } from '../lib/dates'

export const CURRENT_SCHEMA = 4
type Loose = Record<string, any>

export const DEFAULT_SETTINGS = { theme: 'light' as const, catName: 'Emi', onboarded: false, planOpen: true, ch5only: false, catAnim: 'auto' as const, companion: 'emi' }
const W: [number, number][] = Array.from({ length: 7 }, () => [9 * 60, 22 * 60] as [number, number])
export const DEFAULT_PREFS = { window: W, maxHours: 4, blockMin: 50, breakMin: 10, gapMin: 15, noStudy: [] as number[], shiftRestMin: 60, longShiftH: 5, heavyDayH: 8, lightMin: 30 }
export const DEFAULT_CAL = { clientId: '', connected: false, calendars: [], writeCal: 'primary', addToGoogle: true }

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
  3: (s) => {
    const out: Loose = { ...s, schema: 3 }
    out.events = out.events || {}; out.skips = out.skips || {}; out.ics = out.ics || {}
    out.gcache = out.gcache || { events: [] }
    out.classes = out.classes || {}; out.workMarks = out.workMarks || {}; out.whatIf = out.whatIf || {}; out.d2lIgnore = out.d2lIgnore || {}
    out.cal = { ...DEFAULT_CAL, ...(out.cal || {}) }
    out.prefs = { ...DEFAULT_PREFS, ...(out.prefs || {}) }
    // v3 makes light the default look; an untouched "auto" becomes light (Auto stays available in Settings)
    if (out.settings && out.settings.theme === 'auto') out.settings.theme = 'light'
    // the cat has a name now: Emi (only replaces the old default)
    if (out.settings && (!out.settings.catName || out.settings.catName === 'Tux')) out.settings.catName = 'Emi'
    return out
  },
  4: (s) => {
    const out: Loose = { ...s, schema: 4 }
    // FNCE 445's scheme was flattened by hand into per-row weights; attach the rows to real categories.
    const CAT: [RegExp, string][] = [[/^assignment/i, 'assign'], [/^quiz/i, 'quiz'], [/^midterm/i, 'mid'], [/^participation/i, 'part'], [/^final/i, 'final']]
    for (const g of Object.values(out.grades as Record<string, Loose>)) {
      if (g.c !== 'FNCE 445' || g.cat) continue
      const hit = CAT.find(([re]) => re.test(String(g.name || '')))
      if (hit) g.cat = hit[1]
    }
    out.rounding = out.rounding || {}
    out.settings = { ...(out.settings || {}), notThis: [] }
    return out
  },
}

export function migrate(raw: Loose): AppState {
  let s: Loose = { ...raw }
  let v = typeof s.schema === 'number' ? s.schema : 1
  if (v > CURRENT_SCHEMA) throw new Error('This backup comes from a newer version of Berry Study.')
  while (v < CURRENT_SCHEMA) { v++; s = MIGRATIONS[v](s) }
  s.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) }
  s.prefs = { ...DEFAULT_PREFS, ...(s.prefs || {}) }
  s.cal = { ...DEFAULT_CAL, ...(s.cal || {}) }
  return s as AppState
}
