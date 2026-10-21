/* Courses. Every course has the same four sections — Learn, Practice, Assignments, Progress — and opens
   with one recommended next action. Courses with thin material still show all four, with a helpful note. */
import { useEffect, useReducer, useRef, useState } from 'react'
import pdfs, { PDF_EMBEDDED } from 'virtual:pdfs'
import { BookOpen, Dumbbell, ClipboardCheck, BarChart3, FileText, Download, ExternalLink, Play, Lightbulb, RotateCcw } from 'lucide-react'
import { useData, useToday } from '../lib/hooks'
import { COURSES, COURSE_KEYS, LET } from '../data/courses'
import { COURSE_CONTENT, type CourseContent, type AssignPart, type PdfRef } from '../data/content'
import { DRILLS, f2 } from '../data/drills'
import { courseStats } from '../lib/grades'
import { conceptsFor } from '../lib/concepts'
import { readiness } from '../lib/readiness'
import { daysBetween, fmt, parse, hm, monday } from '../lib/dates'
import { courseSlug, go } from '../lib/router'
import { update } from '../store/store'
import { recordPractice, answerXp, setWritten } from '../store/actions'
import { celebrateXp, catSays } from '../lib/events'
import { Panel, I, ViewTabs, PageHead, Empty, ReadyBar, type Icon } from '../components/ui'
import { CourseTile, PatternFill, PATTERN_OF } from './CourseTile'
import { PracticeSurface, MasteryCard } from './Quizzes'
import type { AppState } from '../store/types'

export const closeEnough = (v: number, ans: number, tol?: number) => Math.abs(v - ans) <= (tol ?? Math.max(0.011, Math.abs(ans) * 0.0006))
export function parseNum(s: string) { s = String(s).replace(/[$,\s]/g, '').replace(/−/g, '-'); if (/^\(.*\)$/.test(s)) s = '-' + s.slice(1, -1); return s === '' ? NaN : Number(s) }
export const letterOf = (i: number) => String.fromCharCode(65 + i)
export function useForce() { return useReducer((x: number) => x + 1, 0)[1] }
export function weekMinutes(s: AppState, c: string, today: string) {
  const mon = monday(parse(today)); let m = 0
  for (const [d, doc] of Object.entries(s.study)) if (parse(d) >= mon) m += Number(doc[c] || 0)
  return m
}

type Section = 'learn' | 'practice' | 'assignments' | 'progress'
const SECTIONS: { v: Section; label: string; icon: Icon }[] = [
  { v: 'learn', label: 'Learn', icon: BookOpen }, { v: 'practice', label: 'Practice', icon: Dumbbell },
  { v: 'assignments', label: 'Assignments', icon: ClipboardCheck }, { v: 'progress', label: 'Progress', icon: BarChart3 },
]

export function Courses({ parts }: { parts: string[] }) {
  const c = COURSE_KEYS.find(k => courseSlug(k) === parts[0])
  if (c) return <CoursePage c={c} sub={parts[1]} arg={parts[2]} />
  return <CoursePicker />
}

function CoursePicker() {
  return (
    <div className="page">
      <PageHead title="Courses" desc="Four courses, each with the same four sections: what to learn, what to practise, what's due, and where you stand." />
      <div className="tilegrid">{COURSE_KEYS.map(c => <CourseTile key={c} c={c} />)}</div>
    </div>
  )
}

/* ---------------- course page ---------------- */
function CoursePage({ c, sub, arg }: { c: string; sub?: string; arg?: string }) {
  const { s, items, grades } = useData()
  const t = useToday()
  const cc = COURSE_CONTENT[c]
  const info = COURSES[c]
  const cur = (SECTIONS.find(x => x.v === sub) || SECTIONS[0]).v
  const st = courseStats(grades, c)
  const open = items.filter(i => i.c === c && !i.done && i.d && i.d >= t).sort((a, b) => a.d!.localeCompare(b.d!))
  const nextTest = open.find(i => i.k === 'test')
  const next = open[0]
  const r = nextTest ? readiness(s, nextTest, t) : null

  return (
    <div className="page">
      <div><a className="crumb" href="#/study">← All courses</a></div>
      <header className="course-head" style={{ ['--cc' as string]: info.color }}>
        <PatternFill kind={PATTERN_OF[c] || 'dots'} color={info.color} id={'ch-' + courseSlug(c)} />
        <div className="ch-inner">
          <div className="ch-title">
            <div className="eyebrow">{c}</div>
            <h1 className="ptitle">{info.name}</h1>
          </div>
          <div className="ch-facts">
            <span>Next: <b>{next ? next.t + ' · ' + fmt(parse(next.d!), { month: 'short', day: 'numeric' }) : 'nothing scheduled'}</b></span>
            <span>Grade so far: <b>{st.pct == null ? 'no marks yet' : Math.round(st.pct * 10) / 10 + '% (' + (st.li! >= 0 ? LET[st.li!] : 'F') + ')'}</b></span>
            <span>This week: <b>{hm(weekMinutes(s, c, t))}</b></span>
          </div>
        </div>
      </header>

      <NextAction c={c} />

      <nav className="vtabs section-tabs" aria-label="Course sections">
        {SECTIONS.map(x => <a key={x.v} href={'#/study/' + courseSlug(c) + '/' + x.v} aria-current={cur === x.v ? 'page' : undefined}><I as={x.icon} size={15} />{x.label}</a>)}
      </nav>

      <div key={c + cur}>
        {cur === 'learn' && <Learn c={c} cc={cc} />}
        {cur === 'practice' && <PracticeSurface c={c} mode={arg} />}
        {cur === 'assignments' && <Assignments c={c} cc={cc} />}
        {cur === 'progress' && <Progress c={c} r={r} nextTestName={nextTest ? nextTest.t : null} />}
      </div>
    </div>
  )
}

/** The one recommended thing to do next for this course. */
export function NextAction({ c }: { c: string }) {
  const { s, items } = useData()
  const t = useToday()
  const open = items.filter(i => i.c === c && !i.done && i.d && i.d >= t).sort((a, b) => a.d!.localeCompare(b.d!))
  const test = open.find(i => i.k === 'test')
  const target = test || open[0]
  if (!target) return null
  const n = daysBetween(t, target.d!)
  const r = test ? readiness(s, test, t) : null
  const weak = r?.weak[0]
  const mins = r ? (r.pct < 50 ? 50 : 20) : 25
  return (
    <div className="next-action">
      <div className="grow">
        <b>{target.t} {n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days'}</b>
        <span className="note">
          {r ? <>{r.pct}% ready · {weak && weak.seen === 0 ? `start with ${weak.name}` : weak ? `${mins} min on ${weak.name}` : `${mins} min of practice`}</> : `${mins} min on ${target.t}`}
        </span>
      </div>
      {r && <ReadyBar pct={r.pct} />}
      <a className="btn" href={'#/study/' + courseSlug(c) + '/practice' + (weak ? '' : '')}><I as={Play} size={15} />Start</a>
    </div>
  )
}

/* ---------------- Learn ---------------- */
function openPdf(p: PdfRef, download: boolean) {
  const href = pdfs[p.file]
  if (!PDF_EMBEDDED) return
  const b64 = href.split(',')[1], bin = atob(b64), arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }))
  const a = document.createElement('a'); a.href = url
  if (download) a.download = p.file; else a.target = '_blank'
  a.rel = 'noopener'; document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
function Learn({ c, cc }: { c: string; cc: CourseContent }) {
  if (!cc) return <Panel icon={BookOpen} title="Learn" id="learn"><Empty>Send Claude your {c} slides or readings and this fills in with a formula sheet and key concepts.</Empty></Panel>
  return (
    <>
      {(cc.pdfs || []).length > 0 && (
        <Panel icon={FileText} title="Course files" id="files">
          {(cc.pdfs || []).map(p => (
            <div className="pdf-row" key={p.file}>
              <div style={{ minWidth: 0, flex: '1 1 240px' }}><b>{p.title}</b><div className="note">{p.desc}</div></div>
              <div className="wrap">
                {PDF_EMBEDDED ? <>
                  <button type="button" className={'btn sm' + (p.primary ? '' : ' quiet')} onClick={() => openPdf(p, false)}><I as={ExternalLink} size={15} />Open</button>
                  <button type="button" className="btn quiet sm" onClick={() => openPdf(p, true)}><I as={Download} size={15} />Download</button>
                </> : <>
                  <a className={'btn sm' + (p.primary ? '' : ' quiet')} href={pdfs[p.file]} target="_blank" rel="noopener"><I as={ExternalLink} size={15} />Open</a>
                  <a className="btn quiet sm" href={pdfs[p.file]} download={p.file}><I as={Download} size={15} />Download</a>
                </>}
              </div>
            </div>
          ))}
        </Panel>
      )}
      {cc.sourceNote && <p className="note">{cc.sourceNote}</p>}
      {cc.calcTip && <Panel icon={Lightbulb} title="Calculator" id="calc"><p>{cc.calcTip}</p></Panel>}
      <div className="fgrid">
        {cc.formulas.map(sec => (
          <Panel key={sec.h} title={sec.h} id={'sec-' + sec.h.slice(0, 12)}>
            <ul className="fl">
              {sec.items.map(([t, h]) => <li key={t}><b>{t}</b><div style={{ display: 'flex', flexDirection: 'column', gap: 5 }} dangerouslySetInnerHTML={{ __html: h }} /></li>)}
            </ul>
          </Panel>
        ))}
      </div>
    </>
  )
}

/* ---------------- Assignments ---------------- */
function CheckRow({ id, label, ans, topic, c }: { id: string; label: string; ans: number; topic: string; c: string }) {
  const [v, setV] = useState('')
  const [res, setRes] = useState<{ ok: boolean; msg: string } | null>(null)
  const tries = useRef(0)
  const go2 = () => {
    const x = parseNum(v)
    if (isNaN(x)) { setRes({ ok: false, msg: 'Enter a number.' }); return }
    const ok = closeEnough(x, ans)
    tries.current++
    setRes({ ok, msg: ok ? 'Correct.' : (Math.sign(x) !== Math.sign(ans) && ans !== 0 && x !== 0 ? 'Check the sign.' : Math.abs(x - ans) / Math.max(1, Math.abs(ans)) < 0.03 ? 'Close. Check your rounding or a small step.' : 'Not yet. Work back through the steps above.') })
    let g = 0
    update(d => {
      recordPractice(d, topic, 'Assignment · ' + topic.replace('a2-', 'Q'), ok, c)
      g = answerXp(d, ok, 'Assignment check: ' + label, c, { firstTry: tries.current === 1, ref: 'check:' + id })
    })
    celebrateXp(g); if (!ok) catSays('wrong')
  }
  return (
    <div className={'chk' + (res ? (res.ok ? ' ok' : ' no') : '')}>
      <label htmlFor={'ck-' + id}>{label}</label>
      <input className="input" id={'ck-' + id} inputMode="decimal" autoComplete="off" value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') go2() }} />
      <button type="button" className="btn quiet sm" onClick={go2}>Check</button>
      <div className={'res' + (res ? (res.ok ? ' ok' : ' no') : '')} aria-live="polite">{res?.msg}</div>
    </div>
  )
}
function WrittenBox({ id, prompt, initial }: { id: string; prompt: string; initial: string }) {
  const [v, setV] = useState(initial)
  const t = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(t.current), [])
  return (
    <div className="stack" style={{ gap: 4 }}>
      <textarea className="input" id={id} placeholder={prompt} aria-label={prompt} value={v}
        onChange={e => { const x = e.target.value; setV(x); clearTimeout(t.current); t.current = setTimeout(() => setWritten(id, x), 400) }}
        onBlur={() => { clearTimeout(t.current); if (v !== initial) setWritten(id, v) }} />
      <span className="note">Saved on this device as you type.</span>
    </div>
  )
}
function Assignments({ c, cc }: { c: string; cc: CourseContent }) {
  const { s, items } = useData()
  const t = useToday()
  const A = cc?.assignment
  const due = items.filter(i => i.c === c && i.k !== 'test' && !i.done && i.d && i.d >= t).sort((a, b) => a.d!.localeCompare(b.d!))
  const past = items.filter(i => i.c === c && i.k !== 'test' && (i.done || (i.d && i.d < t))).sort((a, b) => (b.d || '').localeCompare(a.d || ''))
  const current = due[0]
  const coachFits = !!A && !!current && current.t.toLowerCase().startsWith(A.title.toLowerCase().slice(0, 10))
  return (
    <>
      <Panel icon={ClipboardCheck} title="What's due" id="due">
        {due.length ? due.slice(0, 6).map(i => (
          <div className="deckrow" key={i.id}>
            <div><b>{i.t}</b><span className="note">{fmt(parse(i.d!), { weekday: 'long', month: 'short', day: 'numeric' })}{i.w ? ' · ' + i.w : ''}{i.n ? ' · ' + i.n : ''}</span></div>
            <span className="note">{(() => { const n = daysBetween(t, i.d!); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days' })()}</span>
          </div>
        )) : <Empty status="proud">Nothing due for {c} right now.</Empty>}
      </Panel>

      {A ? (
        <Panel icon={ClipboardCheck} title={A.title + ' coach'} id="coach" right={<span className="note">{coachFits ? 'Due ' + A.due : 'Past assignment'}</span>}>
          <p className="note">Each question shows what it's testing and the method, step by step. Enter your numbers to check them: it says right or not yet, never the answer. Written parts save on this device.</p>
          {A.qs.map(q => (
            <details className="q" key={q.n}>
              <summary><span className="qn">Q{q.n}</span><span className="qt">{q.t}</span><span className="qs">{q.ch}</span></summary>
              <p className="note">Testing: {q.tests}</p>
              {q.parts.map((part: AssignPart) => (
                <div className="part" key={part.p}>
                  <h4 className="h3">Part ({part.p})</h4>
                  <ol className="steps">{part.steps.map((st, k) => <li key={k}>{st}</li>)}</ol>
                  {(part.checks || []).map(([lab, ans], k) => <CheckRow key={k} id={`a2-${q.n}${part.p}-${k}`} label={lab} ans={ans} topic={'a2-' + q.n} c={c} />)}
                  {part.write && <WrittenBox id={'wr-' + q.n + part.p} prompt={part.write} initial={s.written['wr-' + q.n + part.p] || ''} />}
                </div>
              ))}
            </details>
          ))}
        </Panel>
      ) : (
        <Panel icon={ClipboardCheck} title="Assignment coach" id="coach">
          <Empty>No step-by-step coach for {c} yet. Send Claude the assignment and this fills in with the method and number checks.</Empty>
        </Panel>
      )}

      {past.length > 0 && (
        <Panel title="Earlier" id="past">
          <details><summary className="link-summary">{past.length} past item{past.length === 1 ? '' : 's'}</summary>
            {past.slice(0, 20).map(i => <div className="deckrow" key={i.id}><div><b>{i.t}</b><span className="note">{i.d ? fmt(parse(i.d), { month: 'short', day: 'numeric' }) : 'no date'}{i.w ? ' · ' + i.w : ''}</span></div>{i.done && <span className="note">done</span>}</div>)}
          </details>
        </Panel>
      )}
    </>
  )
}

/* ---------------- Progress ---------------- */
function Progress({ c, r, nextTestName }: { c: string; r: ReturnType<typeof readiness> | null; nextTestName: string | null }) {
  const { s } = useData()
  const t = useToday()
  const mx = Math.max(60, ...COURSE_KEYS.map(k => weekMinutes(s, k, t)))
  const rows = Object.entries(s.practice).filter(([, p]) => p.c === c).sort((a, b) => a[1].correct / a[1].tries - b[1].correct / b[1].tries)
  const col = (pct: number) => (pct >= 0.8 ? 'var(--primary)' : pct >= 0.5 ? 'var(--ochre)' : 'var(--strawberry)')
  const concepts = conceptsFor(c).length
  return (
    <>
      {r && nextTestName && (
        <Panel icon={BarChart3} title={'Readiness · ' + nextTestName} id="ready" right={<ReadyBar pct={r.pct} />}>
          <p className="note">Topic knowledge {Math.round(r.knowledge * 100)}% · study done {Math.round(r.studied * 100)}%. Accuracy older than two weeks counts for less, and topics you've never practised count as zero.</p>
          <div className="stack" style={{ gap: 6 }}>
            {r.weak.map(w => (
              <div className="prow" key={w.id}>
                <span>{w.name}<span className="note"> {w.seen ? `· ${Math.round(w.acc * 100)}% over ${w.seen}` : '· not practised'}</span></span>
                <span className="bar"><span style={{ width: Math.round(w.acc * 100) + '%', background: col(w.acc) }} /></span>
                <a className="btn quiet sm" href={w.href}>Practise</a>
              </div>
            ))}
          </div>
        </Panel>
      )}
      <Panel title="Study time this week" id="time">
        {COURSE_KEYS.map(k => { const m = weekMinutes(s, k, t); return <div className="prow" key={k}><span className={k === c ? '' : 'note'}>{k}</span><span className="bar"><span style={{ width: Math.round(m / mx * 100) + '%', background: k === c ? 'var(--primary)' : 'var(--line-strong)' }} /></span><span className="pct">{hm(m)}</span></div> })}
      </Panel>
      <MasteryCard c={c} title="Concept mastery, weakest first" />
      <Panel title="Practice history" id="hist">
        {rows.length ? rows.map(([id, p]) => { const pct = p.tries ? p.correct / p.tries : 0; return <div className="prow" key={id}><span>{p.label}</span><span className="bar"><span style={{ width: Math.round(pct * 100) + '%', background: col(pct) }} /></span><span className="pct">{p.correct}/{p.tries}</span></div> })
          : <Empty>{concepts ? 'Answer a few practice questions and your accuracy by topic shows up here.' : `Send Claude your ${c} material and practice tracking fills in.`}</Empty>}
      </Panel>
    </>
  )
}

export { DRILLS, f2, RotateCcw, go }
