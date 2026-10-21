/* Practice: one surface for every kind of practice a course has — quiz-style questions, drills, flashcards,
   decks and the prof's practice sets. The mode starts on whatever the next test needs.
   Question logic, trap answers and deck marking are ported from the old Course Desk. */
import { useEffect, useState } from 'react'
import { Dumbbell, Layers, Shuffle, ListChecks, SquareStack, RotateCcw } from 'lucide-react'
import { useData, useToday } from '../lib/hooks'
import { buildQ, pickQTypes, DRILLS, f2, type BuiltQ } from '../data/drills'
import { COURSE_CONTENT } from '../data/content'
import { conceptsFor, slug, type Concept } from '../lib/concepts'
import { todayStr } from '../lib/dates'
import { update, getState } from '../store/store'
import { recordMastery, recordPractice, answerXp, setSetting } from '../store/actions'
import { grantXp, XP } from '../lib/game'
import { celebrateXp, catSays } from '../lib/events'
import { ui, type ConceptQ } from './courseState'
import { letterOf, useForce, closeEnough, parseNum } from './Courses'
import { Panel, I, ViewTabs, Empty, type Icon } from '../components/ui'
import type { AppState, Deck, DeckQ, DeckRun, Mastery } from '../store/types'

const col = (pct: number) => (pct >= 0.8 ? 'var(--primary)' : pct >= 0.5 ? 'var(--ochre)' : 'var(--strawberry)')

export function MasteryCard({ c, limit, title }: { c: string; limit?: number; title: string }) {
  const { s } = useData()
  const rows = Object.entries(s.mastery).filter(([, m]) => m.c === c && m.seen).sort((a, b) => a[1].correct / a[1].seen - b[1].correct / b[1].seen)
  return (
    <Panel title={title} id="mast">
      {!rows.length ? <Empty>No quiz results for this course yet.</Empty> : rows.slice(0, limit || rows.length).map(([id, m]) => {
        const pct = m.correct / m.seen
        return <div className="prow" key={id}><span>{m.concept}</span><span className="bar"><span style={{ width: Math.round(pct * 100) + '%', background: col(pct) }} /></span><span className="pct">{m.correct}/{m.seen}</span></div>
      })}
    </Panel>
  )
}

/* ---------------- practice surface ---------------- */
type Mode = 'quiz' | 'drills' | 'cards' | 'decks' | 'set'
export function PracticeSurface({ c, mode }: { c: string; mode?: string }) {
  const { s, items } = useData()
  const t = useToday()
  const cc = COURSE_CONTENT[c]
  const avail: { v: Mode; label: string; icon: Icon }[] = []
  if (cc) avail.push({ v: 'quiz', label: c === 'FNCE 445' ? 'Quiz-style questions' : 'Concept quiz', icon: ListChecks })
  if (cc?.drills?.length) avail.push({ v: 'drills', label: 'Drills', icon: Dumbbell })
  if (cc) avail.push({ v: 'cards', label: 'Flashcards', icon: Layers })
  if (Object.values(s.decks).some(d => d.c === c)) avail.push({ v: 'decks', label: 'Decks', icon: SquareStack })
  if (cc?.practice) avail.push({ v: 'set', label: 'Practice set', icon: Shuffle })

  // default: what the next test needs
  const nextTest = items.filter(i => i.c === c && i.k === 'test' && !i.done && i.d && i.d >= t).sort((a, b) => a.d!.localeCompare(b.d!))[0]
  const fallback: Mode = avail.some(a => a.v === 'decks') && nextTest ? 'decks' : avail[0]?.v || 'quiz'
  const [cur, setCur] = useState<Mode>(() => (avail.some(a => a.v === mode) ? (mode as Mode) : fallback))
  useEffect(() => { if (mode && avail.some(a => a.v === mode) && mode !== cur) setCur(mode as Mode) }, [mode])
  if (!avail.length) return <Panel icon={Dumbbell} title="Practice" id="prac"><Empty>No practice material for {c} yet. Send Claude the slides or a past quiz and this fills in with questions, drills and flashcards.</Empty></Panel>
  return (
    <>
      <Panel icon={Dumbbell} title="Practice" id="prac"
        tabs={<ViewTabs value={cur} onChange={setCur} options={avail} label="Practice modes" />}
        right={nextTest ? <span className="note">Aimed at {nextTest.t}</span> : undefined}>
        <p className="note">
          {cur === 'quiz' ? (c === 'FNCE 445' ? "Questions written like your prof's practice set: same wording and assumptions, with wrong answers built from the usual mistakes. You see the steps and why each wrong option is wrong." : 'Read the description, pick the concept it matches. Wrong options are neighbouring concepts, each explained.')
            : cur === 'drills' ? 'Fresh numbers every time, so you can drill a question type until it is automatic. Answer to 2 decimals.'
            : cur === 'cards' ? 'Say it out loud, then flip to check.'
            : cur === 'decks' ? 'Step 1 decks check what you know. Step 2 decks test whether you can apply it. Submit to see marks and an explanation for every question.'
            : "Your prof's practice questions, with a hint on a wrong pick and the full solution once you get it or after two tries."}
        </p>
      </Panel>
      {cur === 'quiz' && <QuizMode c={c} />}
      {cur === 'drills' && <DrillMode c={c} />}
      {cur === 'cards' && <CardMode c={c} />}
      {cur === 'decks' && <DecksView c={c} />}
      {cur === 'set' && <SetMode c={c} />}
    </>
  )
}

/* ---------------- concept quiz (no AI) ---------------- */
function masteryOf(mastery: Record<string, Mastery>, id: string) { const m = mastery[id]; return m && m.seen ? m.correct / m.seen : null }
function pickTargets(c: string, n: number, mastery: Record<string, Mastery>) {
  const cs = conceptsFor(c)
  const scored = cs.map(k => { const a = masteryOf(mastery, k.id), seen = (mastery[k.id] || {}).seen || 0; return { k, w: a == null ? 1 : Math.max(0.15, (1 - a) * 1.6 + (seen < 3 ? 0.3 : 0)) } })
  const total = scored.reduce((s, x) => s + x.w, 0), picks: Concept[] = []
  if (!Object.keys(mastery).some(id => id.startsWith(slug(c) + '--') && !id.includes('--deck-'))) {
    const sh = [...cs].sort(() => Math.random() - 0.5); for (let i = 0; i < n; i++) picks.push(sh[i % sh.length]); return picks
  }
  for (let i = 0; i < n; i++) { let r = Math.random() * total; for (const x of scored) { r -= x.w; if (r <= 0) { picks.push(x.k); break } } if (picks.length <= i) picks.push(scored[0].k) }
  return picks
}
const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n)) + ' …')
function mask(text: string, name: string) {
  const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let out = text.replace(new RegExp(esc(name), 'gi'), '____')
  for (const w of name.replace(/\(.*?\)/g, '').split(/[^A-Za-z0-9’']+/).filter(w => w.length > 3)) out = out.replace(new RegExp('\\b' + esc(w) + '\\b', 'gi'), '____')
  return out
}
function buildConceptQ(c: string, k: Concept): ConceptQ {
  const cs = conceptsFor(c).filter(x => x.id !== k.id)
  const same = cs.filter(x => x.section === k.section).sort(() => Math.random() - 0.5)
  const other = cs.filter(x => x.section !== k.section).sort(() => Math.random() - 0.5)
  const opts = [{ t: k.name, why: null as string | null, ok: true }, ...[...same, ...other].slice(0, 3).map(d => ({ t: d.name, why: 'is about: ' + clip(d.text, 120), ok: false }))].sort(() => Math.random() - 0.5)
  return { stem: 'Which concept does this describe? “' + clip(mask(k.text, k.name), 340) + '”', options: opts.map(o => o.t), answer: opts.findIndex(o => o.ok), whys: opts.map(o => o.why), explain: k.name + ' (' + k.section + '): ' + clip(k.text, 260), cid: k.id, cname: k.name, picked: null }
}
function startRound(c: string) {
  const s = getState()
  const round = (ui.aq && ui.aq.c === c ? ui.aq.round || 0 : 0) + 1
  const qs = c === 'FNCE 445'
    ? pickQTypes(10, s.settings.ch5only, s.mastery).map(buildQ).filter((x): x is BuiltQ => !!x)
    : pickTargets(c, 10, s.mastery).map(k => buildConceptQ(c, k))
  ui.aq = { c, state: 'quiz', qs, round, focusWeak: true }
}
function finishRound() {
  const aq = ui.aq!; const per: Record<string, { name: string; seen: number; correct: number }> = {}
  for (const q of aq.qs) { const p = per[q.cid] || (per[q.cid] = { name: q.cname, seen: 0, correct: 0 }); p.seen++; if (q.picked === q.answer) p.correct++ }
  aq.results = per; aq.state = 'done'
  const right = aq.qs.filter(q => q.picked === q.answer).length
  let g = 0
  update(d => {
    for (const [id, p] of Object.entries(per)) recordMastery(d, id, aq.c, p.name, p.seen, p.correct)
    if (right === aq.qs.length) g = grantXp(d, XP.cleanRound, 'Clean round: ' + aq.c, { c: aq.c })
  })
  if (g) celebrateXp(g, 'levelup')
}

function QuizMode({ c }: { c: string }) {
  const { s } = useData()
  const force = useForce()
  const is445 = c === 'FNCE 445'
  const aq = ui.aq && ui.aq.c === c ? ui.aq : null
  const has = Object.values(s.mastery).some(m => m.c === c && m.seen)
  const begin = () => { startRound(c); force(); setTimeout(() => document.getElementById('round')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30) }
  if (!conceptsFor(c).length && !is445) return <Empty>No concepts to quiz from yet.</Empty>
  if (!aq) return (
    <Panel title="Ready when you are" id="start">
      {is445 && (
        <div className="wrap" role="radiogroup" aria-label="Question mix">
          <button type="button" className="chip" aria-checked={!s.settings.ch5only} role="radio" onClick={() => setSetting('ch5only', false)}>Quiz 2 mix</button>
          <button type="button" className="chip" aria-checked={s.settings.ch5only} role="radio" onClick={() => setSetting('ch5only', true)}>Chapter 5 only</button>
        </div>
      )}
      <div><button type="button" className="btn" onClick={begin}>{has ? 'Start a round on my weak spots' : 'Start round 1'}</button></div>
    </Panel>
  )
  const answered = aq.qs.filter(q => q.picked != null).length, right = aq.qs.filter(q => q.picked === q.answer).length
  const pick = (q: BuiltQ | ConceptQ, k: number) => {
    if (q.picked != null) return
    q.picked = k
    const ok = k === q.answer
    let g = 0
    update(d => { g = answerXp(d, ok, (is445 ? 'Quiz-style: ' : 'Concept quiz: ') + q.cname, c) })
    celebrateXp(g); if (!ok) catSays('wrong')
    if (aq.qs.every(x => x.picked != null)) finishRound()
    force()
  }
  const open = aq.state === 'quiz' && answered < aq.qs.length
  return (
    <div data-quiz-active={open ? 'true' : 'false'}>
      <Panel title={`Round ${aq.round} · ${answered}/${aq.qs.length} answered · ${right} correct`} id="round"
        right={<button type="button" className="btn quiet sm" onClick={() => { ui.aq = null; force() }}>End round</button>} />
      {aq.state === 'done' && aq.results && (() => {
        const rows = Object.values(aq.results).sort((a, b) => a.correct / a.seen - b.correct / b.seen)
        const weak = rows.filter(p => p.correct < p.seen).map(p => p.name)
        return (
          <Panel title={`You scored ${right} of ${aq.qs.length}`} id="score">
            {rows.map(p => { const pct = p.correct / p.seen; return <div className="prow" key={p.name}><span>{p.name}</span><span className="bar"><span style={{ width: Math.round(pct * 100) + '%', background: col(pct) }} /></span><span className="pct">{p.correct}/{p.seen}</span></div> })}
            <p className="note">{weak.length ? 'Next round leans on: ' + weak.slice(0, 4).join(', ') + '.' : 'Clean round. The next one mixes in what you have seen least.'}</p>
            <div><button type="button" className="btn" onClick={begin}><I as={RotateCcw} size={15} />Next round</button></div>
          </Panel>
        )
      })()}
      {aq.qs.map((q, i) => (
        <section className="sheet" key={i} data-q={i}>
          <div className="qno"><span>Question {i + 1}</span><span>{q.cname}</span></div>
          <p className="prob">{q.stem}</p>
          <div className="mc">
            {q.options.map((o, k) => {
              const cls = q.picked != null ? (k === q.answer ? 'right' : k === q.picked ? 'wrong' : '') : ''
              return <button key={k} type="button" className={cls} disabled={q.picked != null} onClick={() => pick(q, k)}><span className="opt-l">{letterOf(k)}</span><span>{o}</span></button>
            })}
          </div>
          {q.picked != null && (
            <div className="stack" aria-live="polite">
              <span className={'verdict ' + (q.picked === q.answer ? 'ok' : 'no')}>{q.picked === q.answer ? 'Correct.' : 'Not quite.'}</span>
              <div className="steps-box">
                <span className="lbl">Steps</span>
                {'steps' in q && q.steps ? q.steps.map((l, k) => <div key={k}>{l}</div>) : <div>{(q as ConceptQ).explain}</div>}
              </div>
              {(() => {
                const tr = q.whys.map((w, k) => (w ? [letterOf(k), w] : null)).filter(Boolean) as string[][]
                return tr.length ? <div className="traps"><span className="lbl">Why the other answers are wrong</span><ul>{tr.map(([l, w]) => <li key={l}><b>{l}</b><span>{w}</span></li>)}</ul></div> : null
              })()}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

/* ---------------- drills ---------------- */
function DrillMode({ c }: { c: string }) {
  const { s } = useData()
  const force = useForce()
  const keys = COURSE_CONTENT[c]?.drills || []
  if (ui.drill && !keys.includes(ui.drill.k)) ui.drill = null
  const [v, setV] = useState('')
  const [err, setErr] = useState('')
  const d = ui.drill
  const start = (k: string) => { ui.drill = { k, p: DRILLS[k].gen(), done: false }; setV(''); setErr(''); force(); setTimeout(() => document.getElementById('drill-in')?.focus(), 0) }
  const check = () => {
    if (!d || d.done) return
    const x = parseNum(v); if (isNaN(x)) { setErr('Enter a number.'); return }
    setErr('')
    const ok = closeEnough(x, d.p.ans, d.p.tol); d.done = true; d.ok = ok; d.val = v
    let g = 0
    update(st => { recordPractice(st, 'drill-' + d.k, DRILLS[d.k].label, ok, c); g = answerXp(st, ok, 'Drill: ' + DRILLS[d.k].label, c) })
    celebrateXp(g); if (!ok) catSays('wrong')
    force()
  }
  return (
    <>
      <div className="wrap" role="toolbar" aria-label="Drill types">
        {keys.map(k => { const p = s.practice['drill-' + k]; return <button key={k} type="button" className="chip" aria-pressed={!!d && d.k === k} onClick={() => start(k)}>{DRILLS[k].label}{p ? ` · ${p.correct}/${p.tries}` : ''}</button> })}
      </div>
      {!d ? <Empty>Pick a question type to start.</Empty> : (
        <section className="sheet" data-quiz-active={d.done ? 'false' : 'true'}>
          <div className="qno"><span>{DRILLS[d.k].label}</span></div>
          <p className="prob">{d.p.q}</p>
          <div className={'chk' + (d.done ? (d.ok ? ' ok' : ' no') : '')}>
            <label htmlFor="drill-in">Your answer</label>
            <input className="input" id="drill-in" inputMode="decimal" autoComplete="off" value={d.done ? d.val : v} disabled={d.done} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') check() }} />
            <button type="button" className="btn quiet sm" onClick={check} disabled={d.done}>Check</button>
            <div className={'res' + (d.done ? (d.ok ? ' ok' : ' no') : err ? ' no' : '')} aria-live="polite">{d.done ? (d.ok ? 'Correct.' : 'Not quite. The answer is ' + f2(d.p.ans, Math.abs(d.p.ans) > 1000 ? 0 : 2) + '.') : err}</div>
          </div>
          {d.done && <div className="steps-box"><span className="lbl">Worked solution</span>{d.p.sol.map((l, k) => <div key={k}>{l}</div>)}</div>}
          <div><button type="button" className={'btn' + (d.done ? '' : ' quiet')} onClick={() => start(d.k)}>{d.done ? 'Next question' : 'Skip'}</button></div>
        </section>
      )}
    </>
  )
}

/* ---------------- flashcards ---------------- */
function CardMode({ c }: { c: string }) {
  const force = useForce()
  const cs = conceptsFor(c)
  if (!cs.length) return <Empty>No concepts to make cards from yet.</Empty>
  if (!ui.fc || ui.fc.c !== c) ui.fc = { c, deck: cs.map(k => k.id).sort(() => Math.random() - 0.5), flipped: false, known: 0, total: cs.length }
  const fc = ui.fc
  if (!fc.deck.length) return (
    <Panel title="Deck done" id="cards"><p>You marked all {fc.total} cards as known.</p>
      <div><button type="button" className="btn" onClick={() => { ui.fc = null; force() }}><I as={RotateCcw} size={15} />Shuffle and start over</button></div></Panel>
  )
  const k = cs.find(x => x.id === fc.deck[0])!
  return (
    <Panel title={`${fc.known} known · ${fc.deck.length} left`} id="cards">
      <button type="button" className={'flash' + (fc.flipped ? ' back' : '')} aria-label={fc.flipped ? 'Card back, tap to flip' : 'Card front, tap to flip'} onClick={() => { fc.flipped = !fc.flipped; force() }}>
        {!fc.flipped ? <><span className="eyebrow">{k.section}</span><b>{k.name}</b><span className="note">Say it out loud, then tap to check.</span></> : <><b>{k.name}</b><span>{k.text}</span></>}
      </button>
      <div className="wrap">
        <button type="button" className="btn quiet" onClick={() => { fc.deck.push(fc.deck.shift()!); fc.flipped = false; force() }}>Review again</button>
        <button type="button" className="btn" onClick={() => { fc.deck.shift(); fc.known++; fc.flipped = false; catSays('correct'); force() }}>Got it</button>
      </div>
    </Panel>
  )
}

/* ---------------- the prof's practice set ---------------- */
function SetMode({ c }: { c: string }) {
  const force = useForce()
  const cc = COURSE_CONTENT[c]
  const open = cc.practice!.some(pq => !(ui.prac[pq.id]?.done))
  return (
    <div data-quiz-active={open ? 'true' : 'false'}>
      {cc.practice!.map((pq, n) => {
        const st = ui.prac[pq.id] || (ui.prac[pq.id] = { tries: 0, done: false, picked: [] })
        const pick = (k: number) => {
          if (st.done || st.picked.includes(k)) return
          st.picked.push(k); st.tries++
          const ok = k === pq.a; if (ok || st.tries >= 2) st.done = true
          let g = 0
          update(d => { recordPractice(d, pq.id, (cc.quizLabel || 'Practice') + ' ' + (n + 1), ok && st.tries === 1, c); g = answerXp(d, ok, (cc.quizLabel || 'Practice') + ' ' + (n + 1), c, { firstTry: st.tries === 1 }) })
          celebrateXp(g); if (!ok) catSays('wrong')
          force()
        }
        return (
          <section className="sheet" key={pq.id}>
            <div className="qno"><span>Practice {n + 1}</span></div>
            <p className="prob">{pq.stem}</p>
            <div className="mc">
              {pq.opts.map((o, k) => {
                const cls = st.picked.includes(k) ? (k === pq.a ? 'right' : 'wrong') : st.done && k === pq.a ? 'right' : ''
                return <button key={k} type="button" className={cls} disabled={st.done} onClick={() => pick(k)}><span className="opt-l">{letterOf(k)}</span><span>{o}</span></button>
              })}
            </div>
            {!st.done && st.tries > 0 && <div className="tip">Hint: {pq.hint}</div>}
            {st.done && (
              <div className="stack">
                <span className={'verdict ' + (st.picked[st.picked.length - 1] === pq.a ? 'ok' : 'no')}>{st.picked[st.picked.length - 1] === pq.a && st.tries === 1 ? 'Correct, first try.' : st.picked[st.picked.length - 1] === pq.a ? 'Correct.' : 'Not quite.'}</span>
                <div className="steps-box"><span className="lbl">Steps</span>{pq.sol.map((l, k) => <div key={k}>{l}</div>)}</div>
              </div>
            )}
            {!st.done && !st.tries && <HintButton hint={pq.hint} />}
          </section>
        )
      })}
      <div><button type="button" className="btn quiet sm" onClick={() => { for (const pq of cc.practice!) delete ui.prac[pq.id]; force() }}><I as={RotateCcw} size={15} />Reset practice set</button></div>
    </div>
  )
}
function HintButton({ hint }: { hint: string }) {
  const [show, setShow] = useState(false)
  return show ? <div className="tip">Hint: {hint}</div> : <div><button type="button" className="btn quiet sm" onClick={() => setShow(true)}>Show a hint</button></div>
}

/* ---------------- decks ---------------- */
const deckPts = (q: DeckQ) => (q.type === 'written' ? 2 : 1)
function runsFor(s: AppState, id: string) { return Object.entries(s.deckruns).filter(([, r]) => r.deck === id).map(([rid, r]) => ({ id: rid, ...r })).sort((a, b) => (a.attempt || 0) - (b.attempt || 0)) }
function latestRun(s: AppState, id: string) { const r = runsFor(s, id); return r[r.length - 1] || null }
function metaFor(s: AppState, c: string) { return Object.values(s.deckmeta).find(m => m.c === c) || null }
function topicName(s: AppState, c: string, t: string) { const m = metaFor(s, c), x = m && (m.topics || []).find(y => y.id === t); return x ? x.name : t }
function isAnswered(q: DeckQ, r: DeckRun) { const a = (r.answers || {})[q.id]; return !!a && (q.type === 'written' ? !!String(a.text || '').trim() : Number.isInteger(a.pick)) }
function shuffled(n: number) { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }
const scoreText = (r: DeckRun) => (r.max ? `${r.pts}/${r.max} (${Math.round((r.pts || 0) / r.max * 100)}%)` : '')

function startDeckRun(did: string) {
  const s = getState(), d = s.decks[did], prev = latestRun(s, did), attempt = (prev ? prev.attempt || 0 : 0) + 1, id = did + '--' + attempt, perm: Record<string, number[]> = {}
  for (const q of d.qs) if (q.type !== 'written') perm[q.id] = shuffled(q.opts.length)
  update(x => { x.deckruns[id] = { deck: did, c: d.c, attempt, status: 'open', started: new Date().toISOString(), answers: {}, perm } })
  ui.openDeck = { deck: did, run: id }
}
function score(d: Deck, r: DeckRun) {
  const ws = d.qs.filter(q => q.type === 'written'); r.results = r.results || {}
  for (const q of ws) { const t = String(((r.answers || {})[q.id] || {}).text || '').trim(); if (!t && !r.results[q.id]) r.results[q.id] = { v: 'missed', fb: 'No answer given.' } }
  let pts = 0, max = 0
  for (const q of d.qs) { max += deckPts(q); const x = r.results[q.id]; if (x) pts += x.v === 'correct' ? deckPts(q) : x.v === 'partial' ? 1 : 0 }
  r.pts = pts; r.max = max; r.status = ws.every(q => r.results![q.id]) ? 'graded' : 'submitted'
}
function deckMastery(x: AppState, d: Deck, r: DeckRun) {
  if (r.masteryDone) return
  for (const q of d.qs) {
    const res = (r.results || {})[q.id]; if (!res) continue
    const id = slug(d.c) + '--deck-' + q.topic, cur = x.mastery[id] || { c: d.c, concept: topicName(x, d.c, q.topic), seen: 0, correct: 0 }
    x.mastery[id] = { c: d.c, concept: topicName(x, d.c, q.topic), seen: (cur.seen || 0) + 1, correct: (cur.correct || 0) + (res.v === 'correct' ? 1 : 0), last: todayStr() }
  }
  if (r.status === 'graded') r.masteryDone = true
}
function submitDeck(did: string, rid: string) {
  let g = 0
  update(x => {
    const d = x.decks[did], r = x.deckruns[rid]; r.results = {}
    for (const q of d.qs) if (q.type !== 'written') { const a = (r.answers || {})[q.id]; r.results[q.id] = { v: a && a.pick === q.a ? 'correct' : 'missed' } }
    r.submittedAt = new Date().toISOString(); r.submitted = todayStr()
    score(d, r); deckMastery(x, d, r)
    const mcq = d.qs.filter(q => q.type !== 'written'), ok = mcq.filter(q => r.results![q.id].v === 'correct').length
    if (ok) g += grantXp(x, ok * XP.correct, `Deck: ${d.title} (${ok} correct)`, { c: d.c, ref: 'deckrun:' + rid })
    if (ok === mcq.length && mcq.length) g += grantXp(x, XP.cleanRound, 'Clean deck: ' + d.title, { c: d.c, ref: 'deckclean:' + rid })
  })
  celebrateXp(g, 'levelup')
}
function selfMark(did: string, rid: string, qid: string, v: 'correct' | 'partial' | 'missed') {
  update(x => { const d = x.decks[did], r = x.deckruns[rid]; r.results = r.results || {}; r.results[qid] = { v, fb: 'Marked by you against the key points.' }; score(d, r); if (r.status === 'graded') deckMastery(x, d, r) })
}

function CoverageCard({ c }: { c: string }) {
  const { s } = useData()
  const m = metaFor(s, c)
  if (!m) return null
  const st: Record<string, { seen: number; ok: number; last: string | null }> = {}
  for (const r of Object.values(s.deckruns).sort((a, b) => String(a.submittedAt || '').localeCompare(String(b.submittedAt || '')))) {
    if (r.c !== c || !r.results) continue; const d = s.decks[r.deck]; if (!d) continue
    for (const q of d.qs) { const x = r.results[q.id]; if (!x) continue; const key = q.topic + '|' + (q.lvl || 'c'), e = st[key] || (st[key] = { seen: 0, ok: 0, last: null }); e.seen++; if (x.v === 'correct') e.ok++; e.last = x.v }
  }
  const topics = m.topics || [], cls = (e?: { last: string | null }) => (e ? (e.last === 'correct' ? 'ok' : e.last === 'partial' ? 'part' : 'no') : undefined)
  const good = (t: { id: string }, l: string) => st[t.id + '|' + l] && st[t.id + '|' + l].last === 'correct'
  const both = topics.filter(t => good(t, 'k') && good(t, 'c')).length, kn = topics.filter(t => good(t, 'k')).length
  const tip = (l: string, e?: { seen: number; ok: number; last: string | null }) => l + ': ' + (e ? `${e.ok} of ${e.seen} right, latest ${e.last}` : 'not tested yet')
  return (
    <Panel title={m.title} id="cov">
      <p className="note">Two dots per topic: knowledge (definitions and facts), then comprehension (applying it). Grey = not tested, red = missed, amber = partly right, green = right on your latest try. Knowledge green: {kn} of {topics.length} · both green: {both} of {topics.length}.</p>
      {[...new Set(topics.map(t => t.lec))].map(lec => (
        <div key={lec} className="stack" style={{ gap: 4 }}>
          <div className="eyebrow">{lec}</div>
          <div className="cov">{topics.filter(x => x.lec === lec).map(t => { const sk = st[t.id + '|k'], sc = st[t.id + '|c']; return <span key={t.id} title={tip('Knowledge', sk) + ' · ' + tip('Comprehension', sc)}><i className={cls(sk)} /><i className={cls(sc)} /><span>{t.name}</span></span> })}</div>
        </div>
      ))}
    </Panel>
  )
}

export function DecksView({ c }: { c: string }) {
  const { s } = useData()
  const force = useForce()
  const od = ui.openDeck
  if (od && s.decks[od.deck] && s.deckruns[od.run]) return <DeckRunView did={od.deck} rid={od.run} back={() => { ui.openDeck = null; force() }} />
  ui.openDeck = null
  const list = Object.entries(s.decks).filter(([, d]) => d.c === c).sort((a, b) => (a[1].n || 0) - (b[1].n || 0))
  let stage: string | null = null
  return (
    <>
      <Panel title="Your decks" id="decks">
        {!list.length ? <Empty>No decks for {c} yet.</Empty> : list.map(([id, d]) => {
          const r = latestRun(s, id)
          const head = d.stage && d.stage !== stage ? (stage = d.stage) : null
          return (
            <div key={id}>
              {head && <div className="eyebrow" style={{ marginTop: 8 }}>{head}</div>}
              <div className="deckrow">
                <div>
                  <b>{d.title}</b><span className="note">{d.covers || ''}</span>
                  {r && r.status !== 'open' && <span className="note">Attempt {r.attempt}: {scoreText(r)}{r.status === 'submitted' ? ' · written answers not marked yet' : ''}</span>}
                  {r && r.status === 'open' && <span className="note">Attempt {r.attempt} in progress · {d.qs.filter(q => isAnswered(q, r)).length} of {d.qs.length} answered</span>}
                </div>
                <div className="wrap">
                  <button type="button" className={'btn sm' + (!r || r.status === 'open' ? '' : ' quiet')} onClick={() => { if (!r) { startDeckRun(id); force() } else { ui.openDeck = { deck: id, run: r.id }; force(); window.scrollTo({ top: 0, behavior: 'smooth' }) } }}>{!r ? 'Start' : r.status === 'open' ? 'Continue' : 'See results'}</button>
                  {r && r.status !== 'open' && <button type="button" className="btn quiet sm" onClick={() => { startDeckRun(id); force() }}>Retake</button>}
                </div>
              </div>
            </div>
          )
        })}
      </Panel>
      <CoverageCard c={c} />
    </>
  )
}

function DeckRunView({ did, rid, back }: { did: string; rid: string; back: () => void }) {
  const { s } = useData()
  const force = useForce()
  const d = s.decks[did], r = s.deckruns[rid], open = r.status === 'open', n = d.qs.length
  const k = d.qs.filter(q => isAnswered(q, r)).length
  const res = r.results || {}
  const setAns = (qid: string, a: { pick?: number; text?: string }) => update(x => { const rr = x.deckruns[rid]; rr.answers = rr.answers || {}; rr.answers[qid] = a })
  const mcq = d.qs.filter(q => q.type !== 'written'), wq = d.qs.filter(q => q.type === 'written'), miss = d.qs.filter(q => res[q.id] && res[q.id].v !== 'correct')
  const [sure, setSure] = useState(false)
  return (
    <div data-quiz-active={open ? 'true' : 'false'}>
      <div><button type="button" className="btn quiet sm" onClick={back}>← All decks</button></div>
      <Panel title={d.title} id="deck" right={<span className="note">Attempt {r.attempt}{open ? ` · ${k} of ${n} answered` : ''}</span>}>
        <p className="note">{d.covers || ''}</p>
        {!open && (
          <>
            <b>You scored {scoreText(r)}</b>
            <p className="note">Multiple choice: {mcq.filter(q => res[q.id] && res[q.id].v === 'correct').length} of {mcq.length} right.{wq.length ? ` Written: ${wq.filter(q => res[q.id] && res[q.id].v === 'correct').length} full, ${wq.filter(q => res[q.id] && res[q.id].v === 'partial').length} partial, out of ${wq.length}.` : ''}</p>
            {miss.length > 0 && <><span className="lbl">To work on</span><ul className="keylist">{miss.map(q => <li key={q.id}>Q{d.qs.indexOf(q) + 1} · {topicName(s, d.c, q.topic)}</li>)}</ul></>}
            <div><button type="button" className="btn" onClick={() => { startDeckRun(did); force(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><I as={RotateCcw} size={15} />Retake this deck</button></div>
          </>
        )}
      </Panel>
      {d.qs.map((q, i) => {
        const a = (r.answers || {})[q.id] || {}, rs = res[q.id]
        const order = (r.perm && r.perm[q.id]) || q.opts.map((_, j) => j)
        return (
          <section className="sheet" key={q.id}>
            <div className="qno"><span>Question {i + 1}</span><span>{q.type === 'written' ? 'Written' : 'Multiple choice'}</span><span>{topicName(s, d.c, q.topic)}</span></div>
            <p className="prob">{q.stem}</p>
            {q.type === 'written' ? (
              <textarea className="input" placeholder="Write your answer in full sentences, as you would on the midterm." aria-label={'Answer to question ' + (i + 1)} defaultValue={a.text || ''} disabled={!open} onChange={e => setAns(q.id, { text: e.target.value })} />
            ) : (
              <div className="mc">
                {order.map((kk, pos) => {
                  const cls = open ? (a.pick === kk ? 'sel' : '') : kk === q.a ? 'right' : kk === a.pick ? 'wrong' : ''
                  return <button key={kk} type="button" className={cls} disabled={!open} aria-pressed={open ? a.pick === kk : undefined} onClick={() => setAns(q.id, { pick: kk })}><span className="opt-l">{letterOf(pos)}</span><span>{q.opts[kk]}</span></button>
                })}
              </div>
            )}
            {!open && (rs || q.type === 'written') && (
              <div className="stack">
                {rs && <span className={'vd ' + (rs.v === 'correct' ? 'ok' : rs.v === 'partial' ? 'part' : 'no')}>{rs.v === 'correct' ? 'Correct' : rs.v === 'partial' ? 'Partly right · 1 of 2' : q.type === 'written' ? 'Missed · 0 of 2' : 'Wrong'}</span>}
                {rs?.fb && <div>{rs.fb}</div>}
                {q.type === 'written' ? (
                  <div className="steps-box">
                    <span className="lbl">What a full answer includes</span>
                    <ul className="keylist">{(q.key || []).map((x, j) => <li key={j}>{x}</li>)}</ul>
                    {!rs && <div className="wrap"><span className="note">Mark it yourself:</span>
                      <button type="button" className="btn sm" onClick={() => selfMark(did, rid, q.id, 'correct')}>Full marks</button>
                      <button type="button" className="btn quiet sm" onClick={() => selfMark(did, rid, q.id, 'partial')}>Partly</button>
                      <button type="button" className="btn quiet sm" onClick={() => selfMark(did, rid, q.id, 'missed')}>Missed</button></div>}
                  </div>
                ) : <div className="steps-box"><span className="lbl">Why</span><div>{q.explain || ''}</div></div>}
              </div>
            )}
          </section>
        )
      })}
      {open && (
        <Panel title="Done?" id="submit">
          <p className="note">Submit to see your marks and an explanation for every question.</p>
          <div><button type="button" className="btn" onClick={() => { if (n - k > 0 && !sure) { setSure(true); return } setSure(false); submitDeck(did, rid); force(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Submit deck</button></div>
          {sure && n - k > 0 && <p className="note" role="alert">{n - k} question{n - k > 1 ? 's are' : ' is'} still blank and will count as wrong. Tap Submit again to hand it in anyway.</p>}
        </Panel>
      )}
    </div>
  )
}
