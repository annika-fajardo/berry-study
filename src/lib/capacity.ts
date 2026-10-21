/* Capacity: the sentence the scheduler could always have told her.
   "4h10 of work before Friday · 3h05 free · two blocks won't fit." */
import type { AppState } from '../store/types'
import type { CalData } from './calendar'
import { effortHours } from './scheduler'
import { addDays, daysBetween, fmt, parse, todayStr } from './dates'
import { ms, minOfDay } from './time'

export type Capacity = {
  /** Minutes of work still to do before the horizon. */
  needed: number
  /** Minutes of free study time before it. */
  free: number
  /** Blocks the scheduler could not place. */
  unplaced: number
  /** The deadline the sentence is about. */
  by: string | null
  byLabel: string
  tight: boolean
  items: { id: string; title: string; c: string; needed: number; free: number }[]
}

const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
export const countWord = (n: number) => (n < WORD.length ? WORD[n] : String(n))

/** Free study minutes between now and the end of `until`, from the scheduler's own day windows. */
export function freeBefore(s: AppState, cal: CalData, until: string, today = todayStr(), now = new Date()): number {
  let free = 0
  const nowMin = now.getHours() * 60 + now.getMinutes()
  for (let d = today; d <= until; d = addDays(d, 1)) {
    const info = cal.sched.days[d]
    const wd = parse(d).getDay()
    const [ws, we] = s.prefs.window[wd] || [9 * 60, 22 * 60]
    if (s.prefs.noStudy.includes(wd)) continue
    let open = Math.max(0, we - Math.max(ws, d === today ? nowMin : 0))
    // take out what is already busy or booked that day
    for (const e of cal.ext) {
      if (e.allDay || !e.busy || e.d2l || e.berry || e.start.slice(0, 10) !== d) continue
      open -= Math.max(0, Math.min(we, minOfDay(e.end)) - Math.max(ws, minOfDay(e.start)))
    }
    for (const e of cal.own) {
      if (e.start.slice(0, 10) !== d) continue
      open -= Math.max(0, (ms(e.end) - ms(e.start)) / 60000)
    }
    const cap = info?.heavy ? s.prefs.lightMin : s.prefs.maxHours * 60
    free += Math.max(0, Math.min(open, cap))
  }
  return Math.round(free)
}

export function capacity(s: AppState, cal: CalData, today = todayStr(), now = new Date()): Capacity | null {
  // Look at everything due in the next week; the sentence is about the nearest real crunch.
  const horizon = addDays(today, 7)
  const openItems = cal.items.filter(i => !i.done && i.d && i.d >= today && i.d <= horizon)
  if (!openItems.length) return null
  // The sentence is about the nearest real crunch, not the end of the horizon: take the first graded
  // deadline (or the first item at all), and count everything due on or before it.
  const graded = openItems.filter(i => i.k !== 'class')
  const by = (graded.length ? graded : openItems).map(i => i.d!).sort()[0]
  const due = openItems.filter(i => i.d! <= by)
  const accepted: Record<string, number> = {}
  for (const e of cal.own) if (e.itemId) accepted[e.itemId] = (accepted[e.itemId] || 0) + (ms(e.end) - ms(e.start)) / 60000
  const needed = Math.round(due.reduce((a, i) => a + Math.max(0, effortHours(i) * 60 - (accepted[i.id] || 0)), 0))
  if (needed <= 0) return null
  const free = freeBefore(s, cal, by, today, now)
  const unplaced = cal.sched.unplaced.reduce((a, u) => a + u.blocks, 0)
  const items = cal.sched.unplaced.map(u => {
    const it = cal.items.find(i => i.id === u.itemId)
    return it ? { id: it.id, title: it.t, c: it.c, needed: Math.round(effortHours(it) * 60 - (accepted[it.id] || 0)), free: Math.max(0, freeBefore(s, cal, it.d!, today, now)) } : null
  }).filter(Boolean) as Capacity['items']
  const d = daysBetween(today, by)
  const byLabel = d === 0 ? 'today' : d === 1 ? 'tomorrow' : d <= 6 ? fmt(parse(by), { weekday: 'long' }) : fmt(parse(by), { month: 'short', day: 'numeric' })
  return { needed, free, unplaced, by, byLabel, tight: unplaced > 0 || needed > free, items }
}
