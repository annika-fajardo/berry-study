import { useEffect, useReducer, useRef, useState } from 'react'
import pdfs, { PDF_EMBEDDED } from 'virtual:pdfs'
import { useData, useToday } from '../lib/hooks'
import { COURSES, COURSE_KEYS, LET } from '../data/courses'
import { COURSE_CONTENT, type CourseContent, type AssignPart, type PdfRef } from '../data/content'
import { DRILLS, f2 } from '../data/drills'
import { courseStats } from '../lib/grades'
import { conceptsFor } from '../lib/concepts'
import { daysBetween, fmt, parse, hm, monday } from '../lib/dates'
import { courseSlug, go } from '../lib/router'
import { update } from '../store/store'
import { recordPractice, answerXp, setWritten } from '../store/actions'
import { celebrateXp, emit } from '../lib/events'
import { CourseIcon, Berry } from '../components/Characters'
import { ui } from './courseState'
import { AdaptiveView, DecksView, MasteryCard } from './Quizzes'
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

/* ---------------------------------------------------------------- picker */
export function Courses({ parts }: { parts: string[] }) {
  const c = COURSE_KEYS.find(k => courseSlug(k) === parts[0])
  if (c) return <CoursePage c={c} sub={parts[1]} />
  return <CoursePicker />
}

function CoursePicker() {
  const { items, grades } = useData()
  const t = useToday()
  return (
    <div className="page">
      <header className="row-between">
        <div><div className="eyebrow">Fall 2026 · four courses</div><h1 className="display">Courses</h1></div>
        <Berry mood="happy" size={70} />
      </header>
      <div className="course-pick">
        {COURSE_KEYS.map(c => {
          const info = COURSES[c], s = courseStats(grades, c)
          const nx = items.filter(i => i.c === c && !i.done && i.d && i.d >= t && i.k !== 'class').sort((a, b) => a.d!.localeCompare(b.d!))[0]
          const n = nx ? daysBetween(t, nx.d!) : 0
          return (
            <a key={c} href={'#/courses/' + courseSlug(c)} className="course-card" style={{ ['--cc' as string]: info.color, ['--cs' as string]: info.soft }}>
              <CourseIcon kind={info.mascot} color={info.color} size={58} />
              <span className="code">{c}</span>
              <span className="name" style={{ paddingRight: 56 }}>{info.name}</span>
              <span className="note" style={{ color: 'var(--ink)' }}>{nx ? <>Next: <b>{nx.t}</b> · {n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days'}</> : 'Nothing scheduled'}</span>
              <span className="foot">
                <span className="sticker">{s.pct == null ? 'no marks yet' : Math.round(s.pct * 10) / 10 + '% · ' + (s.li! >= 0 ? LET[s.li!] : 'F')}</span>
                {COURSE_CONTENT[c]?.practice && <span className="sticker" style={{ transform: 'rotate(1.5deg)' }}>practice set</span>}
                {c === 'FNCE 477' && <span className="sticker" style={{ transform: 'rotate(1deg)' }}>quiz decks</span>}
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- course page */
type SubKey = 'formulas' | 'decks' | 'adaptive' | 'flash' | 'assign' | 'quiz' | 'drills' | 'progress'
export function subTabs(c: string, cc: CourseContent): [SubKey, string][] {
  const tabs: [SubKey, string][] = [['formulas', cc.formulasLabel || 'Key concepts'], ['adaptive', c === 'FNCE 445' ? 'Quiz-style practice' : 'Concept quiz'], ['flash', 'Flashcards']]
  if (cc.assignment) tabs.push(['assign', cc.assignment.title + ' coach'])
  if (cc.practice) tabs.push(['quiz', cc.quizLabel || 'Practice'])
  if (cc.drills) tabs.push(['drills', 'Endless drills'])
  tabs.push(['progress', 'Progress'])
  if (c === 'FNCE 477') tabs.splice(1, 0, ['decks', 'Quiz decks'])
  return tabs
}

function CoursePage({ c, sub }: { c: string; sub?: string }) {
  const { s, items, grades } = useData()
  const t = useToday()
  const cc = COURSE_CONTENT[c], info = COURSES[c]
  const tabs = subTabs(c, cc)
  const cur = (tabs.find(x => x[0] === sub) || tabs[0])[0]
  const nx = items.filter(i => i.c === c && !i.done && i.d && i.d >= t && i.k !== 'class').sort((a, b) => a.d!.localeCompare(b.d!))[0]
  const st = courseStats(grades, c)
  const segRef = useRef<HTMLDivElement>(null)
  useEffect(() => { segRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' }) }, [cur])
  return (
    <div className="page" style={{ ['--cc' as string]: info.color, ['--cs' as string]: info.soft }}>
      <div><a className="btn link" href="#/courses">← All courses</a></div>
      <header className="chead">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ color: 'var(--cc)' }}>{c}</div>
          <h1>{info.name}</h1>
        </div>
        <div className="facts">
          <span>Next: <b>{nx ? nx.t + ' · ' + fmt(parse(nx.d!), { month: 'short', day: 'numeric' }) + (() => { const n = daysBetween(t, nx.d!); return n === 0 ? ' (today)' : n === 1 ? ' (tomorrow)' : ' (in ' + n + ' days)' })() : 'nothing scheduled'}</b></span>
          <span>Grade so far: <b>{st.pct == null ? 'no marks yet' : (Math.round(st.pct * 10) / 10) + '% (' + (st.li! >= 0 ? LET[st.li!] : 'F') + ')'}</b></span>
        </div>
      </header>
      <div className="tip">{cc.focus}</div>
      {cc.sourceNote && <p className="note">{cc.sourceNote}</p>}
      <section className="card tint">
        <div className="row-between">
          <div><div className="h3">{s.timer && s.timer.c === c ? 'Focus session running on ' + c : 'Study timer'}</div><div className="note">This week on {c}: {hm(weekMinutes(s, c, t))}</div></div>
          <button type="button" className="btn sm" onClick={() => go('focus/' + courseSlug(c))}>{s.timer ? 'Open timer' : 'Focus on ' + c}</button>
        </div>
      </section>
      <nav className="seg" aria-label={c + ' study tools'} ref={segRef}>
        {tabs.map(([k, lab]) => <a key={k} className="chip" aria-pressed={cur === k} href={'#/courses/' + courseSlug(c) + '/' + k} style={{ textDecoration: 'none' }}>{lab}</a>)}
      </nav>
      <div className="stack" style={{ gap: 16 }} key={c + cur}>
        {cur === 'formulas' && <Formulas cc={cc} />}
        {cur === 'decks' && <DecksView c={c} />}
        {cur === 'adaptive' && <AdaptiveView c={c} />}
        {cur === 'flash' && <Flashcards c={c} />}
        {cur === 'assign' && <Assignment c={c} cc={cc} />}
        {cur === 'quiz' && <PracticeSet c={c} cc={cc} />}
        {cur === 'drills' && <Drills c={c} cc={cc} />}
        {cur === 'progress' && <Progress c={c} />}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- formulas + PDFs */
function openPdf(p: PdfRef, download: boolean) {
  const href = pdfs[p.file]
  if (!PDF_EMBEDDED) return // normal build uses plain links
  // single-file build: turn the embedded data URL into a blob URL (browsers block top-level data: PDFs)
  const b64 = href.split(',')[1], bin = atob(b64), arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }))
  const a = document.createElement('a'); a.href = url
  if (download) a.download = p.file; else a.target = '_blank'
  a.rel = 'noopener'; document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
function Formulas({ cc }: { cc: CourseContent }) {
  return (
    <>
      {(cc.pdfs || []).map(p => (
        <section className={'card' + (p.primary ? ' bold' : '')} key={p.file}>
          <div className="pdf-card">
            <div style={{ minWidth: 0, flex: '1 1 260px' }}><h3 className="h3">{p.title}</h3><div className="note">{p.desc}</div></div>
            <div className="wrap">
              {PDF_EMBEDDED ? <>
                <button type="button" className={'btn sm' + (p.primary ? ' berry' : ' ghost')} onClick={() => openPdf(p, false)}>Open PDF</button>
                <button type="button" className="btn sm ghost" onClick={() => openPdf(p, true)}>Download</button>
              </> : <>
                <a className={'btn sm' + (p.primary ? ' berry' : ' ghost')} href={pdfs[p.file]} target="_blank" rel="noopener">Open PDF</a>
                <a className="btn sm ghost" href={pdfs[p.file]} download={p.file}>Download</a>
              </>}
            </div>
          </div>
        </section>
      ))}
      {cc.calcTip && <div className="tip green">{cc.calcTip}</div>}
      <div className="fgrid">
        {cc.formulas.map(sec => (
          <section className="card" key={sec.h}>
            <h3 className="h3">{sec.h}</h3>
            <ul className="fl">
              {sec.items.map(([t, h]) => <li key={t}><b>{t}</b><div style={{ display: 'flex', flexDirection: 'column', gap: 5 }} dangerouslySetInnerHTML={{ __html: h }} /></li>)}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}

/* ---------------------------------------------------------------- flashcards */
function Flashcards({ c }: { c: string }) {
  const force = useForce()
  const cs = conceptsFor(c)
  if (!ui.fc || ui.fc.c !== c) ui.fc = { c, deck: cs.map(k => k.id).sort(() => Math.random() - 0.5), flipped: false, known: 0, total: cs.length }
  const fc = ui.fc
  if (!fc.deck.length) return (
    <section className="card bold">
      <h3 className="h3">Deck done</h3><p>You marked all {fc.total} cards as known.</p>
      <div><button type="button" className="btn sm" onClick={() => { ui.fc = null; force() }}>Shuffle and start over</button></div>
    </section>
  )
  const k = cs.find(x => x.id === fc.deck[0])!
  return (
    <section className="card bold">
      <div className="row-between"><div className="eyebrow">{fc.known} known · {fc.deck.length} left</div><div className="note">Tap the card to flip</div></div>
      <button type="button" className={'flash' + (fc.flipped ? ' back' : '')} aria-label={fc.flipped ? 'Card back, tap to flip' : 'Card front, tap to flip'} onClick={() => { fc.flipped = !fc.flipped; force() }}>
        {!fc.flipped ? <><span className="eyebrow">{k.section}</span><b>{k.name}</b><span className="note">Say it out loud, then tap to check.</span></> : <><b>{k.name}</b><span>{k.text}</span></>}
      </button>
      <div className="wrap">
        <button type="button" className="btn ghost sm" onClick={() => { fc.deck.push(fc.deck.shift()!); fc.flipped = false; force() }}>Review again</button>
        <button type="button" className="btn sm" onClick={() => { fc.deck.shift(); fc.known++; fc.flipped = false; emit('berry', { mood: 'cheering' }); force() }}>Got it</button>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- assignment coach */
function CheckRow({ id, label, ans, topic, c }: { id: string; label: string; ans: number; topic: string; c: string }) {
  const [v, setV] = useState('')
  const [res, setRes] = useState<{ ok: boolean; msg: string } | null>(null)
  const go = () => {
    const x = parseNum(v)
    if (isNaN(x)) { setRes({ ok: false, msg: 'Enter a number.' }); return }
    const ok = closeEnough(x, ans)
    const tries = (ui.checkTries[id] = (ui.checkTries[id] || 0) + 1)
    setRes({ ok, msg: ok ? 'Correct.' : (Math.sign(x) !== Math.sign(ans) && ans !== 0 && x !== 0 ? 'Check the sign.' : Math.abs(x - ans) / Math.max(1, Math.abs(ans)) < 0.03 ? 'Close. Check your rounding or a small step.' : 'Not yet. Recheck the method steps above.') })
    let g = 0
    update(d => {
      recordPractice(d, topic, 'Assignment 2 · ' + topic.replace('a2-', 'Q'), ok, c)
      g = answerXp(d, ok, 'Assignment check: ' + label, c, { firstTry: tries === 1, ref: 'check:' + id })
    })
    celebrateXp(g)
  }
  const inId = 'ck-' + id
  return (
    <div className={'chk' + (res ? (res.ok ? ' ok' : ' no') : '')}>
      <label htmlFor={inId}>{label}</label>
      <input className="input" id={inId} inputMode="decimal" autoComplete="off" value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') go() }} />
      <button type="button" className="btn sm" onClick={go}>Check</button>
      <div className={'res' + (res ? (res.ok ? ' ok' : ' no') : '')} aria-live="polite">{res?.msg}</div>
    </div>
  )
}
function WrittenBox({ id, prompt, initial }: { id: string; prompt: string; initial: string }) {
  const [v, setV] = useState(initial)
  const t = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(t.current), [])
  return (
    <div className="stack" style={{ gap: 6 }}>
      <textarea className="input" id={id} placeholder={prompt} aria-label={prompt} value={v} onChange={e => { const x = e.target.value; setV(x); clearTimeout(t.current); t.current = setTimeout(() => setWritten(id, x), 400) }} onBlur={() => { clearTimeout(t.current); if (v !== initial) setWritten(id, v) }} />
      <span className="note">Saved on this device as you type.</span>
    </div>
  )
}
function Assignment({ c, cc }: { c: string; cc: CourseContent }) {
  const { s } = useData()
  const A = cc.assignment!
  return (
    <>
      <p className="note">Each question shows what it's testing and the method, step by step. Enter your numbers to check them; the page says right or not yet, never the answer. Written parts save on this device so you can draft them here. Due {A.due}.</p>
      {A.qs.map(q => (
        <details className="card q" key={q.n}>
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
    </>
  )
}

/* ---------------------------------------------------------------- practice set (prof's questions) */
function PracticeSet({ c, cc }: { c: string; cc: CourseContent }) {
  const force = useForce()
  return (
    <>
      <p className="note">{cc.quizNote || ''}</p>
      {cc.practice!.map((pq, n) => {
        const st = ui.prac[pq.id] || (ui.prac[pq.id] = { tries: 0, done: false, picked: [] })
        const pick = (k: number) => {
          if (st.done || st.picked.includes(k)) return
          st.picked.push(k); st.tries++
          const ok = k === pq.a; if (ok || st.tries >= 2) st.done = true
          let g = 0
          update(d => {
            recordPractice(d, pq.id, (cc.quizLabel || 'Practice') + ' ' + (n + 1), ok && st.tries === 1, c)
            g = answerXp(d, ok, (cc.quizLabel || 'Practice') + ' ' + (n + 1), c, { firstTry: st.tries === 1 })
          })
          celebrateXp(g); if (!ok) emit('berry', { mood: 'worried' })
          force()
        }
        return (
          <section className="card" key={pq.id}>
            <h3 className="h3">Practice {n + 1}</h3>
            <p className="prob">{pq.stem}</p>
            <div className="mc">
              {pq.opts.map((o, k) => {
                const cls = st.picked.includes(k) ? (k === pq.a ? 'right' : 'wrong') : st.done && k === pq.a ? 'right' : ''
                return <button key={k} type="button" className={cls} disabled={st.done} onClick={() => pick(k)}><span className="opt-l">{letterOf(k)}</span><span>{o}</span></button>
              })}
            </div>
            {!st.done && st.tries > 0 && <div className="tip">Hint: {pq.hint}</div>}
            {st.done && (
              <div className="sol" aria-live="polite">
                <b>{st.picked[st.picked.length - 1] === pq.a && st.tries === 1 ? 'Correct first try.' : 'Solution'}</b>
                {pq.sol.map((l, k) => <div key={k}>{l}</div>)}
              </div>
            )}
            {!st.done && !st.tries && <HintButton hint={pq.hint} />}
          </section>
        )
      })}
      <div><button type="button" className="btn ghost sm" onClick={() => { for (const pq of cc.practice!) delete ui.prac[pq.id]; force() }}>Reset practice set</button></div>
    </>
  )
}
function HintButton({ hint }: { hint: string }) {
  const [show, setShow] = useState(false)
  return show ? <div className="tip">Hint: {hint}</div> : <div><button type="button" className="btn ghost sm" onClick={() => setShow(true)}>Show a hint</button></div>
}

/* ---------------------------------------------------------------- endless drills */
function Drills({ c, cc }: { c: string; cc: CourseContent }) {
  const { s } = useData()
  const force = useForce()
  const keys = cc.drills || []
  if (ui.drill && !keys.includes(ui.drill.k)) ui.drill = null
  const [v, setV] = useState('')
  const [err, setErr] = useState('')
  const inRef = useRef<HTMLInputElement>(null)
  const start = (k: string) => { ui.drill = { k, p: DRILLS[k].gen(), done: false }; setV(''); setErr(''); force(); setTimeout(() => inRef.current?.focus(), 0) }
  const d = ui.drill
  const check = () => {
    if (!d || d.done) return
    const x = parseNum(v); if (isNaN(x)) { setErr('Enter a number.'); return }
    setErr('')
    const ok = closeEnough(x, d.p.ans, d.p.tol); d.done = true; d.ok = ok; d.val = v
    let g = 0
    update(st => { recordPractice(st, 'drill-' + d.k, DRILLS[d.k].label, ok, c); g = answerXp(st, ok, 'Drill: ' + DRILLS[d.k].label, c) })
    celebrateXp(g); if (!ok) emit('berry', { mood: 'worried' })
    force()
  }
  return (
    <>
      <p className="note">Fresh numbers every time, so you can drill a question type until it's automatic. Answer to 2 decimals.</p>
      <div className="wrap" role="toolbar" aria-label="Drill types">
        {keys.map(k => { const p = s.practice['drill-' + k]; return <button key={k} type="button" className="chip" aria-pressed={!!d && d.k === k} onClick={() => start(k)}>{DRILLS[k].label}{p ? ` · ${p.correct}/${p.tries}` : ''}</button> })}
      </div>
      {!d ? <p className="empty">Pick a question type to start.</p> : (
        <section className="card bold" aria-label="Drill question">
          <h3 className="h3">{DRILLS[d.k].label}</h3>
          <p className="prob">{d.p.q}</p>
          <div className={'chk' + (d.done ? (d.ok ? ' ok' : ' no') : '')}>
            <label htmlFor="drill-in">Your answer</label>
            <input ref={inRef} className="input" id="drill-in" inputMode="decimal" autoComplete="off" value={d.done ? d.val : v} disabled={d.done} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') check() }} />
            <button type="button" className="btn sm" onClick={check} disabled={d.done}>Check</button>
            <div className={'res' + (d.done ? (d.ok ? ' ok' : ' no') : err ? ' no' : '')} aria-live="polite">{d.done ? (d.ok ? 'Correct.' : 'Not quite. The answer is ' + f2(d.p.ans, Math.abs(d.p.ans) > 1000 ? 0 : 2) + '.') : err}</div>
          </div>
          {d.done && <div className="sol"><b>Worked solution</b>{d.p.sol.map((l, k) => <div key={k}>{l}</div>)}</div>}
          <div><button type="button" className={'btn sm' + (d.done ? '' : ' ghost')} onClick={() => start(d.k)}>{d.done ? 'Next question' : 'Skip'}</button></div>
        </section>
      )}
    </>
  )
}

/* ---------------------------------------------------------------- progress */
function Progress({ c }: { c: string }) {
  const { s } = useData()
  const t = useToday()
  const mx = Math.max(60, ...COURSE_KEYS.map(k => weekMinutes(s, k, t)))
  const rows = Object.entries(s.practice).filter(([, p]) => p.c === c).sort((a, b) => a[1].correct / a[1].tries - b[1].correct / b[1].tries)
  const weak = rows.filter(([, p]) => p.tries >= 2 && p.correct / p.tries < 0.6).map(([, p]) => p.label)
  const col = (pct: number) => (pct >= 0.8 ? 'var(--good)' : pct >= 0.5 ? 'var(--due)' : 'var(--test)')
  return (
    <>
      <section className="card">
        <h3 className="h3">Study time this week</h3>
        {COURSE_KEYS.map(k => { const m = weekMinutes(s, k, t); return <div className="prow" key={k}><span>{k}</span><div className="bar thin"><span style={{ width: Math.round(m / mx * 100) + '%', background: COURSES[k].color }} /></div><span className="pct">{hm(m)}</span></div> })}
      </section>
      <MasteryCard c={c} title="Concept mastery from quizzes and decks, weakest first" />
      {!rows.length ? <p className="empty">Drill and practice-set results show up here as you answer.</p> : (
        <section className="card">
          <h3 className="h3">Accuracy by topic, weakest first</h3>
          {rows.map(([id, p]) => { const pct = p.tries ? p.correct / p.tries : 0; return <div className="prow" key={id}><span>{p.label}</span><div className="bar thin"><span style={{ width: Math.round(pct * 100) + '%', background: col(pct) }} /></div><span className="pct">{p.correct}/{p.tries}</span></div> })}
        </section>
      )}
      {weak.length > 0 && <div className="tip">Focus next: {weak.slice(0, 3).join(', ')}.</div>}
    </>
  )
}
