/* Deterministic study-block scheduler (no AI).
   Places suggested blocks into free time before each deadline: earliest deadline first, spread over days
   (at most 2 blocks per item per day), a review block the day before a test, weak topics in the description.
   Busy time = calendar events (padded by a gap), work shifts (plus rest time after), attended classes and
   accepted blocks. Shift days get light review only. Self-study classes become free time with a
   "Self-study" block offered for that week's topic. */
import type { Item, StudyPrefs, ClassMeet, Skip } from '../store/types'
import { todayStr, addDays, parse } from './dates'
import { atMin, fromLocal, toLocal, ms, pad } from './time'
import { weightOf } from './schedule'

export type Busy = { start: string; end: string; title?: string; work?: boolean }
export type Accepted = { id: string; start: string; end: string; itemId?: string; kind?: string }
export type SuggestionKind = 'study' | 'review' | 'light' | 'selfstudy' | 'preread'
export type Suggestion = { key: string; itemId?: string; c: string; title: string; topic?: string; note: string; start: string; end: string; kind: SuggestionKind; classId?: string }
export type DayInfo = { date: string; shiftMin: number; heavy: boolean; longShiftEnd?: string }
export type SchedInput = {
  now: Date; items: Item[]; prefs: StudyPrefs; busy: Busy[]; accepted: Accepted[]; skips: Skip[]
  classes?: Record<string, ClassMeet>
  /** weakest topic names per item (from readiness), used first in descriptions */
  weakByItem?: Record<string, string[]>
  /** lowest-mastery topic per course */
  weakByCourse?: Record<string, string>
  horizonDays?: number
}
export type SchedResult = { suggestions: Suggestion[]; unplaced: { itemId: string; blocks: number }[]; days: Record<string, DayInfo> }

/** Effort in hours. test 1.5h + 0.2h/weight-%; deadline 1h + 0.15h/weight-%; class prep 0.75h; ≤5% quizzes capped at 2h. */
export function effortHours(i: Pick<Item, 'k' | 'w' | 'effort'>) {
  if (typeof i.effort === 'number' && i.effort >= 0) return i.effort
  if (i.k === 'class') return 0.75
  const w = i.w && !/^of/.test(i.w) ? parseFloat(i.w) : weightOf(i as Item)
  const wt = isFinite(w) ? w : 3
  let h = i.k === 'test' ? 1.5 + 0.2 * wt : 1 + 0.15 * wt
  if (wt <= 5) h = Math.min(h, 2)
  return Math.round(h * 100) / 100
}

type Iv = [number, number] // minutes of day
function subtract(free: Iv[], b: Iv): Iv[] {
  const out: Iv[] = []
  for (const [a, z] of free) {
    if (b[1] <= a || b[0] >= z) { out.push([a, z]); continue }
    if (b[0] > a) out.push([a, b[0]])
    if (b[1] < z) out.push([b[1], z])
  }
  return out
}
type Day = {
  date: string; weekday: number; free: Iv[]; budget: number; heavy: boolean
  lightAfter: number | null; lightAfterUsed: boolean; perItem: Record<string, number>; info: DayInfo
}
const clipToDay = (date: string, s: string, e: string): Iv | null => {
  const d0 = fromLocal(date + 'T00:00').getTime(), d1 = d0 + 864e5
  const a = Math.max(ms(s), d0), b = Math.min(ms(e), d1)
  if (b <= a) return null
  return [Math.round((a - d0) / 60000), Math.round((b - d0) / 60000)]
}

export function schedule(inp: SchedInput): SchedResult {
  const { now, prefs } = inp
  const H = inp.horizonDays ?? 14
  const today = todayStr(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const startMin = Math.ceil((nowMin + 1) / 15) * 15
  const classes = inp.classes || {}
  const acceptedMin: Record<string, number> = {}
  for (const a of inp.accepted) if (a.itemId) acceptedMin[a.itemId] = (acceptedMin[a.itemId] || 0) + (ms(a.end) - ms(a.start)) / 60000

  /* ---- build days ---- */
  const days: Day[] = []
  for (let k = 0; k < H; k++) {
    const date = addDays(today, k), wd = parse(date).getDay()
    const [ws, we] = prefs.window[wd] || [9 * 60, 22 * 60]
    let free: Iv[] = prefs.noStudy.includes(wd) ? [] : [[Math.max(ws, k === 0 ? startMin : 0), we]]
    if (free.length && free[0][0] >= free[0][1]) free = []
    let shiftMin = 0, longEnd: number | null = null
    for (const b of inp.busy) {
      const iv = clipToDay(date, b.start, b.end); if (!iv) continue
      if (b.work) {
        shiftMin += iv[1] - iv[0]
        if ((ms(b.end) - ms(b.start)) / 3.6e6 >= prefs.longShiftH) longEnd = Math.max(longEnd ?? 0, iv[1] + prefs.shiftRestMin)
        free = subtract(free, [iv[0] - prefs.gapMin, iv[1] + prefs.shiftRestMin])
      } else free = subtract(free, [iv[0] - prefs.gapMin, iv[1] + prefs.gapMin])
    }
    for (const [, cm] of Object.entries(classes)) {
      if (cm.weekday !== wd || cm.selfStudy) continue
      free = subtract(free, [cm.start - prefs.gapMin, cm.end + prefs.gapMin])
    }
    let used = 0
    for (const a of inp.accepted) {
      const iv = clipToDay(date, a.start, a.end); if (!iv) continue
      used += iv[1] - iv[0]
      free = subtract(free, [iv[0] - prefs.breakMin, iv[1] + prefs.breakMin])
    }
    const heavy = shiftMin >= prefs.heavyDayH * 60
    const budget = heavy ? Math.max(0, prefs.lightMin - used) : Math.max(0, prefs.maxHours * 60 - used)
    const info: DayInfo = { date, shiftMin, heavy, longShiftEnd: longEnd != null ? atMin(date, Math.min(longEnd, 1439)) : undefined }
    days.push({ date, weekday: wd, free: free.filter(([a, b]) => b - a >= 15), budget, heavy, lightAfter: heavy ? null : longEnd, lightAfterUsed: false, perItem: {}, info })
  }

  /* ---- slot finding ---- */
  const skipSet = new Set(inp.skips.map(s => s.itemId + '@' + s.start))
  /** Earliest slot in a day of `len` minutes, starting at or after `from`, ending at or before `until`. Light-only zones shrink the block. */
  function find(day: Day, len: number, from = 0, until = 1440, itemId = ''): { a: number; b: number; light: boolean } | null {
    if (day.budget < 15) return null
    for (const [fa, fz] of day.free) {
      let a = Math.max(fa, from)
      a = Math.ceil(a / 15) * 15
      while (a + 15 <= Math.min(fz, until)) {
        const lightZone = day.heavy || (day.lightAfter != null && a >= day.lightAfter)
        if (lightZone && day.lightAfter != null && !day.heavy && day.lightAfterUsed) break
        const want = lightZone ? Math.min(len, prefs.lightMin) : len
        const L = Math.min(want, day.budget)
        if (L >= Math.min(want, 25) && a + L <= Math.min(fz, until) && !skipSet.has(itemId + '@' + atMin(day.date, a))) return { a, b: a + L, light: lightZone }
        a += 15
      }
    }
    return null
  }
  function take(day: Day, a: number, b: number, light: boolean, itemId?: string) {
    day.free = subtract(day.free, [a, b + prefs.breakMin]).filter(([x, y]) => y - x >= 15)
    day.budget -= b - a
    if (light && day.lightAfter != null && a >= day.lightAfter) day.lightAfterUsed = true
    if (itemId) day.perItem[itemId] = (day.perItem[itemId] || 0) + 1
  }

  const out: Suggestion[] = []
  const remaining: Record<string, number> = {}
  const open = inp.items.filter(i => !i.done && i.d && i.d >= today && i.d <= addDays(today, H + 7))
  for (const i of open) remaining[i.id] = Math.max(0, effortHours(i) * 60 - (acceptedMin[i.id] || 0))
  const topicFor = (i: Item, n: number) => { const w = inp.weakByItem?.[i.id]; if (w && w.length) return w[n % w.length]; return inp.weakByCourse?.[i.c] }

  /* ---- 1. classes: self-study replaces the lecture; attended classes get an optional pre-read ---- */
  for (const [cid, cm] of Object.entries(classes)) {
    for (const day of days) {
      if (day.weekday !== cm.weekday) continue
      const mon = addDays(day.date, -((day.weekday + 6) % 7)), sun = addDays(mon, 6)
      const prep = open.filter(i => i.c === cm.c && i.k === 'class' && i.d! >= mon && i.d! <= sun).sort((a, b) => a.d!.localeCompare(b.d!))[0]
      const topic = prep ? prep.t + (prep.n ? ' · ' + prep.n : '') : 'this week\'s material'
      if (cm.selfStudy) {
        const len = Math.min(cm.end - cm.start, prefs.blockMin)
        const sid = prep?.id ?? 'self:' + cid
        let slot = find(day, len, cm.start, cm.start + len, sid)
        let d2 = day
        if (!slot) { // next best: later that day, then the following days before the next class
          slot = find(day, len, cm.start, 1440, sid)
          for (let k = days.indexOf(day) + 1; !slot && k < days.length && k < days.indexOf(day) + 7; k++) { d2 = days[k]; slot = find(d2, len, 0, 1440, sid) }
        }
        if (!slot) continue
        take(d2, slot.a, slot.b, slot.light, prep?.id)
        if (prep) remaining[prep.id] = Math.max(0, remaining[prep.id] - (slot.b - slot.a))
        out.push({ key: `self:${cid}:${day.date}`, itemId: prep?.id, classId: cid, c: cm.c, kind: 'selfstudy', title: `${cm.c} self-study · ${topic}`, topic, note: 'instead of the lecture', start: atMin(d2.date, slot.a), end: atMin(d2.date, slot.b) })
      } else if (prep && prep.d === day.date) {
        const slot = find(day, 30, Math.max(0, cm.start - 180), cm.start - prefs.gapMin, prep.id)
        if (!slot) continue
        take(day, slot.a, slot.b, slot.light, prep.id)
        remaining[prep.id] = Math.max(0, remaining[prep.id] - (slot.b - slot.a))
        out.push({ key: `pre:${cid}:${day.date}`, itemId: prep.id, classId: cid, c: cm.c, kind: 'preread', title: `${cm.c} pre-read · ${topic}`, topic, note: 'before class', start: atMin(day.date, slot.a), end: atMin(day.date, slot.b) })
      }
    }
  }

  /* ---- 2. items, earliest deadline first ---- */
  const unplaced: { itemId: string; blocks: number }[] = []
  const order = open.filter(i => remaining[i.id] > 0).sort((a, b) => a.d!.localeCompare(b.d!) || weightOf(b) - weightOf(a))
  for (const i of order) {
    let need = Math.ceil(remaining[i.id] / prefs.blockMin)
    if (!need) continue
    const lastIdx = days.findIndex(d => d.date >= i.d!) // index of the deadline day (or -1 if beyond horizon)
    const endIdx = lastIdx === -1 ? days.length : lastIdx // blocks go on days before the deadline day
    const earliest = Math.max(0, endIdx - 14)
    const avail = days.slice(earliest, endIdx)
    if (i.k === 'class' && lastIdx !== -1) { // prep may also happen on the morning of class day
      avail.push(days[lastIdx])
    }
    let n = 0
    const place = (day: Day, kind: SuggestionKind) => {
      if ((day.perItem[i.id] || 0) >= 2) return false
      const until = i.k === 'class' && day.date === i.d ? 12 * 60 : 1440
      const slot = find(day, prefs.blockMin, 0, until, i.id); if (!slot) return false
      take(day, slot.a, slot.b, slot.light, i.id)
      const k: SuggestionKind = slot.light ? 'light' : kind
      const topic = k === 'light' ? 'flashcards and a short review' : topicFor(i, n)
      const title = k === 'review' ? `${i.c} · Review for ${i.t}` : k === 'light' ? `${i.c} · Light review` : `${i.c} · ${topic ? topic + (i.k === 'class' ? '' : ' practice') : i.t}`
      const note = title.includes(i.t) ? '' : (i.k === 'class' ? 'for ' : 'before ') + i.t
      out.push({ key: `${i.id}#${n}`, itemId: i.id, c: i.c, kind: k, title, topic, note, start: atMin(day.date, slot.a), end: atMin(day.date, slot.b) })
      n++; need--
      return true
    }
    if (i.k === 'test' && avail.length && need > 0) { place(avail[avail.length - 1], 'review') || place(avail[avail.length - 1], 'review') }
    for (let pass = 0; pass < 2 && need > 0; pass++) for (const day of avail) { if (need <= 0) break; if (!(i.k === 'test' && day === avail[avail.length - 1] && pass === 0)) place(day, 'study') }
    if (need > 0) unplaced.push({ itemId: i.id, blocks: need })
  }
  out.sort((a, b) => a.start.localeCompare(b.start))
  const dinfo: Record<string, DayInfo> = {}
  for (const d of days) dinfo[d.date] = d.info
  return { suggestions: out, unplaced, days: dinfo }
}
export { toLocal, pad }
