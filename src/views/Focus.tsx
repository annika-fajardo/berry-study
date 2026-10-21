import { useEffect, useState } from 'react'
import { useData, useNow, useToday } from '../lib/hooks'
import { COURSES, COURSE_KEYS, courseColor } from '../data/courses'
import { fmt, hm, monday, parse, todayStr, dateStr } from '../lib/dates'
import { startTimer, abandonTimer, logFlora, deleteSession } from '../store/actions'
import { on } from '../lib/events'
import { getState } from '../store/store'
import { plantFor, PLANT_LABEL } from '../lib/game'
import { courseSlug } from '../lib/router'
import { Plant, TuxCat, Berry } from '../components/Characters'
import { Confirm } from '../components/Modal'
import { weekMinutes } from './Courses'
import type { Session } from '../store/types'

const PRESETS = [25, 50]

export function Focus({ parts }: { parts: string[] }) {
  const { s } = useData()
  const t = useToday()
  const now = useNow(1000)
  const pre = COURSE_KEYS.find(k => courseSlug(k) === parts[0])
  const [course, setCourse] = useState(pre || s.timer?.c || 'FNCE 445')
  const [mins, setMins] = useState(25)
  const [custom, setCustom] = useState('')
  const [giveUp, setGiveUp] = useState(false)
  const [done, setDone] = useState<Session | null>(null)
  useEffect(() => on('catblink', () => {
    const last = Object.values(getState().sessions).sort((a, b) => b.ts.localeCompare(a.ts))[0]
    setDone(last || null)
  }), [])
  const tm = s.timer
  const planned = tm ? tm.planned : mins
  const elapsed = tm ? Math.max(0, now - tm.start) : 0
  const remain = Math.max(0, planned * 60000 - elapsed)
  const pct = tm ? Math.min(1, elapsed / (planned * 60000)) : 0
  const mm = Math.floor(remain / 60000), ss = Math.floor((remain % 60000) / 1000)
  const R = 46, C = 2 * Math.PI * R
  const cat = s.settings.catName
  const customN = Number(custom)
  const customOk = custom !== '' && Number.isFinite(customN) && customN >= 1 && customN <= 180

  return (
    <div className="page">
      <header className="row-between">
        <div><div className="eyebrow">Focus & garden</div><h1 className="display">Grow something</h1></div>
        <Berry mood={tm ? 'studying' : done ? 'proud' : 'happy'} size={70} />
      </header>
      <div className="grid2">
        <section className="card bold timer-card" aria-label="Focus timer">
          {!tm && (
            <>
              <div className="wrap" role="radiogroup" aria-label="Course" style={{ justifyContent: 'center' }}>
                {COURSE_KEYS.map(k => <button key={k} type="button" className="chip" role="radio" aria-checked={course === k} aria-pressed={course === k} onClick={() => setCourse(k)}><span className="dot" style={{ background: COURSES[k].color }} />{k}</button>)}
              </div>
              <div className="wrap" role="radiogroup" aria-label="Length" style={{ justifyContent: 'center' }}>
                {PRESETS.map(p => <button key={p} type="button" className="chip" role="radio" aria-checked={mins === p && !customOk} aria-pressed={mins === p && !customOk} onClick={() => { setMins(p); setCustom('') }}>{p} min</button>)}
                <label className="wrap" style={{ gap: 6, fontWeight: 700 }}>Custom
                  <input className="input" style={{ width: 92 }} type="number" min={1} max={180} inputMode="numeric" placeholder="min" value={custom} onChange={e => { setCustom(e.target.value); const n = Number(e.target.value); if (n >= 1 && n <= 180) setMins(Math.round(n)) }} aria-label="Custom minutes (1 to 180)" />
                </label>
              </div>
            </>
          )}
          <div className="dial">
            <svg className="ring" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r={R} fill="var(--surface-2)" stroke="var(--outline)" strokeWidth="2" />
              <circle cx="50" cy="50" r={R - 5} fill="var(--bg)" stroke="var(--line)" strokeWidth="1" />
              <circle cx="50" cy="50" r={R} fill="none" stroke={tm ? courseColor(tm.c) : 'var(--line)'} strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 1s linear' }} />
            </svg>
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginTop: tm ? -30 : -10 }}>
              <Plant kind={plantFor(planned)} grow={tm ? 0.2 + pct * 0.8 : 1} size={tm ? 64 : 72} tint={tm ? courseColor(tm.c) : courseColor(course)} title={'Growing ' + PLANT_LABEL[plantFor(planned)].toLowerCase()} />
              <div className="clock" role="timer" aria-live="off" aria-label={tm ? `${mm} minutes ${ss} seconds left` : `${planned} minutes`}>{tm ? `${mm}:${String(ss).padStart(2, '0')}` : `${planned}:00`}</div>
              <div className="note" style={{ fontWeight: 700 }}>{tm ? tm.c : PLANT_LABEL[plantFor(planned)]}</div>
            </div>
            {tm && <div className="napper"><TuxCat pose="sleep" size={120} name={cat} /></div>}
          </div>
          {tm ? (
            <div className="stack" style={{ alignItems: 'center', marginTop: tm ? 18 : 0 }}>
              <p className="note">{cat} is napping on the timer. Ends at {new Date(tm.start + tm.planned * 60000).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }).replace(/\.$/, '')}.</p>
              <button type="button" className="btn ghost" onClick={() => setGiveUp(true)}>Stop early</button>
            </div>
          ) : (
            <button type="button" className="btn berry" onClick={() => { setDone(null); startTimer(course, mins) }}>Start {mins}-minute focus</button>
          )}
          {!tm && done && (
            <div className="tip green" style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }} aria-live="polite">
              <TuxCat pose="sit" size={76} name={cat} blink />
              <span><b>Session complete.</b> {cat} gives you a slow blink. {PLANT_LABEL[done.plant]} planted for {done.c}, +{done.minutes} XP.</span>
            </div>
          )}
        </section>
        <FloraLog defaultCourse={course} />
      </div>
      <Garden />
      <section className="card weekbars">
        <h2 className="h3">Minutes this week, by course</h2>
        {(() => { const mx = Math.max(60, ...COURSE_KEYS.map(k => weekMinutes(s, k, t))); return COURSE_KEYS.map(k => { const m = weekMinutes(s, k, t); return <div className="prow" key={k}><span className="course-tag" style={{ color: COURSES[k].color }}>{k}</span><div className="bar thin"><span style={{ width: Math.round(m / mx * 100) + '%', background: COURSES[k].color }} /></div><span className="pct" data-week-min={k}>{hm(m)}</span></div> }) })()}
      </section>
      {giveUp && <Confirm title="Stop this session?" body={<p>Stopping now wilts this plant. The minutes you've done still count as study time, but they earn no XP.</p>} confirmLabel="Stop and wilt" danger onCancel={() => setGiveUp(false)} onConfirm={() => { setGiveUp(false); abandonTimer() }} />}
    </div>
  )
}

function FloraLog({ defaultCourse }: { defaultCourse: string }) {
  const [c, setC] = useState(defaultCourse)
  const [m, setM] = useState('25')
  const [d, setD] = useState(todayStr())
  const [err, setErr] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = Number(m)
    if (!Number.isFinite(n) || n < 1 || n > 600) { setErr('Enter minutes between 1 and 600.'); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > todayStr()) { setErr("Pick today or an earlier date."); return }
    setErr(''); logFlora(c, Math.round(n), d)
  }
  return (
    <section className="card" aria-labelledby="flora-h">
      <h2 className="h3" id="flora-h">Log a Flora session</h2>
      <p className="note">Flora doesn't share data with other apps, so log it here. It plants the same plant, adds the minutes and earns the same XP as a session on this timer.</p>
      <form className="form-grid" onSubmit={submit}>
        <label className="field">Minutes<input className="input" type="number" min={1} max={600} inputMode="numeric" value={m} onChange={e => setM(e.target.value)} id="flora-min" /></label>
        <label className="field">Course<select className="input" value={c} onChange={e => setC(e.target.value)} id="flora-course">{COURSE_KEYS.map(k => <option key={k}>{k}</option>)}</select></label>
        <label className="field">Date<input className="input" type="date" value={d} max={todayStr()} onChange={e => setD(e.target.value)} /></label>
        {err && <p className="wide bad" role="alert">{err}</p>}
        <div className="wide"><button type="submit" className="btn">Log Flora session</button></div>
      </form>
    </section>
  )
}

function Garden() {
  const { s } = useData()
  const t = useToday()
  const [del, setDel] = useState<Session | null>(null)
  const thisMon = dateStr(monday(parse(t)))
  const sessions = Object.values(s.sessions).sort((a, b) => a.date.localeCompare(b.date) || a.ts.localeCompare(b.ts))
  const weekOf = (x: Session) => dateStr(monday(parse(x.date)))
  const current = sessions.filter(x => weekOf(x) === thisMon)
  const past = new Map<string, Session[]>()
  for (const x of sessions) { const w = weekOf(x); if (w < thisMon) { if (!past.has(w)) past.set(w, []); past.get(w)!.push(x) } }
  const grownMin = current.filter(x => x.status === 'grown').reduce((a, x) => a + x.minutes, 0)
  const cat = s.settings.catName
  const plot = (x: Session, size = 54) => (
    <button type="button" key={x.id} className="plot" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, minHeight: 44 }} onClick={() => setDel(x)}
      aria-label={`${x.status === 'wilted' ? 'Wilted ' : ''}${PLANT_LABEL[x.plant]} · ${x.c} · ${x.minutes} min · ${fmt(parse(x.date), { weekday: 'short', month: 'short', day: 'numeric' })}${x.source === 'flora' ? ' · from Flora' : ''}`}>
      <Plant kind={x.plant} wilted={x.status === 'wilted'} size={size} tint={x.plant === 'flower' ? courseColor(x.c) : undefined} />
      <span>{x.c.split(' ')[1]} · {x.minutes}m</span>
    </button>
  )
  return (
    <section className="stack" aria-labelledby="garden-h">
      <div className="row-between">
        <h2 className="h2" id="garden-h">This week's garden</h2>
        <span className="note">{current.filter(x => x.status === 'grown').length} plants · {hm(grownMin)} grown</span>
      </div>
      <div className="garden" data-testid="garden">
        <div className="sun" aria-hidden="true" />
        <div className="beds">
          {current.length ? current.map(x => plot(x)) : <p className="empty-msg">Nothing planted yet this week. A 25-minute session grows a strawberry plant; 50+ grows a matcha bush; shorter ones grow a little flower.</p>}
        </div>
        <div className="roam" aria-hidden="true"><TuxCat pose={current.length > 3 ? 'stretch' : 'loaf'} size={84} name={cat} /></div>
      </div>
      <p className="note">Each plant is tagged by course (flower petals take the course colour). Tap a plant to see it or remove it. {cat} wanders the garden while you work.</p>
      {past.size > 0 && (
        <details className="card">
          <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', fontWeight: 800 }}>Garden archive · {past.size} earlier week{past.size > 1 ? 's' : ''}</summary>
          {[...past.entries()].reverse().map(([w, list]) => (
            <div key={w} className="stack" style={{ gap: 6, borderTop: '2px dashed var(--line)', paddingTop: 10 }}>
              <div className="row-between"><b>Week of {fmt(parse(w), { month: 'short', day: 'numeric' })}</b><span className="note">{hm(list.filter(x => x.status === 'grown').reduce((a, x) => a + x.minutes, 0))} grown</span></div>
              <div className="wrap">{list.map(x => plot(x, 44))}</div>
            </div>
          ))}
        </details>
      )}
      {del && <Confirm title={(del.status === 'wilted' ? 'Wilted ' : '') + PLANT_LABEL[del.plant]} body={<p>{del.c} · {del.minutes} min on {fmt(parse(del.date), { weekday: 'long', month: 'short', day: 'numeric' })}{del.source === 'flora' ? ' (logged from Flora)' : del.source === 'course-desk' ? ' (from Course Desk)' : ''}. Remove it if it was logged by mistake; its minutes and XP come off too.</p>} confirmLabel="Remove plant" danger onCancel={() => setDel(null)} onConfirm={() => { deleteSession(del.id); setDel(null) }} />}
    </section>
  )
}
