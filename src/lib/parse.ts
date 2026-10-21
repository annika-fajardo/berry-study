/* One parser for every capture door: "FNCE 445 quiz friday 20% ~3h" → correctable chips.
   Each chip remembers the exact span it consumed, so removing it returns those words to the title. */
import { COURSE_KEYS } from '../data/courses'
import { addDays, parse as parseDate, todayStr } from './dates'
import type { Kind } from '../store/types'

export type Field = 'course' | 'kind' | 'date' | 'weight' | 'effort'
export type Chip = { field: Field; label: string; value: string; start: number; end: number; guessed?: boolean }
export type Parsed = { title: string; chips: Chip[]; course?: string; kind: Kind; date?: string; weight?: string; effort?: number }

const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const KIND_WORDS: [RegExp, Kind][] = [
  [/\b(quiz|midterm|final|exam|test)\b/i, 'test'],
  [/\b(due|submit|hand in|handin|assignment|report|case|deck|essay|paper)\b/i, 'due'],
  [/\b(read|reading|chapter|ch\s?\d+|prep|lecture|watch)\b/i, 'class'],
]
/** Nicknames learned from course names, so "options" finds FNCE 445. */
function nicknames(names: Record<string, string>): [RegExp, string][] {
  const out: [RegExp, string][] = []
  for (const [code, name] of Object.entries(names)) {
    for (const w of name.split(/[^A-Za-z]+/)) {
      if (w.length < 5) continue
      out.push([new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 's?\\b', 'i'), code])
    }
  }
  return out
}

function resolveDow(name: string, today: string, next: boolean) {
  const want = DOW.indexOf(name.toLowerCase())
  if (want < 0) return null
  const cur = parseDate(today).getDay()
  let delta = (want - cur + 7) % 7
  if (delta === 0) delta = 7
  if (next && delta <= 7) delta += 7 * (delta <= 7 && want <= cur ? 0 : 0) + (delta < 7 ? 7 : 0)
  return addDays(today, delta)
}

export function parseCapture(text: string, opts: { today?: string; courseNames?: Record<string, string>; lastCourse?: string } = {}): Parsed {
  const today = opts.today || todayStr()
  const chips: Chip[] = []
  const take = (field: Field, label: string, value: string, start: number, end: number, guessed?: boolean) => {
    if (chips.some(c => c.field === field)) return
    chips.push({ field, label, value, start, end, guessed })
  }

  // course code
  const code = text.match(/\b(FNCE|MGST|SGMA|ACCT|ECON|MKTG|OBHR|BSEN|STAT|MATH)\s?(\d{3})\b/i)
  if (code) {
    const key = (code[1].toUpperCase() + ' ' + code[2])
    const match = COURSE_KEYS.find(k => k.replace(' ', '') === key.replace(' ', '')) || key
    take('course', match, match, code.index!, code.index! + code[0].length)
  } else if (opts.courseNames) {
    for (const [re, c] of nicknames(opts.courseNames)) {
      const m = text.match(re)
      if (m) { take('course', c, c, m.index!, m.index! + m[0].length); break }
    }
  }

  // kind
  let kind: Kind = 'due'
  for (const [re, k] of KIND_WORDS) {
    const m = text.match(re)
    if (m) { kind = k; take('kind', k === 'test' ? 'Test' : k === 'due' ? 'Deadline' : 'Reading', k, -1, -1); break }
  }

  // date
  const dateRes: [RegExp, (m: RegExpMatchArray) => string | null][] = [
    [/\btoday\b/i, () => today],
    [/\btomorrow\b/i, () => addDays(today, 1)],
    [/\bnext (sun|mon|tues|wednes|thurs|fri|satur)day\b/i, m => { const d = resolveDow(m[1].toLowerCase() + 'day', today, false); return d ? addDays(d, 7) : null }],
    [/\bin (\d{1,2}) (day|week)s?\b/i, m => addDays(today, Number(m[1]) * (m[2].toLowerCase() === 'week' ? 7 : 1))],
    [/\b(sun|mon|tues|wednes|thurs|fri|satur)day\b/i, m => resolveDow(m[1].toLowerCase() + 'day', today, false)],
    [/\b(\d{1,2})\s?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i, m => mk(Number(m[1]), MON.indexOf(m[2].toLowerCase()), today)],
    [/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s?(\d{1,2})\b/i, m => mk(Number(m[2]), MON.indexOf(m[1].toLowerCase()), today)],
  ]
  for (const [re, fn] of dateRes) {
    const m = text.match(re)
    if (!m) continue
    const d = fn(m)
    if (!d) continue
    take('date', fmtChip(d), d, m.index!, m.index! + m[0].length)
    break
  }

  // weight
  const w = text.match(/\b(\d{1,3}(?:\.\d+)?)\s?%/)
  if (w) take('weight', w[1] + '%', w[1] + '%', w.index!, w.index! + w[0].length)

  // effort
  const e = text.match(/~?\b(\d{1,2}(?:\.\d+)?)\s?(h|hr|hrs|hours?)\b/i) || text.match(/~\s?(\d{1,3})\s?(m|min|mins)\b/i)
  if (e) {
    const n = Number(e[1])
    const hours = /^m/i.test(e[2]) ? n / 60 : n
    take('effort', /^m/i.test(e[2]) ? n + 'm' : n + 'h', String(hours), e.index!, e.index! + e[0].length)
  }

  const title = strip(text, chips)
  const courseChip = chips.find(c => c.field === 'course')
  if (!courseChip && opts.lastCourse) chips.push({ field: 'course', label: opts.lastCourse, value: opts.lastCourse, start: -1, end: -1, guessed: true })
  const get = (f: Field) => chips.find(c => c.field === f)?.value
  return {
    title, chips: chips.sort((a, b) => a.start - b.start),
    course: get('course'), kind: (get('kind') as Kind) || kind, date: get('date'), weight: get('weight'),
    effort: get('effort') ? Number(get('effort')) : undefined,
  }
}
function mk(day: number, mon: number, today: string) {
  if (mon < 0 || !day) return null
  const y = parseDate(today).getFullYear()
  const mkDate = (yy: number) => yy + '-' + String(mon + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0')
  return mkDate(mkDate(y) < today ? y + 1 : y)
}
export function fmtChip(d: string) {
  return parseDate(d).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })
}
/** Everything the chips didn't consume becomes the title. */
export function strip(text: string, chips: Chip[]) {
  const spans = chips.filter(c => c.start >= 0).sort((a, b) => b.start - a.start)
  let out = text
  for (const c of spans) out = out.slice(0, c.start) + ' ' + out.slice(c.end)
  return out.replace(/\s+/g, ' ').trim()
}
