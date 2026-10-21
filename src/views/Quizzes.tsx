import { useState } from 'react'
/* Quiz-style practice (FNCE 445 bank with trap answers), the no-AI concept quiz for the other courses,
   mastery cards, and FNCE 477 quiz decks (runs, submit, debrief). Logic ported from course-desk.html. */
import { useData } from '../lib/hooks'
import { buildQ, pickQTypes, type BuiltQ } from '../data/drills'
import { conceptsFor, slug, type Concept } from '../lib/concepts'
import { todayStr } from '../lib/dates'
import { update, getState } from '../store/store'
import { recordMastery, answerXp, setSetting } from '../store/actions'
import { grantXp, XP } from '../lib/game'
import { celebrateXp, emit } from '../lib/events'
import { ui, type ConceptQ } from './courseState'
import { letterOf, useForce } from './Courses'
import type { AppState, Deck, DeckQ, DeckRun, Mastery } from '../store/types'

const col = (pct: number) => (pct >= 0.8 ? 'var(--good)' : pct >= 0.5 ? 'var(--due)' : 'var(--test)')

export function MasteryCard({ c, limit, title }: { c: string; limit?: number; title: string }) {
  const { s } = useData()
  const rows = Object.entries(s.mastery).filter(([, m]) => m.c === c && m.seen).sort((a, b) => a[1].correct / a[1].seen - b[1].correct / b[1].seen)
  return (
    <section className="card">
      <h3 className="h3">{title}</h3>
      {!rows.length ? <p className="note">No quiz results yet.</p> : rows.slice(0, limit || rows.length).map(([id, m]) => {
        const pct = m.correct / m.seen
        return <div className="prow" key={id}><span>{m.concept}</span><div className="bar thin"><span style={{ width: Math.round(pct * 100) + '%', background: col(pct) }} /></div><span className="pct">{m.correct}/{m.seen}</span></div>
      })}
    </section>
  )
}

/* ---------- concept quiz without AI: multiple choice built from the course's own concepts ---------- */
function masteryOf(mastery: Record<string, Mastery>, id: string) { const m = mastery[id]; return m && m.seen ? m.correct / m.seen : null }
/** pickTargets() from the old app: weighted towards weak and rarely seen concepts. */
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
  let out = text
  const words = name.replace(/\(.*?\)/g, '').split(/[^A-Za-z0-9’']+/).filter(w => w.length > 3)
  const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  out = out.replace(new RegExp(esc(name), 'gi'), '____')
  for (const w of words) out = out.replace(new RegExp('\\b' + esc(w) + '\\b', 'gi'), '____')
  return out
}
function buildConceptQ(c: string, k: Concept): ConceptQ {
  const cs = conceptsFor(c).filter(x => x.id !== k.id)
  const same = cs.filter(x => x.section === k.section).sort(() => Math.random() - 0.5)
  const other = cs.filter(x => x.section !== k.section).sort(() => Math.random() - 0.5)
  const distract = [...same, ...other].slice(0, 3)
  const opts = [{ t: k.name, why: null as string | null, ok: true }, ...distract.map(d => ({ t: d.name, why: 'is about: ' + clip(d.text, 120), ok: false }))].sort(() => Math.random() - 0.5)
  return {
    stem: 'Which concept does this describe? “' + clip(mask(k.text, k.name), 340) + '”',
    options: opts.map(o => o.t), answer: opts.findIndex(o => o.ok), whys: opts.map(o => o.why),
    explain: k.name + ' (' + k.section + '): ' + clip(k.text, 260), cid: k.id, cname: k.name, picked: null,
  }
}

function startAdaptive(c: string, focusWeak: boolean) {
  const s = getState()
  const round = (ui.aq && ui.aq.c === c ? ui.aq.round || 0 : 0) + 1
  const qs = c === 'FNCE 445'
    ? pickQTypes(10, s.settings.ch5only, s.mastery).map(buildQ).filter((x): x is BuiltQ => !!x)
    : pickTargets(c, 10, s.mastery).map(k => buildConceptQ(c, k))
  ui.aq = { c, state: 'quiz', qs, round, focusWeak }
}
function finishAdaptive() {
  const aq = ui.aq!; const per: Record<string, { name: string; seen: number; correct: number }> = {}
  for (const q of aq.qs) { const p = per[q.cid] || (per[q.cid] = { name: q.cname, seen: 0, correct: 0 }); p.seen++; if (q.picked === q.answer) p.correct++ }
  aq.results = per; aq.state = 'done'
  const right = aq.qs.filter(q => q.picked === q.answer).length
  let g = 0
  update(d => {
    for (const [id, p] of Object.entries(per)) recordMastery(d, id, aq.c, p.name, p.seen, p.correct)
    if (right === aq.qs.length) g = grantXp(d, XP.cleanRound, 'Clean round: ' + aq.c + ' round ' + aq.round, { c: aq.c })
  })
  if (g) celebrateXp(g, 'proud')
}

export function AdaptiveView({ c }: { c: string }) {
  const { s } = useData()
  const force = useForce()
  const is445 = c === 'FNCE 445'
  const aq = ui.aq && ui.aq.c === c ? ui.aq : null
  const has = Object.values(s.mastery).some(m => m.c === c && m.seen)
  const begin = (weak: boolean) => { startAdaptive(c, weak); force(); setTimeout(() => document.getElementById('aq-head')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30) }
  if (!aq) return (
    <>
      <section className="card bold">
        <h3 className="h3">{is445 ? 'Quiz 2 style practice' : 'Concept quiz'}</h3>
        <p>{is445 ? '10 questions written exactly like your prof\'s practice set and Assignment 2: same wording, same assumptions, and wrong answers built from the same mistakes. About 70% Chapter 5. After each answer you see the steps and why each wrong option is wrong. Question types you miss come back more often.'
          : '10 multiple-choice questions built from this course\'s own concepts: read the description, pick the concept it matches. Wrong options are neighbouring concepts, and after each answer you see what each one actually means. Concepts you miss come back more often, and results build up in Progress.'}</p>
        {is445 && (
          <div className="wrap" role="radiogroup" aria-label="Question mix">
            <button type="button" className="chip" aria-pressed={!s.settings.ch5only} onClick={() => setSetting('ch5only', false)}>Quiz 2 mix</button>
            <button type="button" className="chip" aria-pressed={s.settings.ch5only} onClick={() => setSetting('ch5only', true)}>Chapter 5 only</button>
          </div>
        )}
        <div><button type="button" className="btn berry" onClick={() => begin(has)}>{has ? 'Start a round on my weak spots' : 'Start round 1'}</button></div>
      </section>
      {has && <MasteryCard c={c} limit={5} title="Where you stand" />}
    </>
  )
  const answered = aq.qs.filter(q => q.picked != null).length, right = aq.qs.filter(q => q.picked === q.answer).length
  const pick = (q: BuiltQ | ConceptQ, k: number) => {
    if (q.picked != null) return
    q.picked = k
    const ok = k === q.answer
    let g = 0
    update(d => { g = answerXp(d, ok, (is445 ? 'Quiz-style: ' : 'Concept quiz: ') + q.cname, c) })
    celebrateXp(g); if (!ok) emit('berry', { mood: 'worried' })
    if (aq.qs.every(x => x.picked != null)) finishAdaptive()
    force()
  }
  return (
    <>
      <section className="card bold" id="aq-head">
        <div className="row-between">
          <h3 className="h3">Round {aq.round} · {answered}/{aq.qs.length} answered · {right} correct</h3>
          <button type="button" className="btn ghost sm" onClick={() => { ui.aq = null; force() }}>End round</button>
        </div>
      </section>
      {aq.state === 'done' && aq.results && (() => {
        const rows = Object.values(aq.results).sort((a, b) => a.correct / a.seen - b.correct / b.seen)
        const weak = rows.filter(p => p.correct < p.seen).map(p => p.name)
        return (
          <section className="card bold" aria-live="polite">
            <h3 className="h3">You scored {right} of {aq.qs.length}{right === aq.qs.length ? ' · clean round +' + XP.cleanRound + ' XP' : ''}</h3>
            {rows.map(p => { const pct = p.correct / p.seen; return <div className="prow" key={p.name}><span>{p.name}</span><div className="bar thin"><span style={{ width: Math.round(pct * 100) + '%', background: col(pct) }} /></div><span className="pct">{p.correct}/{p.seen}</span></div> })}
            <div className="tip">{weak.length ? 'Next round will lean on: ' + weak.slice(0, 4).join(', ') + '.' : 'Clean round. The next one mixes in concepts you\'ve seen least.'}</div>
            <div><button type="button" className="btn berry" onClick={() => begin(true)}>Next round: focus on my weak spots</button></div>
          </section>
        )
      })()}
      {aq.qs.map((q, i) => (
        <section className="card" key={i} data-q={i}>
          <div className="eyebrow">Q{i + 1} · {q.cname}</div>
          <p className="prob">{q.stem}</p>
          <div className="mc">
            {q.options.map((o, k) => {
              const cls = q.picked != null ? (k === q.answer ? 'right' : k === q.picked ? 'wrong' : '') : ''
              return <button key={k} type="button" className={cls} disabled={q.picked != null} onClick={() => pick(q, k)}><span className="opt-l">{letterOf(k)}</span><span>{o}</span></button>
            })}
          </div>
          {q.picked != null && (
            <div className="sol" aria-live="polite">
              <b>{q.picked === q.answer ? 'Correct.' : 'Not quite.' + (q.whys && q.whys[q.picked] ? ' That answer ' + q.whys[q.picked] + '.' : '')}</b>
              {'steps' in q && q.steps ? q.steps.map((l, k) => <div key={k}>{l}</div>) : <div>{(q as ConceptQ).explain}</div>}
              {(() => {
                const tr = q.whys.map((w, k) => (w ? [letterOf(k), w] : null)).filter(Boolean) as string[][]
                return tr.length ? <><div className="eyebrow" style={{ marginTop: 6 }}>Trap answers</div><ul className="traps">{tr.map(([l, w]) => <li key={l}><b>{l}</b><span>{w}</span></li>)}</ul></> : null
              })()}
            </div>
          )}
        </section>
      ))}
    </>
  )
}

/* ---------- FNCE 477 quiz decks ---------- */
const deckPts = (q: DeckQ) => (q.type === 'written' ? 2 : 1)
function runsFor(s: AppState, id: string) { return Object.entries(s.deckruns).filter(([, r]) => r.deck === id).map(([rid, r]) => ({ id: rid, ...r })).sort((a, b) => (a.attempt || 0) - (b.attempt || 0)) }
function latestRun(s: AppState, id: string) { const r = runsFor(s, id); return r[r.length - 1] || null }
function metaFor(s: AppState, c: string) { return Object.values(s.deckmeta).find(m => m.c === c) || null }
function topicName(s: AppState, c: string, t: string) { const m = metaFor(s, c), x = m && (m.topics || []).find(y => y.id === t); return x ? x.name : t }
function isAnswered(q: DeckQ, r: DeckRun) { const a = (r.answers || {})[q.id]; return !!a && (q.type === 'written' ? !!String(a.text || '').trim() : Number.isInteger(a.pick)) }
function shuffled(n: number) { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }
const scoreText = (r: DeckRun) => (r.max ? `${r.pts}/${r.max} (${Math.round((r.pts || 0) / r.max * 100)}%)` : '')

function startRun(did: string) {
  const s = getState(), d = s.decks[did], prev = latestRun(s, did), attempt = (prev ? prev.attempt || 0 : 0) + 1, id = did + '--' + attempt, perm: Record<string, number[]> = {}
  for (const q of d.qs) if (q.type !== 'written') perm[q.id] = shuffled(q.opts.length)
  update(x => { x.deckruns[id] = { deck: did, c: d.c, attempt, status: 'open', started: new Date().toISOString(), answers: {}, perm } })
  ui.openDeck = { deck: did, run: id }
}
/** Marks written answers that can be marked without AI (blank → missed), then scores. Unmarked written answers leave the run "submitted" for self-marking. */
function score(d: Deck, r: DeckRun) {
  const ws = d.qs.filter(q => q.type === 'written'); r.results = r.results || {}
  for (const q of ws) { const t = String(((r.answers || {})[q.id] || {}).text || '').trim(); if (!t && !r.results[q.id]) r.results[q.id] = { v: 'missed', fb: 'No answer given.' } }
  let pts = 0, max = 0; for (const q of d.qs) { max += deckPts(q); const x = r.results[q.id]; if (x) pts += x.v === 'correct' ? deckPts(q) : x.v === 'partial' ? 1 : 0 }
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
  celebrateXp(g, 'proud')
}
function selfMark(did: string, rid: string, qid: string, v: 'correct' | 'partial' | 'missed') {
  update(x => { const d = x.decks[did], r = x.deckruns[rid]; r.results = r.results || {}; r.results[qid] = { v, fb: 'Marked by you against the key points.' }; score(d, r); if (r.status === 'graded') deckMastery(x, d, r) })
}

function CoverageCard({ c }: { c: string }) {
  const { s } = useData()
  const m = metaFor(s, c)
  if (!m) return <section className="card"><h3 className="h3">Coverage</h3><p className="note">The topic map arrives with your first deck.</p></section>
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
    <section className="card">
      <h3 className="h3">{m.title}</h3>
      <p className="note">Two dots per topic: the left one is knowledge (definitions and facts), the right one is comprehension (applying it). Grey = not tested yet, red = missed, amber = partly right, green = right on your latest try. Knowledge green: {kn} of {topics.length} · both green: {both} of {topics.length}.</p>
      {[...new Set(topics.map(t => t.lec))].map(lec => (
        <div key={lec} className="stack" style={{ gap: 6 }}>
          <div className="eyebrow">{lec}</div>
          <div className="cov">
            {topics.filter(x => x.lec === lec).map(t => { const sk = st[t.id + '|k'], sc = st[t.id + '|c']; return <span key={t.id} title={tip('Knowledge', sk) + ' · ' + tip('Comprehension', sc)}><i className={cls(sk)} /><i className={cls(sc)} /><span>{t.name}</span></span> })}
          </div>
        </div>
      ))}
    </section>
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
  const open = (id: string, rid: string) => { ui.openDeck = { deck: id, run: rid }; force(); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  return (
    <>
      <section className="card bold">
        <h3 className="h3">Quiz decks</h3>
        <p>Work through them in order. Step 1 decks check what you know: definitions, rules and key numbers. Step 2 decks test whether you can apply them to scenarios and calculations. Each deck has 15 multiple-choice questions. Submit to see your marks and an explanation for every question; retake until every topic dot is green.</p>
      </section>
      {!list.length ? <p className="empty">No decks yet. Decks come in with your data; import a backup that has them from Settings.</p> : (
        <section className="card">
          <h3 className="h3">Your decks</h3>
          {list.map(([id, d]) => {
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
                    <button type="button" className={'btn sm' + (!r || r.status === 'open' ? '' : ' ghost')} onClick={() => { if (!r) { startRun(id); force() } else open(id, r.id) }}>{!r ? 'Start' : r.status === 'open' ? 'Continue' : 'See results'}</button>
                    {r && r.status !== 'open' && <button type="button" className="btn sm berry" onClick={() => { startRun(id); force() }}>Retake</button>}
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      )}
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
  const retake = () => { startRun(did); force(); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const mcq = d.qs.filter(q => q.type !== 'written'), wq = d.qs.filter(q => q.type === 'written'), miss = d.qs.filter(q => res[q.id] && res[q.id].v !== 'correct')
  return (
    <>
      <div><button type="button" className="btn ghost sm" onClick={back}>← All decks</button></div>
      <section className="card bold">
        <div className="eyebrow">{d.stage ? d.stage.split(':')[0] + ' · ' : ''}Attempt {r.attempt}</div>
        <h3 className="h3">{d.title}</h3><p className="note">{d.covers || ''}</p>
        {open && <p aria-live="polite">{k} of {n} answered</p>}
      </section>
      {!open && <div className="tip">These are your results from attempt {r.attempt}, so the answers are locked. To answer the questions again, start a new attempt. <div style={{ marginTop: 8 }}><button type="button" className="btn sm" onClick={retake}>Retake this deck</button></div></div>}
      {!open && (
        <section className="card bold" aria-live="polite">
          <h3 className="h3">You scored {scoreText(r)}</h3>
          <p className="note">Multiple choice: {mcq.filter(q => res[q.id] && res[q.id].v === 'correct').length} of {mcq.length} right.{wq.length ? ` Written: ${wq.filter(q => res[q.id] && res[q.id].v === 'correct').length} full, ${wq.filter(q => res[q.id] && res[q.id].v === 'partial').length} partial, out of ${wq.length}.` : ''}</p>
          {miss.length > 0 && <><b>To work on</b><ul className="keylist">{miss.map(q => <li key={q.id}>Q{d.qs.indexOf(q) + 1} · {topicName(s, d.c, q.topic)}</li>)}</ul></>}
          {r.status === 'submitted' && <p className="note">Some written answers aren't marked yet. Compare each with “What a full answer includes” below and mark it yourself.</p>}
          <div className="tip green">Debrief: reread the explanation for every question you missed, then retake the deck. A topic turns green once you get it right on your latest try.</div>
        </section>
      )}
      {d.qs.map((q, i) => {
        const a = (r.answers || {})[q.id] || {}, rs = res[q.id]
        const order = (r.perm && r.perm[q.id]) || q.opts.map((_, j) => j)
        return (
          <section className="card" key={q.id}>
            <div className="eyebrow">Q{i + 1} · {q.type === 'written' ? 'Written' : 'Multiple choice'} · {topicName(s, d.c, q.topic)}</div>
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
              <div className="sol">
                {rs && <span className={'vd ' + (rs.v === 'correct' ? 'ok' : rs.v === 'partial' ? 'part' : 'no')}>{rs.v === 'correct' ? 'Correct' : rs.v === 'partial' ? 'Partly right · 1 of 2' : q.type === 'written' ? 'Missed · 0 of 2' : 'Wrong'}</span>}
                {rs?.fb && <div>{rs.fb}</div>}
                {q.type === 'written' ? <><b>What a full answer includes</b><ul className="keylist">{(q.key || []).map((x, j) => <li key={j}>{x}</li>)}</ul>
                  {!rs && <div className="wrap"><span className="note">Mark it yourself:</span>
                    <button type="button" className="btn sm" onClick={() => selfMark(did, rid, q.id, 'correct')}>Full marks</button>
                    <button type="button" className="btn sm ghost" onClick={() => selfMark(did, rid, q.id, 'partial')}>Partly</button>
                    <button type="button" className="btn sm ghost" onClick={() => selfMark(did, rid, q.id, 'missed')}>Missed</button></div>}
                </> : <div>{q.explain || ''}</div>}
              </div>
            )}
          </section>
        )
      })}
      {open && <SubmitCard left={n - k} onSubmit={() => { submitDeck(did, rid); force(); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />}
    </>
  )
}
function SubmitCard({ left, onSubmit }: { left: number; onSubmit: () => void }) {
  const [sure, setSure] = useState(false)
  return (
    <section className="card bold">
      <p>Done? Submit to see your marks and explanations.</p>
      <div><button type="button" className="btn berry" onClick={() => { if (left > 0 && !sure) { setSure(true); return } setSure(false); onSubmit() }}>Submit deck</button></div>
      {sure && left > 0 && <p className="note" role="alert">{left} question{left > 1 ? 's are' : ' is'} still blank and will count as wrong. Tap Submit again to hand it in anyway.</p>}
    </section>
  )
}
