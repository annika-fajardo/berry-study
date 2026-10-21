/* Grades: a tidy report card with the projected GPA, the need lines, a best/likely/worst band, and
   "what if" sliders on anything unmarked. What-if values live in their own store and never become real marks;
   everything on the card — the need lines, the per-item need and the term GPA — reads the what-if numbers. */
import { useEffect, useState } from 'react'
import { GraduationCap, RotateCcw, Info } from 'lucide-react'
import { useData } from '../lib/hooks'
import { COURSES, COURSE_KEYS, LET, PTS } from '../data/courses'
import { courseStats, needLines, letterFor, letterText, pointsText, itemNeed, band, roundingSplit, applyRounding } from '../lib/grades'
import { saveScore } from '../store/actions'
import { update } from '../store/store'
import { toast } from '../lib/events'
import { Panel, I, PageHead } from '../components/ui'
import type { Grade, Rounding } from '../store/types'

/** Course stats with what-if values filled in where a real mark is missing. */
function merge(grades: Grade[], whatIf: Record<string, number>) {
  return grades.map(g => (typeof g.score !== 'number' && typeof whatIf[g.id] === 'number' ? { ...g, score: whatIf[g.id] } : g))
}
function projectedWith(grades: Grade[], whatIf: Record<string, number>) {
  const m = merge(grades, whatIf)
  let pts = 0, units = 0
  for (const c of COURSE_KEYS) {
    const s = courseStats(m, c)
    if (s.pct == null) continue
    const u = COURSES[c].units ?? 3
    pts += (s.li! >= 0 ? PTS[s.li!] : 0) * u; units += u
  }
  return units ? pts / units : null
}

function ScoreInput({ g, course }: { g: Grade; course: string }) {
  const [v, setV] = useState(typeof g.score === 'number' ? String(g.score) : '')
  useEffect(() => { setV(typeof g.score === 'number' ? String(g.score) : '') }, [g.score])
  const commit = () => {
    const cur = typeof g.score === 'number' ? String(g.score) : ''
    if (v === cur) return
    const m = saveScore(g.id, v); if (m) toast(m)
  }
  // No max: bonus marks above 100 are real and have to be enterable.
  return <input className="input" type="number" min={0} step="any" inputMode="decimal" id={'g-' + g.id} placeholder="–" value={v}
    aria-label={course + ' ' + g.name + ' score in percent'} onChange={e => setV(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur() } }} />
}

export function Grades() {
  const { s, grades } = useData()
  const [whatIfOn, setWhatIfOn] = useState<Record<string, boolean>>({})
  const real = projectedWith(grades, {})
  const proj = projectedWith(grades, s.whatIf)
  const anyWhatIf = Object.keys(s.whatIf).length > 0
  const merged = merge(grades, s.whatIf)
  return (
    <div className="page">
      <PageHead title="Grades" desc="What each course is tracking at, what it takes to hold or raise a letter, and what happens if a mark lands differently." />
      <Panel icon={GraduationCap} title="Projected term GPA" id="gpa-p" right={anyWhatIf ? <button type="button" className="btn quiet sm" onClick={() => update(d => { d.whatIf = {} })}><I as={RotateCcw} size={15} />Reset what-ifs</button> : undefined}>
        <div className="gpa-row">
          <div><div className="gpa-big" id="gpa">{real == null ? '–' : real.toFixed(2)}</div><div className="note">From marks you have</div></div>
          {anyWhatIf && <div><div className="gpa-big what" id="gpa-whatif">{proj == null ? '–' : proj.toFixed(2)}</div><div className="note">What if</div></div>}
          <p className="note" style={{ flex: '1 1 240px' }}>Each course projects from what's graded so far, using its own letter cutoffs, and the GPA is weighted by units.</p>
        </div>
      </Panel>
      <div className="cols2">
        {COURSE_KEYS.map(c => {
          const st = courseStats(grades, c)
          const wi = courseStats(merged, c)
          const on = !!whatIfOn[c]
          // The need lines read the what-if stats, so "if I get 80 on Assignment 3, what do I need on the final?" answers.
          const needs = needLines(c, wi)
          const bd = band(merged, c)
          const ungraded = st.rows.filter(g => typeof g.score !== 'number' && !g.dropped)
          const changed = wi.pct != null && st.pct !== wi.pct
          const split = wi.pct != null ? roundingSplit(c, wi.pct, s.rounding[c]) : null
          const target = wi.li != null && wi.li >= 0 ? wi.li : COURSES[c].cut.length - 1
          return (
            <Panel key={c} id={'g-' + c.replace(' ', '')} className="gcard" title={<><span style={{ color: COURSES[c].color }}>{c}</span> <span className="note">{COURSES[c].name}</span></>}
              right={<span className="gnow">{st.pct == null ? <b>–</b> : <><b>{Math.round(st.pct * 10) / 10}%</b><span className="letter">{letterText(st.li)}</span></>}</span>}>
              {changed && <p className="tip">What if: <b>{Math.round(wi.pct! * 10) / 10}% · {LET[letterFor(c, wi.pct!)] || 'F'} · {pointsText(wi.li)}</b></p>}
              {split && wi.pct != null && <p className="note">{Math.round(wi.pct * 10) / 10}% — {LET[split.exact] || 'F'} exactly, {LET[split.rounded] || 'F'} if your prof rounds to {s.rounding[c] === 'half' ? 'the half' : 'a whole'} point ({applyRounding(wi.pct, s.rounding[c])}%).</p>}
              <div className="gbar"><span style={{ width: Math.min(100, wi.gw) + '%', background: COURSES[c].color }} /></div>
              <p className="note">{Math.round(wi.gw * 10) / 10}% of the course graded{wi.pct != null ? ` · ${Math.round(wi.earned * 10) / 10} of those points earned` : ''}{wi.bonus > 0.05 ? ` · including ${Math.round(wi.bonus * 10) / 10}% bonus` : ''}</p>
              {bd && <p className="band"><b className="ok">{letterText(bd.bestLi)} at best</b> · <b>{letterText(bd.likelyLi)} likely</b> · <b className="muted-b">{letterText(bd.worstLi)} at worst</b></p>}
              {wi.pct == null && <p className="note">Nothing is graded yet, so there's no letter to hold and no need line to give. Enter a mark and this fills in.</p>}
              {needs.length > 0 && <div className="need">{needs.map(x => <div key={x.letter}>To finish with {x.letter} ({x.target}%): <b className={x.cls}>{x.text}</b></div>)}</div>}
              <table className="report">
                <thead><tr><th>Item</th><th className="r">Weight</th><th className="r">Need</th><th className="r">Mark</th></tr></thead>
                <tbody>
                  {st.rows.map(g => {
                    const isWhatIf = on && typeof g.score !== 'number'
                    // With nothing graded yet there is no letter to hold, so a need number would be invented.
                    const need = wi.pct != null && typeof g.score !== 'number' && !g.dropped ? itemNeed(merged, c, g.id, s.whatIf, target) : null
                    return (
                      <tr key={g.id} className={g.dropped ? 'dropped' : undefined}>
                        <td><label htmlFor={isWhatIf ? 'wi-' + g.id : 'g-' + g.id}>{g.name}</label>{g.cat && <span className="note"> · {g.cat.name}</span>}{g.dropped && <span className="note"> · dropped</span>}</td>
                        <td className="r note num">{Math.round(g.weight * 10) / 10}%</td>
                        <td className="r note num">{need ? (need.cls === 'ok' ? '–' : need.cls === 'bad' ? 'n/a' : need.pct + '%') : ''}</td>
                        <td className="r">
                          {isWhatIf ? (
                            <span className="wi">
                              <input id={'wi-' + g.id} type="range" min={0} max={100} step={1} value={s.whatIf[g.id] ?? 75} aria-label={'What if ' + g.name + ' scores'}
                                onChange={e => { const n = Number(e.target.value); update(d => { d.whatIf[g.id] = n }) }} />
                              <b className="num">{s.whatIf[g.id] ?? 75}%</b>
                            </span>
                          ) : <ScoreInput g={{ ...g, cat: undefined }} course={c} />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="wrap">
                {ungraded.length > 0 && <button type="button" className="chip" aria-pressed={on} onClick={() => setWhatIfOn(x => ({ ...x, [c]: !on }))}>What if…</button>}
                <label className="wrap note" style={{ gap: 6 }}>Rounding
                  <select className="input sm-select" value={s.rounding[c] || 'exact'} aria-label={c + ' rounding policy'}
                    onChange={e => { const v = e.target.value as Rounding; update(d => { d.rounding[c] = v }) }}>
                    <option value="exact">exact</option><option value="whole">to a whole point</option><option value="half">to the half</option>
                  </select>
                </label>
                {st.cats.length > 0 && <span className="note"><I as={Info} size={13} /> {st.cats.map(x => x.name + ' ' + x.weight + '%' + (x.drop ? ` (drop ${x.drop})` : '')).join(' · ')}</span>}
              </div>
              {on && <p className="note">Drag a slider to see where the course lands. Nothing is saved as a real mark, and the need column updates with it.</p>}
            </Panel>
          )
        })}
      </div>
      <p className="note">A+ and A = 4.0, A− 3.7, B+ 3.3, B 3.0, B− 2.7, C+ 2.3, C 2.0, C− 1.7, D+ 1.3, D 1.0. “Need” is what that one item has to score for the course to hold its current letter, given every other mark and what-if.</p>
    </div>
  )
}
