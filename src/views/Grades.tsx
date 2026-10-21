import { useEffect, useState } from 'react'
import { useData } from '../lib/hooks'
import { COURSES, COURSE_KEYS } from '../data/courses'
import { courseStats, needLines, projectedGpa, letterText, pointsText } from '../lib/grades'
import { saveScore } from '../store/actions'
import { toast } from '../lib/events'
import { Berry } from '../components/Characters'
import type { Grade } from '../store/types'

function ScoreInput({ g, course }: { g: Grade; course: string }) {
  const [v, setV] = useState(typeof g.score === 'number' ? String(g.score) : '')
  useEffect(() => { setV(typeof g.score === 'number' ? String(g.score) : '') }, [g.score])
  const commit = () => {
    const cur = typeof g.score === 'number' ? String(g.score) : ''
    if (v === cur) return
    const m = saveScore(g.id, v); if (m) toast(m)
  }
  return (
    <input className="input" type="number" min={0} max={100} step="any" inputMode="decimal" id={'g-' + g.id} placeholder="–" value={v}
      aria-label={course + ' ' + g.name + ' score in percent'} onChange={e => setV(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur() } }} />
  )
}

export function Grades() {
  const { grades } = useData()
  const { gpa, n } = projectedGpa(grades)
  return (
    <div className="page">
      <header><div className="eyebrow">U of C 4-point scale</div><h1 className="display">Grades</h1></header>
      <section className="card bold gpa-card" aria-label="Projected term GPA">
        <div><div className="eyebrow">Projected term GPA</div><div className="big" id="gpa">{gpa == null ? '–' : gpa.toFixed(2)}</div></div>
        <p className="note" style={{ flex: '1 1 220px' }}>{n ? 'Based on ' + n + ' of 4 courses with marks so far. Each course projects from what\'s graded, using its own letter cutoffs.' : 'Enter a mark as a percentage when you get it back. Each course projects from what\'s graded so far, using that course\'s own letter cutoffs.'}</p>
        <Berry mood={gpa != null && gpa >= 3.3 ? 'proud' : 'happy'} size={86} />
      </section>
      <div className="grid2">
        {COURSE_KEYS.map(c => {
          const s = courseStats(grades, c), needs = needLines(c, s)
          return (
            <section key={c} className="card bold gcard" style={{ ['--cc' as string]: COURSES[c].color, ['--cs' as string]: COURSES[c].soft }} aria-label={c + ' grades'}>
              <div className="ghead">
                <div><h2 className="h3">{c}</h2><div className="note">{COURSES[c].name}</div></div>
                <div className="gnow">
                  {s.pct == null ? <><b>–</b><span className="note">no marks yet</span></> : <><b>{Math.round(s.pct * 10) / 10}%</b><span className="letter">{letterText(s.li)} · {pointsText(s.li)}</span></>}
                </div>
              </div>
              <div className="gbar"><span style={{ width: Math.min(100, s.gw) + '%' }} /></div>
              <div className="note">{Math.round(s.gw * 10) / 10}% of the course graded{s.pct != null ? ' · ' + (Math.round(s.earned * 10) / 10) + ' of those points earned' : ''}</div>
              {needs.length > 0 && (
                <div className="need">
                  {needs.map(x => <div key={x.letter}>To finish with {x.letter} ({x.target}%): <b className={x.cls}>{x.text}</b></div>)}
                </div>
              )}
              <table className="gtable">
                <tbody>
                  {s.rows.map(g => (
                    <tr key={g.id}>
                      <td><label htmlFor={'g-' + g.id}>{g.name}</label>{g.d && <span className="note"> · {g.d}</span>}</td>
                      <td className="wt">{g.wt}%</td>
                      <td className="sc"><ScoreInput g={g} course={c} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )
        })}
      </div>
      <p className="note">GPA uses the U of C 4-point scale (A+ and A = 4.0, A− 3.7, B+ 3.3, B 3.0, B− 2.7, C+ 2.3, C 2.0, C− 1.7, D+ 1.3, D 1.0) with all four courses at 3 units. FNCE 445 splits assignments 5% each and quizzes 7.5% each; the outline gives only the totals.</p>
    </div>
  )
}
