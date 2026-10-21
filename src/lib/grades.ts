/* Grades logic ported from course-desk.html: letterFor(), courseStats(), needLine(), projected GPA. */
import { COURSES, LET, PTS } from '../data/courses'
import type { Grade } from '../store/types'

export function letterFor(c: string, pct: number) { const cut = COURSES[c].cut; for (let k = 0; k < cut.length; k++) if (pct >= cut[k] - 1e-9) return k; return -1 }
export type Stats = { rows: Grade[]; earned: number; gw: number; pct: number | null; li: number | null; rem: number }
export function courseStats(grades: Grade[], c: string): Stats {
  const rows = grades.filter(g => g.c === c).sort((a, b) => (a.o || 0) - (b.o || 0))
  let earned = 0, gw = 0; for (const g of rows) if (typeof g.score === 'number') { earned += g.score * g.wt / 100; gw += g.wt }
  const pct = gw ? earned / gw * 100 : null, li = pct == null ? null : letterFor(c, pct)
  return { rows, earned, gw, pct, li, rem: 100 - gw }
}
export type Need = { letter: string; target: number; cls: 'ok' | 'bad' | ''; text: string }
export function needLine(c: string, s: Stats, k: number): Need | null {
  const target = COURSES[c].cut[k]; if (s.rem <= 0.001) return null
  const need = (target - s.earned) / s.rem * 100
  return {
    letter: LET[k], target,
    cls: need <= 0 ? 'ok' : need > 100 ? 'bad' : '',
    text: need <= 0 ? 'already locked in' : need > 100 ? 'out of reach' : Math.ceil(need * 10) / 10 + '% avg on the remaining ' + Math.round(s.rem * 10) / 10 + '%',
  }
}
/** The two "need" lines the old app showed: raise to the next letter, then keep the current one. */
export function needLines(c: string, s: Stats): Need[] {
  const out: Need[] = []
  if (s.pct == null || s.rem <= 0) return out
  const keep = s.li! >= 0 ? s.li! : COURSES[c].cut.length - 1, up = Math.max(0, keep - 1)
  if (keep > 0) { const a = needLine(c, s, up); if (a) out.push(a) }
  const b = needLine(c, s, keep); if (b) out.push(b)
  return out
}
export function projectedGpa(grades: Grade[]) {
  let pts = 0, n = 0
  for (const c in COURSES) { const s = courseStats(grades, c); if (s.pct != null) { pts += s.li! >= 0 ? PTS[s.li!] : 0; n++ } }
  return { gpa: n ? pts / n : null, n }
}
export const letterText = (li: number | null) => (li == null ? '–' : li >= 0 ? LET[li] : 'F')
export const pointsText = (li: number | null) => (li == null ? '–' : li >= 0 ? PTS[li].toFixed(1) : '0.0')
