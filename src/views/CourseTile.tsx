/* Course tile: a soft pattern in the course colour, a small code chip, and live stats. */
import { useData, useToday } from '../lib/hooks'
import { COURSES } from '../data/courses'
import { courseStats } from '../lib/grades'
import { courseSlug } from '../lib/router'

const PATTERNS = ['gingham', 'grid', 'dots', 'stripes'] as const
export type Pattern = typeof PATTERNS[number]
export const PATTERN_OF: Record<string, Pattern> = { 'FNCE 477': 'grid', 'FNCE 445': 'gingham', 'MGST 451': 'dots', 'SGMA 591': 'stripes' }

export function PatternFill({ kind, color, id }: { kind: Pattern; color: string; id: string }) {
  return (
    <svg className="tile-pattern" aria-hidden="true">
      <defs>
        <pattern id={id} width={kind === 'gingham' ? 22 : kind === 'grid' ? 14 : kind === 'dots' ? 18 : 16} height={kind === 'gingham' ? 22 : kind === 'grid' ? 14 : kind === 'dots' ? 18 : 16} patternUnits="userSpaceOnUse" patternTransform={kind === 'stripes' ? 'rotate(45)' : undefined}>
          {kind === 'gingham' && <><rect width="22" height="11" fill={color} opacity=".3" /><rect width="11" height="22" fill={color} opacity=".3" /></>}
          {kind === 'grid' && <path d="M0 0 H14 M0 0 V14" stroke={color} strokeWidth="1" opacity=".5" fill="none" />}
          {kind === 'dots' && <circle cx="4" cy="4" r="2.2" fill={color} opacity=".45" />}
          {kind === 'stripes' && <rect width="7" height="16" fill={color} opacity=".32" />}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

export function CourseTile({ c }: { c: string }) {
  const { s, items, grades } = useData()
  const t = useToday()
  const info = COURSES[c]
  const open = items.filter(i => i.c === c && !i.done && i.d && i.d >= t)
  const deadlines = open.filter(i => i.k === 'due').length, exams = open.filter(i => i.k === 'test').length
  const st = courseStats(grades, c)
  const pct = Math.round(st.gw)
  void s
  return (
    <a className="ctile" href={'#/study/' + courseSlug(c)} style={{ ['--cc' as string]: info.color }}>
      <PatternFill kind={PATTERN_OF[c] || 'dots'} color={info.color} id={'pat-' + courseSlug(c)} />
      <span className="ctile-chip"><b>{c}</b><span>{info.name}</span></span>
      <span className="ctile-foot">
        <span className="note">{deadlines} deadline{deadlines === 1 ? '' : 's'} · {exams} exam{exams === 1 ? '' : 's'}</span>
        <span className="ctile-bar"><span style={{ width: Math.min(100, pct) + '%' }} /></span>
        <span className="note num">{pct}% graded</span>
      </span>
    </a>
  )
}
