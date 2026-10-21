/* "Right Now": one action, chosen from what prioritize() says is urgent, what readiness() says is weak, and
   what schedule() says there is room for. [Not this] cycles and records the skip, so the ranking learns. */
import type { AppState, Item } from '../store/types'
import type { CalData } from './calendar'
import { prioritize } from './schedule'
import { readiness } from './readiness'
import { effortHours } from './scheduler'
import { daysBetween, hm } from './dates'
import { courseSlug } from './router'

export type RightNow = {
  key: string
  c: string
  /** The verb, e.g. "Black–Scholes drills" or "Read Ch 7". */
  action: string
  minutes: number
  /** One clause, no more. */
  reason: string
  href: string
  itemId?: string
  kind: 'practice' | 'work' | 'ahead' | 'resume'
}

const practiceHref = (c: string) => '#/study/' + courseSlug(c) + '/practice'

/** Every candidate, best first. The list is short by construction: at most one per open item plus a get-ahead. */
export function candidates(s: AppState, cal: CalData, today: string): RightNow[] {
  const out: RightNow[] = []
  const blockMin = s.prefs.blockMin || 50
  const open = cal.items.filter(i => !i.done && i.d)
  const top = prioritize(cal.items, today)

  for (const p of top) {
    const i = p.i
    const due = daysBetween(today, i.d!)
    if (i.k === 'test') {
      const r = readiness(s, i, today)
      const weak = r.weak.find(w => w.seen === 0) || r.weak[0]
      const mins = Math.min(blockMin, due <= 1 ? 30 : blockMin)
      out.push({
        key: 'test:' + i.id, c: i.c, itemId: i.id, kind: 'practice',
        action: weak ? weak.name + ' practice' : i.t + ' practice',
        minutes: mins,
        reason: `${i.t} ${due < 0 ? (due === -1 ? 'was yesterday' : 'was ' + -due + ' days ago') : due === 0 ? 'is today' : due === 1 ? 'is tomorrow' : 'is in ' + due + ' days'}. ${r.pct != null ? `You're ${r.pct}% ready` : 'Nothing practised yet'}${weak && weak.seen > 0 ? ` and ${Math.round(weak.acc * 100)}% on this topic` : weak ? ', and this topic is untouched' : ''}.`,
        href: weak?.href || practiceHref(i.c),
      })
    } else {
      const hours = effortHours(i)
      out.push({
        key: 'work:' + i.id, c: i.c, itemId: i.id, kind: 'work',
        action: i.k === 'class' ? (i.t.length > 42 ? i.t.slice(0, 40) + '…' : i.t) : 'Work on ' + (i.t.length > 32 ? i.t.slice(0, 30) + '…' : i.t),
        minutes: Math.min(blockMin, Math.round(hours * 60)),
        reason: due < 0 ? `${i.t} was due ${-due === 1 ? 'yesterday' : -due + ' days ago'}.` : `Due ${due === 0 ? 'today' : due === 1 ? 'tomorrow' : 'in ' + due + ' days'}${i.w ? `, worth ${i.w}` : ''}.`,
        href: '#/garden/' + courseSlug(i.c),
      })
    }
  }

  // Quiet day: get ahead on whichever course has the furthest-off test and the lowest readiness.
  if (!out.length) {
    const tests = open.filter(i => i.k === 'test' && i.d! >= today).sort((a, b) => a.d!.localeCompare(b.d!))
    const pick = tests.map(i => ({ i, r: readiness(s, i, today) })).sort((a, b) => (a.r.pct ?? 101) - (b.r.pct ?? 101))[0]
    const nextDays = tests[0] ? daysBetween(today, tests[0].d!) : null
    if (pick) {
      out.push({
        key: 'ahead:' + pick.i.id, c: pick.i.c, itemId: pick.i.id, kind: 'ahead',
        action: (pick.r.weak[0]?.name || pick.i.t) + ' practice', minutes: 25,
        reason: `Nothing due for ${nextDays ?? 6} days. Want to get ahead on ${pick.i.c}?`,
        href: pick.r.weak[0]?.href || practiceHref(pick.i.c),
      })
    }
  }
  return out
}

/** The current pick, honouring today's [Not this] presses. */
export function rightNow(s: AppState, cal: CalData, today: string): { pick: RightNow | null; count: number } {
  const list = candidates(s, cal, today)
  if (!list.length) return { pick: null, count: 0 }
  // Skips are only today's: a day that has rolled over starts clean.
  const stale = !!s.settings.notThisDay && s.settings.notThisDay !== today
  const skipped = new Set(stale ? [] : s.settings.notThis || [])
  const pick = list.find(x => !skipped.has(x.key)) || list[0]
  return { pick, count: list.length }
}
export const durationLabel = (m: number) => hm(m)
export type { Item }
