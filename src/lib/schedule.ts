/* Schedule logic ported from course-desk.html: weightOf(), prioritize(), strip stats, agenda grouping. */
import type { Item } from '../store/types'
import { todayStr, daysBetween, parse, fmt, monday } from './dates'

export function weightOf(i: Item) { if (!i.w) return i.k === 'class' ? 0 : 3; if (/^of/.test(i.w)) return 5; const n = parseFloat(i.w); return isFinite(n) ? n : 3 }

export type Priority = { i: Item; score: number; flags: [string, string][]; urg: string; days: number }
export function prioritize(items: Item[], t = todayStr()): Priority[] {
  const out: Priority[] = []
  for (const i of items) {
    if (i.done || !i.d) continue
    const days = daysBetween(t, i.d), wt = weightOf(i)
    if (i.k === 'class') { if (days < 0 || days > 2) continue }
    else if (days > 14 && !(wt >= 20 && days <= 21)) continue
    const kf = i.k === 'test' ? 1.5 : i.k === 'due' ? 1.3 : 0.5
    let score = (wt * kf + 3) / Math.pow(Math.max(days, 0) + 1, 1.15)
    if (days < 0 && i.k !== 'class') score += 100
    const flags: [string, string][] = []; let urg = ''
    if (days < 0 && i.k !== 'class') { flags.push(['Overdue', 'red']); urg = 'u-red' }
    else if (days === 0) { flags.push([i.k === 'class' ? 'Class today' : 'Due today', 'red']); urg = 'u-red' }
    else if (days === 1) { flags.push([i.k === 'test' ? 'Test tomorrow' : i.k === 'class' ? 'Prep for tomorrow' : 'Due tomorrow', 'red']); urg = 'u-red' }
    else if (days <= 3) { flags.push(['In ' + days + ' days', 'amber']); urg = 'u-amber' }
    else flags.push([fmt(parse(i.d), { weekday: 'short', month: 'short', day: 'numeric' }), ''])
    if (wt >= 15 && i.k !== 'class') flags.push(['Big: ' + i.w, 'amber']); else if (i.w) flags.push([i.w, ''])
    if (wt >= 15 && days >= 4 && i.k !== 'class') flags.push(['Start now', 'red'])
    out.push({ i, score, flags, urg, days })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5)
}

export function stripStats(items: Item[], t = todayStr()) {
  const open = items.filter(i => !i.done && i.d)
  const wk = open.filter(i => i.k !== 'class' && daysBetween(t, i.d!) >= 0 && daysBetween(t, i.d!) <= 7)
  const next = open.filter(i => i.k === 'test' && daysBetween(t, i.d!) >= 0).sort((a, b) => a.d!.localeCompare(b.d!))[0]
  const late = open.filter(i => i.k !== 'class' && daysBetween(t, i.d!) < 0)
  return { wk, next, late }
}

export type Filter = { course: string; major: boolean; past: boolean; done: boolean }
export type WeekGroup = { key: string; label: string; mon: Date; items: Item[]; gradedOpen: number; termBreak: boolean }
export function agenda(items: Item[], filter: Filter, t = todayStr()) {
  let list = items.filter(i => (filter.course === 'all' || i.c === filter.course) && (!filter.major || i.k !== 'class') && (filter.done || !i.done))
  if (!filter.past) list = list.filter(i => !i.d || i.d >= t || (!i.done && i.k !== 'class'))
  const dated = list.filter(i => i.d).sort((x, y) => x.d!.localeCompare(y.d!) || (Number(x.k === 'class') - Number(y.k === 'class')))
  const tbd = list.filter(i => !i.d)
  const groups = new Map<string, Item[]>()
  for (const i of dated) { const k = monday(parse(i.d!)).toDateString(); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(i) }
  const thisMon = monday(parse(t)).getTime()
  const weeks: WeekGroup[] = []
  for (const [k, arr] of groups) {
    const mon = new Date(k), diff = Math.round((mon.getTime() - thisMon) / (7 * 864e5))
    weeks.push({
      key: k, mon, items: arr,
      label: diff === 0 ? 'This week' : diff === 1 ? 'Next week' : diff === -1 ? 'Last week' : 'Week of ' + fmt(mon, { month: 'short', day: 'numeric' }),
      gradedOpen: arr.filter(i => i.k !== 'class' && !i.done).length,
      termBreak: mon.getMonth() === 10 && mon.getDate() === 9,
    })
  }
  return { weeks, tbd }
}
