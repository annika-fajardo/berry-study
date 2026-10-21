/* Readiness per upcoming test, 0–100.
   readiness = 75% topic knowledge + 25% scheduled study done.
   Knowledge = mean accuracy over the topics the test covers; never-practised topics count as 0, and accuracy
   older than 14 days decays (halves every further 14 days). */
import type { AppState, Item, Mastery, Practice } from '../store/types'
import { QTYPES } from '../data/drills'
import { COURSE_CONTENT } from '../data/content'
import { conceptsFor, slug } from './concepts'
import { daysBetween } from './dates'
import { effortHours } from './scheduler'
import { courseSlug } from './router'

export type Topic = { id: string; name: string; acc: number; seen: number; last?: string; href: string }
export type Readiness = { pct: number; knowledge: number; studied: number; topics: Topic[]; weak: Topic[] }

export function decayed(acc: number, last: string | undefined, today: string) {
  if (!last) return acc
  const age = daysBetween(last, today)
  return age <= 14 ? acc : acc * Math.pow(0.5, (age - 14) / 14)
}
type Rec = { seen: number; correct: number; last?: string }
const merge = (a?: Rec, b?: Rec): Rec | undefined => {
  if (!a && !b) return undefined
  const last = [a?.last, b?.last].filter(Boolean).sort().pop()
  return { seen: (a?.seen || 0) + (b?.seen || 0), correct: (a?.correct || 0) + (b?.correct || 0), last }
}
const fromPractice = (p?: Practice): Rec | undefined => (p ? { seen: p.tries, correct: p.correct, last: p.last } : undefined)
const fromMastery = (m?: Mastery): Rec | undefined => (m ? { seen: m.seen, correct: m.correct, last: m.last } : undefined)

/** The topics a test in course `c` covers, with where to practise each. */
export function topicsFor(s: Pick<AppState, 'mastery' | 'practice' | 'deckmeta'>, c: string): { id: string; name: string; rec?: Rec; href: string }[] {
  const base = '#/courses/' + courseSlug(c)
  if (c === 'FNCE 445') {
    const drills = COURSE_CONTENT['FNCE 445'].drills || []
    return Object.entries(QTYPES).filter(([, t]) => t.ch >= 3 && t.ch <= 5).map(([k, t]) => {
      const dk = drills.includes(k) ? k : k === 'fvalL' || k === 'fvalS' ? 'fval' : k === 'synth' || k === 'collar' ? '' : ''
      return { id: 'fnce-445--qt-' + k, name: t.label, rec: merge(fromMastery(s.mastery['fnce-445--qt-' + k]), dk ? fromPractice(s.practice['drill-' + dk]) : undefined), href: dk ? `${base}/drills/${dk}` : `${base}/adaptive` }
    })
  }
  const out = conceptsFor(c).map(k => ({ id: k.id, name: k.name, rec: fromMastery(s.mastery[k.id]), href: `${base}/flash` }))
  if (c === 'FNCE 477') {
    const meta = Object.values(s.deckmeta).find(m => m.c === c)
    for (const t of meta?.topics || []) { const id = slug(c) + '--deck-' + t.id; out.push({ id, name: t.name, rec: fromMastery(s.mastery[id]), href: `${base}/decks` }) }
  }
  return out
}

export function readiness(s: AppState, item: Item, today: string, nowMs = Date.now()): Readiness {
  const ts = topicsFor(s, item.c)
  const topics: Topic[] = ts.map(t => {
    const r = t.rec, raw = r && r.seen ? r.correct / r.seen : 0
    return { id: t.id, name: t.name, acc: r && r.seen ? decayed(raw, r.last, today) : 0, seen: r?.seen || 0, last: r?.last, href: t.href }
  })
  const knowledge = topics.length ? topics.reduce((a, t) => a + t.acc, 0) / topics.length : 0
  const effort = effortHours(item) * 60
  let done = 0
  for (const e of Object.values(s.events)) if (e.itemId === item.id && e.kind === 'study' && new Date(e.end).getTime() <= nowMs) done += (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000
  const studied = effort ? Math.min(1, done / effort) : 0
  const pct = Math.round(100 * (0.75 * knowledge + 0.25 * studied))
  const weak = [...topics].sort((a, b) => a.acc - b.acc || a.seen - b.seen).slice(0, 3)
  return { pct, knowledge, studied, topics, weak }
}
export const readinessTone = (p: number) => (p < 50 ? 'low' : p >= 75 ? 'high' : 'mid')
