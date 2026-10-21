/* Grade engine. letterFor(), courseStats(), needLine() and the projected GPA come from course-desk.html;
   categories, drop-lowest-N, bonus marks, rounding policy, per-item need and the best/worst band are new.

   Weighting model: a course is either flat (every row carries its own weight, as the old app did) or has
   categories (FNCE 445: "assignments 5% each, quizzes 7.5%"), where rows are scored out of 100 and the
   category's weight is shared between its rows, after dropping the lowest N. */
import { COURSES, LET, PTS } from '../data/courses'
import type { Grade, GradeCategory, Rounding } from '../store/types'

/** Apply the course's rounding policy before comparing with a cutoff. */
export function applyRounding(pct: number, mode: Rounding = 'exact') {
  if (mode === 'whole') return Math.round(pct)
  if (mode === 'half') return Math.round(pct * 2) / 2
  return pct
}
export function letterFor(c: string, pct: number, rounding?: Rounding) {
  const cut = COURSES[c].cut
  const p = applyRounding(pct, rounding)
  for (let k = 0; k < cut.length; k++) if (p >= cut[k] - 1e-9) return k
  return -1
}
/** True when the rounding policy changes the letter, so both can be shown. */
export function roundingSplit(c: string, pct: number, mode: Rounding = 'exact') {
  if (mode === 'exact') return null
  const exact = letterFor(c, pct, 'exact'), rounded = letterFor(c, pct, mode)
  return exact === rounded ? null : { exact, rounded }
}

export type Row = Omit<Grade, 'cat'> & { weight: number; dropped?: boolean; cat?: GradeCategory }
export type Stats = {
  rows: Row[]; earned: number; gw: number; pct: number | null; li: number | null; rem: number
  bonus: number; cats: GradeCategory[]
}

/** Effective weight per row, after categories and drop-lowest-N. */
export function weighRows(grades: Grade[], c: string): Row[] {
  const all = grades.filter(g => g.c === c).sort((a, b) => (a.o || 0) - (b.o || 0))
  const cats = COURSES[c].categories
  if (!cats || !cats.length) return all.map(({ cat: _c, ...g }) => ({ ...g, weight: g.wt }))
  const out: Row[] = []
  for (const { cat: catId, ...g } of all) {
    const cat = cats.find(x => x.id === catId)
    if (!cat) { out.push({ ...g, weight: g.wt }); continue }
    out.push({ ...g, weight: 0, cat })
  }
  for (const cat of cats) {
    const mine = out.filter(r => r.cat?.id === cat.id)
    if (!mine.length) continue
    // Drop the lowest N marked rows, but only once every row in the category has a mark to compare.
    const marked = mine.filter(r => typeof r.score === 'number')
    const dropN = Math.min(cat.drop || 0, Math.max(0, marked.length - 1))
    if (dropN > 0) {
      const worst = [...marked].sort((a, b) => (a.score as number) - (b.score as number)).slice(0, dropN)
      for (const w of worst) { const r = out.find(x => x.id === w.id); if (r) r.dropped = true }
    }
    const counted = mine.filter(r => !r.dropped)
    const each = counted.length ? cat.weight / counted.length : 0
    for (const r of counted) r.weight = each
  }
  return out
}

export function courseStats(grades: Grade[], c: string): Stats {
  const rows = weighRows(grades, c)
  let earned = 0, gw = 0, bonus = 0
  for (const g of rows) {
    if (g.dropped || typeof g.score !== 'number') continue
    earned += g.score * g.weight / 100
    gw += g.weight
    if (g.score > 100) bonus += (g.score - 100) * g.weight / 100
  }
  const pct = gw ? earned / gw * 100 : null
  const li = pct == null ? null : letterFor(c, pct)
  // Remaining weight comes from rows still unanswered, so a course whose weights don't total 100 still works.
  const rem = rows.filter(g => !g.dropped && typeof g.score !== 'number').reduce((a, g) => a + g.weight, 0)
  return { rows, earned, gw, pct, li, rem, bonus, cats: COURSES[c].categories || [] }
}

export type Need = { letter: string; target: number; cls: 'ok' | 'bad' | ''; text: string }
export function needLine(c: string, s: Stats, k: number): Need | null {
  const target = COURSES[c].cut[k]
  if (s.rem <= 0.001) return null
  const need = (target - s.earned) / s.rem * 100
  return {
    letter: LET[k], target,
    cls: need <= 0 ? 'ok' : need > 100 ? 'bad' : '',
    text: need <= 0 ? 'already locked in' : need > 100 ? 'out of reach' : Math.ceil(need * 10) / 10 + '% avg on the remaining ' + Math.round(s.rem * 10) / 10 + '%',
  }
}
/** Raise to the next letter, then keep the current one. Pass the what-if stats to answer "if I get 80 here…". */
export function needLines(c: string, s: Stats): Need[] {
  const out: Need[] = []
  if (s.pct == null || s.rem <= 0) return out
  const keep = s.li! >= 0 ? s.li! : COURSES[c].cut.length - 1, up = Math.max(0, keep - 1)
  if (keep > 0) { const a = needLine(c, s, up); if (a) out.push(a) }
  const b = needLine(c, s, keep); if (b) out.push(b)
  return out
}

/** What this one item needs, given every other item's real or what-if mark. Null when it can't matter. */
export function itemNeed(grades: Grade[], c: string, id: string, whatIf: Record<string, number>, targetIdx?: number): { pct: number; cls: 'ok' | 'bad' | '' } | null {
  const merged = grades.map(g => (g.id !== id && g.c === c && typeof g.score !== 'number' && typeof whatIf[g.id] === 'number' ? { ...g, score: whatIf[g.id] } : g))
  const others = merged.filter(g => g.id !== id)
  const s = courseStats(others, c)
  const row = weighRows(grades, c).find(r => r.id === id)
  if (!row || !row.weight || row.dropped) return null
  const li = targetIdx ?? (() => { const cur = courseStats(merged, c); return cur.li != null && cur.li >= 0 ? cur.li : COURSES[c].cut.length - 1 })()
  const target = COURSES[c].cut[li]
  // target = (earnedElsewhere + x*w/100) / (gwElsewhere + w) * 100
  const need = (target * (s.gw + row.weight) / 100 - s.earned) / row.weight * 100
  return { pct: Math.ceil(need * 10) / 10, cls: need <= 0 ? 'ok' : need > 110 ? 'bad' : '' }
}

/** Best / likely / worst, by setting every unanswered row to 100 / her running average / 0. */
export type Band = { best: number; likely: number; worst: number; bestLi: number; likelyLi: number; worstLi: number }
export function band(grades: Grade[], c: string): Band | null {
  const s = courseStats(grades, c)
  if (s.pct == null) return null
  const fill = (v: number) => {
    const g2 = grades.map(g => (g.c === c && typeof g.score !== 'number' ? { ...g, score: v } : g))
    return courseStats(g2, c).pct ?? 0
  }
  const best = fill(100), worst = fill(0), likely = fill(s.pct)
  return { best, likely, worst, bestLi: letterFor(c, best), likelyLi: letterFor(c, likely), worstLi: letterFor(c, worst) }
}

/** Term GPA, weighted by course units. */
export function projectedGpa(grades: Grade[]) {
  let pts = 0, units = 0, n = 0
  for (const c in COURSES) {
    const s = courseStats(grades, c)
    if (s.pct == null) continue
    const u = COURSES[c].units ?? 3
    pts += (s.li! >= 0 ? PTS[s.li!] : 0) * u
    units += u; n++
  }
  return { gpa: units ? pts / units : null, n }
}
export const letterText = (li: number | null) => (li == null ? '–' : li >= 0 ? LET[li] : 'F')
export const pointsText = (li: number | null) => (li == null ? '–' : li >= 0 ? PTS[li].toFixed(1) : '0.0')
