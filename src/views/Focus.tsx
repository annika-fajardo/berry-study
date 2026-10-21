/* Focus: a timer with Emi loafing beside it, the week's sessions, and Flora logging. */
import { useEffect, useState } from 'react'
import { Play, Square, Sprout, Timer as TimerIcon } from 'lucide-react'
import { useData, useToday, useNow } from '../lib/hooks'
import { COURSES, COURSE_KEYS, courseColor } from '../data/courses'
import { fmt, hm, monday, parse, todayStr, dateStr, addDays } from '../lib/dates'
import { startTimer, abandonTimer, logFlora, deleteSession } from '../store/actions'
import { getState } from '../store/store'
import { on } from '../lib/events'
import { plantFor, PLANT_LABEL } from '../lib/game'
import { courseSlug } from '../lib/router'
import { Cat } from '../components/Cat'
import { Confirm } from '../components/Modal'
import { Panel, I, PageHead, Empty } from '../components/ui'
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
  useEffect(() => on('cat', e => { if (e.kind === 'timerdone') setDone(Object.values(getState().sessions).sort((a, b) => b.ts.localeCompare(a.ts))[0] || null) }), [])
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
      <PageHead title="Focus" desc="A quiet timer. Every finished session is a minute of xp and a plant in the week below." />
      <div className="cols2">
        <Panel icon={TimerIcon} title="Timer" id="timer" className="timer-panel">
          {!tm && (
            <>
              <div className="wrap" role="radiogroup" aria-label="Course" style={{ justifyContent: 'center' }}>
                {COURSE_KEYS.map(k => <button key={k} type="button" className="chip" role="radio" aria-checked={course === k} aria-pressed={course === k} onClick={() => setCourse(k)}><span className="dot" style={{ background: COURSES[k].color }} />{k}</button>)}
              </div>
              <div className="wrap" role="radiogroup" aria-label="Length" style={{ justifyContent: 'center' }}>
                {PRESETS.map(p => <button key={p} type="button" className="chip" role="radio" aria-checked={mins === p && !customOk} aria-pressed={mins === p && !customOk} onClick={() => { setMins(p); setCustom('') }}>{p} min</button>)}
                <label className="wrap" style={{ gap: 6, fontSize: 13 }}>Custom
                  <input className="input" style={{ width: 86 }} type="number" min={1} max={180} inputMode="numeric" placeholder="min" value={custom} onChange={e => { setCustom(e.target.value); const n = Number(e.target.value); if (n >= 1 && n <= 180) setMins(Math.round(n)) }} aria-label="Custom minutes (1 to 180)" />
                </label>
              </div>
            </>
          )}
          <div className="dial">
            <svg className="ring" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r={R} fill="none" stroke="var(--line)" strokeWidth="3" />
              <circle cx="50" cy="50" r={R} fill="none" stroke={tm ? courseColor(tm.c) : 'var(--line-strong)'} strokeWidth="3" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 1s linear' }} />
            </svg>
            <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
              <div className="clock" role="timer" aria-live="off" aria-label={tm ? `${mm} minutes ${ss} seconds left` : `${planned} minutes`}>{tm ? `${mm}:${String(ss).padStart(2, '0')}` : `${planned}:00`}</div>
              <div className="note">{tm ? tm.c : PLANT_LABEL[plantFor(planned)]}</div>
            </div>
            {tm && <div className="napper"><Cat live status="focus" size={96} sleepy={pct} /></div>}
          </div>
          {tm ? (
            <>
              <p className="note">{cat} is loafing by the timer. Ends at {new Date(tm.start + tm.planned * 60000).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }).replace(/\.$/, '')}.</p>
              <button type="button" className="btn quiet" onClick={() => setGiveUp(true)}><I as={Square} size={15} />Stop early</button>
            </>
          ) : <button type="button" className="btn" onClick={() => { setDone(null); startTimer(course, mins) }}><I as={Play} size={15} />Start {mins} minutes</button>}
          {!tm && done && <p className="tip" aria-live="polite">Session done. {PLANT_LABEL[done.plant]} planted for {done.c}, +{done.minutes} xp.</p>}
        </Panel>
        <FloraLog defaultCourse={course} />
      </div>
      <WeekPlants />
      <Panel icon={Sprout} title="Minutes this week, by course" id="wk">
        {(() => { const mx = Math.max(60, ...COURSE_KEYS.map(k => weekMinutes(s, k, t))); return COURSE_KEYS.map(k => { const m = weekMinutes(s, k, t); return <div className="prow" key={k}><span className="course-tag" style={{ color: COURSES[k].color }}>{k}</span><span className="bar"><span style={{ width: Math.round(m / mx * 100) + '%', background: COURSES[k].color }} /></span><span className="pct" data-week-min={k}>{hm(m)}</span></div> }) })()}
      </Panel>
      {giveUp && <Confirm title="Stop this session?" body={<p>The minutes you've done still count as study time, but a session you stop early earns no xp.</p>} confirmLabel="Stop" danger onCancel={() => setGiveUp(false)} onConfirm={() => { setGiveUp(false); abandonTimer() }} />}
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > todayStr()) { setErr('Pick today or an earlier date.'); return }
    setErr(''); logFlora(c, Math.round(n), d)
  }
  return (
    <Panel title="Log a Flora session" id="flora">
      <p className="note">Flora doesn't share data with other apps, so log it here. It counts exactly like a session on this timer: same minutes, same xp, same plant.</p>
      <form className="form-grid" onSubmit={submit}>
        <label className="field">Minutes<input className="input" type="number" min={1} max={600} inputMode="numeric" value={m} onChange={e => setM(e.target.value)} id="flora-min" /></label>
        <label className="field">Course<select className="input" value={c} onChange={e => setC(e.target.value)} id="flora-course">{COURSE_KEYS.map(k => <option key={k}>{k}</option>)}</select></label>
        <label className="field">Date<input className="input" type="date" value={d} max={todayStr()} onChange={e => setD(e.target.value)} /></label>
        {err && <p className="wide bad" role="alert">{err}</p>}
        <div className="wide"><button type="submit" className="btn">Log it</button></div>
      </form>
    </Panel>
  )
}

function WeekPlants() {
  const { s } = useData()
  const t = useToday()
  const [del, setDel] = useState<Session | null>(null)
  const mon = dateStr(monday(parse(t)))
  const week = Object.values(s.sessions).filter(x => x.date >= mon && x.date <= addDays(mon, 6)).sort((a, b) => a.date.localeCompare(b.date))
  const grown = week.filter(x => x.status === 'grown')
  return (
    <Panel icon={Sprout} title="This week" id="plants" right={<span className="note">{grown.length} session{grown.length === 1 ? '' : 's'} · {hm(grown.reduce((a, x) => a + x.minutes, 0))}</span>}>
      {week.length ? (
        <div className="garden-row">
          {week.map(x => (
            <button type="button" className="plot" key={x.id} onClick={() => setDel(x)} aria-label={`${PLANT_LABEL[x.plant]}, ${x.c}, ${x.minutes} minutes, ${fmt(parse(x.date), { weekday: 'long' })}${x.status === 'wilted' ? ', stopped early' : ''}`}>
              <Plant kind={x.plant} faded={x.status === 'wilted'} color={courseColor(x.c)} />
              <span>{x.c.split(' ')[1]} · {x.minutes}m</span>
            </button>
          ))}
        </div>
      ) : <Empty status="sleep">Nothing yet this week. A 25-minute session is a good start.</Empty>}
      {del && <Confirm title={PLANT_LABEL[del.plant]} body={<p>{del.c} · {del.minutes} min on {fmt(parse(del.date), { weekday: 'long', month: 'short', day: 'numeric' })}{del.source === 'flora' ? ' (from Flora)' : del.source === 'course-desk' ? ' (from Course Desk)' : ''}. Remove it if it was logged by mistake; its minutes and xp come off too.</p>} confirmLabel="Remove" danger onCancel={() => setDel(null)} onConfirm={() => { deleteSession(del.id); setDel(null) }} />}
    </Panel>
  )
}

/** A small line-drawn plant: short sprout, taller stem, or a bushy one for long sessions. */
function Plant({ kind, faded, color }: { kind: 'flower' | 'strawberry' | 'matcha'; faded?: boolean; color: string }) {
  const stroke = faded ? 'var(--faint)' : 'var(--sage)'
  return (
    <svg viewBox="0 0 32 34" width="30" height="32" aria-hidden="true" style={{ opacity: faded ? 0.55 : 1 }}>
      <path d="M16 32 V18" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M16 24 C 10 23, 7 19, 7 15 C 12 15, 15 19, 16 23" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
      {kind !== 'flower' && <path d="M16 20 C 22 19, 25 15, 25 11 C 20 11, 17 15, 16 19" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />}
      {kind === 'matcha' && <path d="M16 15 C 13 11, 13 7, 15 4 C 18 7, 18 11, 16 15" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />}
      {kind !== 'flower' && !faded && <circle cx="22" cy="24" r="2.6" fill={color} opacity=".8" />}
      {kind === 'flower' && !faded && <circle cx="16" cy="12" r="3.2" fill={color} opacity=".75" />}
      <path d="M9 32 h14" stroke="var(--line-strong)" strokeWidth="1.2" strokeLinecap="round" />
      {faded && <path d="M12 8 l8 8 M20 8 l-8 8" stroke="var(--faint)" strokeWidth="1" strokeLinecap="round" opacity=".6" />}
    </svg>
  )
}
