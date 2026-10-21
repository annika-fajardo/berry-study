/* Grades: a tidy report card with the projected GPA, plus "what if" sliders on ungraded items.
   What-if values live in their own store and never become real marks. */
import { useEffect, useState } from 'react'
import { GraduationCap, RotateCcw } from 'lucide-react'
import { useData } from '../lib/hooks'
import { COURSES, COURSE_KEYS, LET, PTS } from '../data/courses'
import { courseStats, needLines, letterFor, letterText, pointsText } from '../lib/grades'
import { saveScore } from '../store/actions'
import { update } from '../store/store'
import { toast } from '../lib/events'
import { Panel, I, PageHead } from '../components/ui'
import type { Grade } from '../store/types'

/** Course stats with what-if values filled in where a real mark is missing. */
function whatIfStats(grades: Grade[], c: string, whatIf: Record<string, number>) {
  const merged = grades.map(g => (g.c === c && typeof g.score !== 'number' && typeof whatIf[g.id] === 'number' ? { ...g, score: whatIf[g.id] } : g))
  return courseStats(merged, c)
}
function projected(grades: Grade[], whatIf: Record<string, number>) {
  let pts = 0, n = 0
  for (const c of COURSE_KEYS) { const s = whatIfStats(grades, c, whatIf); if (s.pct != null) { pts += s.li! >= 0 ? PTS[s.li!] : 0; n++ } }
  return n ? pts / n : null
}

function ScoreInput({ g, course }: { g: Grade; course: string }) {
  const [v, setV] = useState(typeof g.score === 'number' ? String(g.score) : '')
  useEffect(() => { setV(typeof g.score === 'number' ? String(g.score) : '') }, [g.score])
  const commit = () => {
    const cur = typeof g.score === 'number' ? String(g.score) : ''
    if (v === cur) return
    const m = saveScore(g.id, v); if (m) toast(m)
  }
  return <input className="input" type="number" min={0} max={100} step="any" inputMode="decimal" id={'g-' + g.id} placeholder="–" value={v}
    aria-label={course + ' ' + g.name + ' score in percent'} onChange={e => setV(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur() } }} />
}

export function Grades() {
  const { s, grades } = useData()
  const [whatIf, setWhatIf] = useState<Record<string, boolean>>({})
  const real = projected(grades, {})
  const proj = projected(grades, s.whatIf)
  const anyWhatIf = Object.keys(s.whatIf).length > 0
  return (
    <div className="page">
      <PageHead title="Grades" desc="What each course is tracking at, and what it takes to hold or raise a letter." />
      <Panel icon={GraduationCap} title="Projected term GPA" id="gpa-p" right={anyWhatIf ? <button type="button" className="btn quiet sm" onClick={() => update(d => { d.whatIf = {} })}><I as={RotateCcw} size={15} />Reset what-ifs</button> : undefined}>
        <div className="gpa-row">
          <div><div className="gpa-big" id="gpa">{real == null ? '–' : real.toFixed(2)}</div><div className="note">From marks you have</div></div>
          {anyWhatIf && <div><div className="gpa-big what" id="gpa-whatif">{proj == null ? '–' : proj.toFixed(2)}</div><div className="note">What if</div></div>}
          <p className="note" style={{ flex: '1 1 240px' }}>Each course projects from what's graded so far, using its own letter cutoffs. All four are 3 units on the U of C 4-point scale.</p>
        </div>
      </Panel>
      <div className="cols2">
        {COURSE_KEYS.map(c => {
          const st = courseStats(grades, c)
          const wi = whatIfStats(grades, c, s.whatIf)
          const on = !!whatIf[c]
          const needs = needLines(c, st)
          const ungraded = st.rows.filter(g => typeof g.score !== 'number')
          const changed = wi.pct != null && st.pct !== wi.pct
          return (
            <Panel key={c} id={'g-' + c.replace(' ', '')} className="gcard" title={<><span style={{ color: COURSES[c].color }}>{c}</span> <span className="note">{COURSES[c].name}</span></>}
              right={<span className="gnow">{st.pct == null ? <b>–</b> : <><b>{Math.round(st.pct * 10) / 10}%</b><span className="letter">{letterText(st.li)}</span></>}</span>}>
              {changed && <p className="tip">What if: <b>{Math.round(wi.pct! * 10) / 10}% · {LET[letterFor(c, wi.pct!)] || 'F'} · {pointsText(wi.li)}</b></p>}
              <div className="gbar"><span style={{ width: Math.min(100, st.gw) + '%', background: COURSES[c].color }} /></div>
              <p className="note">{Math.round(st.gw * 10) / 10}% of the course graded{st.pct != null ? ` · ${Math.round(st.earned * 10) / 10} of those points earned` : ''}</p>
              {needs.length > 0 && <div className="need">{needs.map(x => <div key={x.letter}>To finish with {x.letter} ({x.target}%): <b className={x.cls}>{x.text}</b></div>)}</div>}
              <table className="report">
                <thead><tr><th>Item</th><th className="r">Weight</th><th className="r">Mark</th></tr></thead>
                <tbody>
                  {st.rows.map(g => {
                    const isWhatIf = on && typeof g.score !== 'number'
                    return (
                      <tr key={g.id}>
                        <td><label htmlFor={isWhatIf ? 'wi-' + g.id : 'g-' + g.id}>{g.name}</label>{g.d && <span className="note"> · {g.d}</span>}</td>
                        <td className="r note num">{g.wt}%</td>
                        <td className="r">
                          {isWhatIf ? (
                            <span className="wi">
                              <input id={'wi-' + g.id} type="range" min={0} max={100} step={1} value={s.whatIf[g.id] ?? 75} aria-label={'What if ' + g.name + ' scores'}
                                onChange={e => { const n = Number(e.target.value); update(d => { d.whatIf[g.id] = n }) }} />
                              <b className="num">{s.whatIf[g.id] ?? 75}%</b>
                            </span>
                          ) : <ScoreInput g={g} course={c} />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {ungraded.length > 0 && (
                <div className="wrap">
                  <button type="button" className="chip" aria-pressed={on} onClick={() => setWhatIf(x => ({ ...x, [c]: !on }))}>What if…</button>
                  <span className="note">{on ? 'Drag a slider to see where the course lands. Nothing is saved as a real mark.' : `${ungraded.length} item${ungraded.length === 1 ? '' : 's'} not marked yet`}</span>
                </div>
              )}
            </Panel>
          )
        })}
      </div>
      <p className="note">A+ and A = 4.0, A− 3.7, B+ 3.3, B 3.0, B− 2.7, C+ 2.3, C 2.0, C− 1.7, D+ 1.3, D 1.0. FNCE 445 splits assignments at 5% each and quizzes at 7.5%; the outline only gives the totals.</p>
    </div>
  )
}
