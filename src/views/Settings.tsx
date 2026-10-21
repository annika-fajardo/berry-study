/* Settings: appearance, companion, calendars (Google, .ics, D2L), classes, study preferences, data, about. */
import { useRef, useState } from 'react'
import { Link2, Unlink, RefreshCw, Upload, Download, Trash2, Plus, Info, Briefcase, GraduationCap, Settings2, Database, Cat as CatIcon, Palette, CalendarClock } from 'lucide-react'
import { useData } from '../lib/hooks'
import { setSetting } from '../store/actions'
import { getState, replaceState, flush, storageName, update } from '../store/store'
import { seedState } from '../store/seed'
import { makeBackup, backupFilename, parseBackup, mergeStates, summarize } from '../lib/backup'
import { levelInfo, xpTotal, streak, XP } from '../lib/game'
import { toast } from '../lib/events'
import { parseIcs, toIcs } from '../lib/ics'
import { connectGoogle, disconnectGoogle, syncGoogle, useSync, useCal } from '../lib/calendar'
import { D2L_NAME_RE } from '../lib/d2l'
import { Cat, BREEDS, type Breed } from '../components/Cat'
import { Modal, Confirm } from '../components/Modal'
import { Panel, I, PageHead, ViewTabs } from '../components/ui'
import { COURSE_KEYS } from '../data/courses'
import { hhmm } from '../lib/time'
import { todayStr, uid } from '../lib/dates'
import type { AppState, CatAnim } from '../store/types'

export function applyTheme(t: string) {
  const r = document.documentElement
  r.setAttribute('data-theme', t === 'dark' ? 'dark' : t === 'auto' ? 'auto' : 'light')
}

type Tab = 'general' | 'calendars' | 'classes' | 'study' | 'data'
const TABS: { v: Tab; label: string }[] = [
  { v: 'general', label: 'General' }, { v: 'calendars', label: 'Calendars' }, { v: 'classes', label: 'Classes' }, { v: 'study', label: 'Study time' }, { v: 'data', label: 'Data' },
]

export function Settings({ parts }: { parts: string[] }) {
  const [tab, setTab] = useState<Tab>((TABS.find(t => t.v === parts[0])?.v) || 'general')
  return (
    <div className="page">
      <PageHead title="Settings" desc="Make it yours, connect your calendars, and keep your data where you want it." />
      <ViewTabs value={tab} onChange={setTab} options={TABS} label="Settings sections" />
      {tab === 'general' && <><Appearance /><Companion /><About /></>}
      {tab === 'calendars' && <Calendars />}
      {tab === 'classes' && <Classes />}
      {tab === 'study' && <StudyPrefs />}
      {tab === 'data' && <Data />}
    </div>
  )
}

/* ---------------- general ---------------- */
function Appearance() {
  const { s } = useData()
  return (
    <Panel icon={Palette} title="Appearance" id="appear">
      <div className="wrap">
        <div className="seg-toggle" role="radiogroup" aria-label="Theme">
          {(['light', 'auto', 'dark'] as const).map(t => <button key={t} type="button" role="radio" aria-checked={s.settings.theme === t} onClick={() => { setSetting('theme', t); applyTheme(t) }}>{t[0].toUpperCase() + t.slice(1)}</button>)}
        </div>
        <span className="note">Auto follows your device.</span>
      </div>
      <div className="wrap">
        <div className="seg-toggle" role="radiogroup" aria-label="Cat animations">
          {(['auto', 'full', 'calm', 'off'] as const).map(t => <button key={t} type="button" role="radio" aria-checked={(s.settings.catAnim || 'auto') === t} onClick={() => setSetting('catAnim', t as CatAnim)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
        </div>
        <span className="note">Cat animations. Calm keeps the blink and tail only; Auto follows your reduced-motion setting.</span>
      </div>
    </Panel>
  )
}

function Companion() {
  const { s } = useData()
  const info = levelInfo(xpTotal(s)), st = streak(s, todayStr())
  const [name, setName] = useState(s.settings.catName)
  const cur = (s.settings.companion || 'emi') as Breed
  const locked = (b: Breed) => {
    const u = BREEDS[b].unlock
    if (!u) return false
    return u.kind === 'level' ? info.level < u.n : st.count < u.n
  }
  return (
    <Panel icon={CatIcon} title="Companion" id="companion">
      <div className="companions">
        {(Object.keys(BREEDS) as Breed[]).map(b => {
          const isLocked = locked(b)
          return (
            <button key={b} type="button" className={'comp' + (cur === b ? ' on' : '') + (isLocked ? ' locked' : '')} aria-pressed={cur === b} disabled={isLocked}
              onClick={() => setSetting('companion', b)} title={isLocked ? BREEDS[b].unlock!.hint : BREEDS[b].blurb} data-breed={b}>
              <Cat breed={b} status="idle" size={66} />
              <b>{b === 'emi' ? (s.settings.catName || 'Emi') : BREEDS[b].name}</b>
              <span className="note">{isLocked ? BREEDS[b].unlock!.hint : BREEDS[b].blurb}</span>
            </button>
          )
        })}
      </div>
      {cur === 'emi' && (
        <form className="wrap" onSubmit={e => { e.preventDefault(); const n = name.trim().slice(0, 24) || 'Emi'; setSetting('catName', n); setName(n); toast('Say hi to ' + n + '.') }}>
          <label className="field" style={{ flex: '1 1 160px' }}>Her name<input className="input" value={name} maxLength={24} onChange={e => setName(e.target.value)} /></label>
          <button type="submit" className="btn quiet" style={{ alignSelf: 'flex-end' }}>Save</button>
        </form>
      )}
    </Panel>
  )
}

function About() {
  const { s } = useData()
  const info = levelInfo(xpTotal(s))
  return (
    <Panel icon={Info} title="About" id="about">
      <p>Berry Study keeps your term in one place: deadlines and exams, a calendar that suggests when to study, practice in the format your quizzes use, a focus timer, and your projected GPA. It works offline and installs to your home screen. There are no AI features in this version.</p>
      <p className="note">Level {info.level} · {info.name} · {info.total.toLocaleString('en-CA')} xp. Ticking a task is 5–55 xp depending on type and weight, each correct answer {XP.correct}, a clean round +{XP.cleanRound}, and {XP.perMinute} xp per focus minute. Your Course Desk history was turned into xp on first launch.</p>
      <p className="note">Version 2.0 · data schema v{s.schema} · {s.settings.catName} is drawn from photos of the real cat.</p>
    </Panel>
  )
}

/* ---------------- calendars ---------------- */
function Calendars() {
  const { s } = useData()
  const sync = useSync()
  const cal = useCal()
  const [clientId, setClientId] = useState(s.cal.clientId)
  const [help, setHelp] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const connect = async () => {
    setErr(''); setBusy(true)
    try { update(d => { d.cal.clientId = clientId.trim() }); await connectGoogle() }
    catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }
  const importIcs = async (f?: File) => {
    if (!f) return
    setErr('')
    try {
      const text = await f.text()
      const id = uid('ics')
      const events = parseIcs(text, { cal: id })
      if (!events.length) throw new Error('No events found in that file.')
      update(d => { d.ics[id] = { name: f.name, importedAt: new Date().toISOString(), events, d2l: D2L_NAME_RE.test(f.name) } })
      toast(`Imported ${events.length} events from ${f.name}.`)
    } catch (e) { setErr((e as Error).message || "Couldn't read that .ics file.") }
    if (fileRef.current) fileRef.current.value = ''
  }
  const exportIcs = () => {
    const evs = [...cal.own.map(e => ({ uid: e.id, title: e.title, start: e.start, end: e.end, desc: e.note })),
      ...cal.sched.suggestions.map(x => ({ uid: x.key.replace(/[^\w-]/g, ''), title: x.title, start: x.start, end: x.end, desc: x.note }))]
    if (!evs.length) { toast('No study blocks to export yet.'); return }
    const blob = new Blob([toIcs(evs, 'Berry Study blocks')], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob), a = document.createElement('a')
    a.href = url; a.download = 'berry-study-blocks.ics'; document.body.append(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    toast('Exported ' + evs.length + ' blocks. Open the file on your Mac or iPhone to add them to Apple Calendar.')
  }
  return (
    <>
      <Panel icon={CalendarClock} title="Google Calendar" id="gcal" right={sync === 'syncing' ? <Cat status="sync" size={30} /> : undefined}>
        {!s.cal.connected ? (
          <>
            <p className="note">Berry Study talks to Google from this browser only. Your calendars are read to find free time, and study blocks you accept can be written back. Nothing goes through a server.</p>
            <label className="field">Google OAuth Client ID<input className="input" id="gclient" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="1234567890-abc.apps.googleusercontent.com" /></label>
            <div className="wrap">
              <button type="button" className="btn" disabled={busy || !clientId.trim()} onClick={connect}><I as={Link2} size={15} />Connect Google Calendar</button>
              <button type="button" className="btn quiet" onClick={() => setHelp(true)}><I as={Info} size={15} />How do I get one?</button>
            </div>
          </>
        ) : (
          <>
            <div className="wrap">
              <span className="note">Connected{s.cal.lastSync ? ' · last checked ' + new Date(s.cal.lastSync).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }) : ''}</span>
              <button type="button" className="btn quiet sm" onClick={() => void syncGoogle(true)}><I as={RefreshCw} size={15} />Refresh</button>
              <button type="button" className="btn quiet sm" onClick={disconnectGoogle}><I as={Unlink} size={15} />Disconnect</button>
            </div>
            <table className="report">
              <thead><tr><th>Calendar</th><th>Read</th><th><I as={Briefcase} size={14} /> Work</th><th><I as={GraduationCap} size={14} /> D2L</th></tr></thead>
              <tbody>
                {s.cal.calendars.map(c => (
                  <tr key={c.id}>
                    <td>{c.summary}{c.primary && <span className="note"> · primary</span>}</td>
                    <td><input type="checkbox" checked={c.selected} aria-label={'Read ' + c.summary} onChange={e => update(d => { const x = d.cal.calendars.find(y => y.id === c.id); if (x) x.selected = e.target.checked })} /></td>
                    <td><input type="checkbox" checked={!!c.work} aria-label={c.summary + ' is work'} onChange={e => update(d => { const x = d.cal.calendars.find(y => y.id === c.id); if (x) x.work = e.target.checked })} /></td>
                    <td><input type="checkbox" checked={!!c.d2l} aria-label={c.summary + ' is D2L'} onChange={e => update(d => { const x = d.cal.calendars.find(y => y.id === c.id); if (x) x.d2l = e.target.checked })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <label className="field">Write study blocks to
              <select className="input" value={s.cal.writeCal} onChange={e => update(d => { d.cal.writeCal = e.target.value })}>
                {s.cal.calendars.filter(c => c.writable !== false).map(c => <option key={c.id} value={c.id}>{c.summary}</option>)}
              </select>
            </label>
            <label className="wrap" style={{ gap: 8 }}><input type="checkbox" checked={s.cal.addToGoogle} onChange={e => update(d => { d.cal.addToGoogle = e.target.checked })} /><span>Add accepted study blocks to Google Calendar</span></label>
          </>
        )}
        {err && <p className="bad" role="alert">{err}</p>}
        {sync.startsWith('error') && <p className="bad">{sync.slice(6)}</p>}
      </Panel>

      <Panel icon={Upload} title="Apple Calendar and other feeds" id="ics">
        <p className="note">Two ways to bring Apple Calendar in. Either share the iCloud calendar as a public link and add it to Google (Other calendars → + → From URL) so it arrives with everything else, or import a .ics file here as a read-only source.</p>
        <div className="wrap">
          <button type="button" className="btn quiet" onClick={() => fileRef.current?.click()}><I as={Upload} size={15} />Import .ics file</button>
          <input ref={fileRef} type="file" accept=".ics,text/calendar" className="sr-only" aria-label="Choose an .ics file" data-testid="ics-input" tabIndex={-1} onChange={e => void importIcs(e.target.files?.[0])} />
          <button type="button" className="btn quiet" onClick={exportIcs}><I as={Download} size={15} />Export study blocks (.ics)</button>
        </div>
        {Object.entries(s.ics).map(([id, src]) => (
          <div className="deckrow" key={id}>
            <div><b>{src.name}</b><span className="note">{src.events.length} events · imported {new Date(src.importedAt).toLocaleDateString('en-CA')}</span></div>
            <div className="wrap">
              <label className="wrap" style={{ gap: 5 }}><input type="checkbox" checked={!!src.work} onChange={e => update(d => { d.ics[id].work = e.target.checked })} aria-label={src.name + ' is work'} />Work</label>
              <label className="wrap" style={{ gap: 5 }}><input type="checkbox" checked={!!src.d2l} onChange={e => update(d => { d.ics[id].d2l = e.target.checked })} aria-label={src.name + ' is D2L'} />D2L</label>
              <button type="button" className="btn quiet sm" onClick={() => update(d => { delete d.ics[id] })}><I as={Trash2} size={15} />Remove</button>
            </div>
          </div>
        ))}
      </Panel>

      <Panel icon={GraduationCap} title="D2L course dates" id="d2lhelp">
        <ol className="steps">
          <li>In D2L, open <b>Calendar → Subscribe</b> and copy the feed URL.</li>
          <li>In Google Calendar, go to <b>Other calendars → + → From URL</b> and paste it.</li>
          <li>Back here, tick <b>D2L</b> next to that calendar above.</li>
        </ol>
        <p className="note">D2L dates then show as deadline chips rather than busy time, and anything new or moved appears in “Updates from D2L” for you to accept or ignore. Google can take a few hours to pick up changes to the feed. You can also download the feed as a file and import it above.</p>
      </Panel>

      {help && (
        <Modal title="Getting a Google Client ID" onClose={() => setHelp(false)}>
          <ol className="steps">
            <li>Open the Google Cloud console and create a project.</li>
            <li>Under APIs &amp; Services, enable the <b>Google Calendar API</b>.</li>
            <li>Configure the <b>OAuth consent screen</b>: type External, publishing status Testing, and add your own Google address as a test user.</li>
            <li>Create credentials → <b>OAuth client ID</b> → Web application.</li>
            <li>Add authorized JavaScript origins: <code>https://annika-fajardo.github.io</code> and <code>http://localhost:4173</code>.</li>
            <li>Copy the Client ID and paste it here. It stays on this device.</li>
          </ol>
          <div className="wrap" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={() => setHelp(false)}>Got it</button></div>
        </Modal>
      )}
    </>
  )
}

/* ---------------- classes ---------------- */
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
function Classes() {
  const { s } = useData()
  const [c, setC] = useState('FNCE 445')
  const [wd, setWd] = useState(1)
  const [from, setFrom] = useState('09:30')
  const [to, setTo] = useState('10:45')
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (mins(to) <= mins(from)) { toast('The end has to be after the start.'); return }
    update(d => { d.classes[uid('cls')] = { c, weekday: wd, start: mins(from), end: mins(to), selfStudy: c === 'FNCE 445' } })
  }
  const list = Object.entries(s.classes).sort((a, b) => a[1].weekday - b[1].weekday || a[1].start - b[1].start)
  return (
    <Panel icon={GraduationCap} title="Class times" id="classes">
      <p className="note">Add when each class meets. Classes you attend are busy time. For a class you self-study instead, that hour becomes free and the scheduler offers a self-study block on this week's topic.</p>
      {list.map(([id, cm]) => (
        <div className="deckrow" key={id}>
          <div><b>{cm.c}</b><span className="note">{DAYS[cm.weekday]} · {hhmm(cm.start)}–{hhmm(cm.end)}</span></div>
          <div className="wrap">
            <label className="wrap" style={{ gap: 6 }}><input type="checkbox" checked={cm.selfStudy} onChange={e => update(d => { d.classes[id].selfStudy = e.target.checked })} aria-label={'Self-study instead of attending ' + cm.c} />I self-study instead</label>
            <button type="button" className="btn quiet sm" onClick={() => update(d => { delete d.classes[id] })}><I as={Trash2} size={15} />Remove</button>
          </div>
        </div>
      ))}
      <form className="form-grid" onSubmit={add}>
        <label className="field">Course<select className="input" value={c} onChange={e => setC(e.target.value)}>{COURSE_KEYS.map(k => <option key={k}>{k}</option>)}</select></label>
        <label className="field">Day<select className="input" value={wd} onChange={e => setWd(Number(e.target.value))}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
        <label className="field">From<input className="input" type="time" step={900} value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label className="field">To<input className="input" type="time" step={900} value={to} onChange={e => setTo(e.target.value)} /></label>
        <div className="wide"><button type="submit" className="btn"><I as={Plus} size={15} />Add class</button></div>
      </form>
    </Panel>
  )
}

/* ---------------- study preferences ---------------- */
function StudyPrefs() {
  const { s } = useData()
  const p = s.prefs
  const set = (f: (d: AppState) => void) => update(f)
  const hm2 = (m: number) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')
  return (
    <>
      <Panel icon={Settings2} title="When you study" id="window">
        <p className="note">The scheduler only suggests blocks inside these hours, never during something on your calendar, and leaves a gap around events.</p>
        <table className="report">
          <thead><tr><th>Day</th><th>From</th><th>To</th><th className="r">Off</th></tr></thead>
          <tbody>
            {DAYS.map((d, i) => (
              <tr key={d}>
                <td>{d}</td>
                <td><input className="input" type="time" step={900} value={hm2(p.window[i][0])} onChange={e => set(x => { x.prefs.window[i][0] = Number(e.target.value.slice(0, 2)) * 60 + Number(e.target.value.slice(3, 5)) })} aria-label={d + ' start'} /></td>
                <td><input className="input" type="time" step={900} value={hm2(p.window[i][1])} onChange={e => set(x => { x.prefs.window[i][1] = Number(e.target.value.slice(0, 2)) * 60 + Number(e.target.value.slice(3, 5)) })} aria-label={d + ' end'} /></td>
                <td className="r"><input type="checkbox" checked={p.noStudy.includes(i)} aria-label={'No study on ' + d} onChange={e => set(x => { x.prefs.noStudy = e.target.checked ? [...x.prefs.noStudy, i] : x.prefs.noStudy.filter(k => k !== i) })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="form-grid">
          <label className="field">Hours a day, at most<input className="input" type="number" min={1} max={12} step="0.5" value={p.maxHours} onChange={e => set(x => { x.prefs.maxHours = Number(e.target.value) || 1 })} /></label>
          <label className="field">Block length (min)<input className="input" type="number" min={15} max={120} step={5} value={p.blockMin} onChange={e => set(x => { x.prefs.blockMin = Number(e.target.value) || 50 })} /></label>
          <label className="field">Break between blocks (min)<input className="input" type="number" min={0} max={60} step={5} value={p.breakMin} onChange={e => set(x => { x.prefs.breakMin = Number(e.target.value) || 0 })} /></label>
          <label className="field">Gap around events (min)<input className="input" type="number" min={0} max={60} step={5} value={p.gapMin} onChange={e => set(x => { x.prefs.gapMin = Number(e.target.value) || 0 })} /></label>
        </div>
      </Panel>
      <Panel icon={Briefcase} title="Work shifts" id="shifts">
        <p className="note">Shifts are read from your calendars: anything that looks like a shift, or anything on a calendar you tagged as Work. You're on your feet all shift, so the scheduler keeps those days light.</p>
        <div className="form-grid">
          <label className="field">Rest after a shift (min)<input className="input" type="number" min={0} max={240} step={15} value={p.shiftRestMin} onChange={e => set(x => { x.prefs.shiftRestMin = Number(e.target.value) || 0 })} /></label>
          <label className="field">A long shift is (hours)<input className="input" type="number" min={1} max={12} step="0.5" value={p.longShiftH} onChange={e => set(x => { x.prefs.longShiftH = Number(e.target.value) || 5 })} /></label>
          <label className="field">A heavy day is (hours)<input className="input" type="number" min={1} max={16} step="0.5" value={p.heavyDayH} onChange={e => set(x => { x.prefs.heavyDayH = Number(e.target.value) || 8 })} /></label>
          <label className="field">Light review cap (min)<input className="input" type="number" min={10} max={120} step={5} value={p.lightMin} onChange={e => set(x => { x.prefs.lightMin = Number(e.target.value) || 30 })} /></label>
        </div>
        <p className="note">After a long shift the rest of the day gets one light block at most. On a heavy day (two shifts) it's light review only, up to the cap.</p>
      </Panel>
    </>
  )
}

/* ---------------- data ---------------- */
function Data() {
  const { s } = useData()
  const [pending, setPending] = useState<{ state: AppState; file: string } | null>(null)
  const [err, setErr] = useState('')
  const [reset, setReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const sum = summarize(s), info = levelInfo(xpTotal(s))
  const exportData = async () => {
    await flush()
    const blob = new Blob([JSON.stringify(makeBackup(getState()), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob), a = document.createElement('a')
    a.href = url; a.download = backupFilename(); document.body.append(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    toast('Backup saved: ' + a.download)
  }
  const pickFile = async (f?: File) => {
    setErr(''); if (!f) return
    try { setPending({ state: parseBackup(await f.text()), file: f.name }) }
    catch (e) { setErr((e as Error).message || "Couldn't read that file.") }
    if (fileRef.current) fileRef.current.value = ''
  }
  const doImport = (mode: 'replace' | 'merge') => {
    if (!pending) return
    const next = mode === 'replace' ? pending.state : mergeStates(getState(), pending.state)
    replaceState(next); applyTheme(next.settings.theme)
    setPending(null)
    toast(mode === 'replace' ? 'Backup restored.' : 'Backup merged in.')
  }
  return (
    <>
      <Panel icon={Database} title="Your data" id="data-h">
        <p><b>Everything is stored on this device</b>, in this browser ({storageName()}). Nothing is sent anywhere. To move to another device: <b>Export</b> here, send yourself the file, then <b>Import</b> it there.</p>
        <p className="note">Right now: {sum.items} schedule items, {sum.grades} grade rows, {sum.practice} practice records, {sum.sessions} sessions, {sum.xp} xp entries ({info.total.toLocaleString('en-CA')} xp, level {info.level}).</p>
        <div className="wrap">
          <button type="button" className="btn" onClick={exportData}><I as={Download} size={15} />Export data (JSON)</button>
          <button type="button" className="btn quiet" onClick={() => fileRef.current?.click()}><I as={Upload} size={15} />Import data…</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Choose a backup file to import" onChange={e => void pickFile(e.target.files?.[0])} data-testid="import-input" tabIndex={-1} />
          <button type="button" className="btn quiet" onClick={() => setReset(true)}><I as={RefreshCw} size={15} />Reset to seed…</button>
        </div>
        {err && <p className="bad" role="alert">{err}</p>}
        <p className="note">Export now and then, especially before clearing your browser data: clearing site data for this page deletes everything stored here.</p>
      </Panel>
      <Panel title="xp ledger" id="ledger">
        <details><summary className="link-summary">{Object.keys(s.xp).length} entries</summary>
          <ul className="ledger">{Object.values(s.xp).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 200).map(e => <li key={e.id}><span>{e.date} · {e.reason}</span><b>+{e.amount}</b></li>)}</ul>
        </details>
      </Panel>
      {pending && (
        <Modal title="Import this backup?" onClose={() => setPending(null)}>
          <p><b>{pending.file}</b>: {(() => { const x = summarize(pending.state); return `${x.items} schedule items, ${x.grades} grade rows, ${x.practice} practice records, ${x.sessions} sessions, ${x.xp} xp entries` })()}.</p>
          <p className="note"><b>Replace</b> swaps everything on this device for the backup. <b>Merge</b> keeps what's here and adds the backup's records, with the backup winning where both have the same record.</p>
          <div className="wrap" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn quiet" onClick={() => setPending(null)}>Cancel</button>
            <button type="button" className="btn quiet" onClick={() => doImport('merge')}>Merge</button>
            <button type="button" className="btn" onClick={() => doImport('replace')}>Replace</button>
          </div>
        </Modal>
      )}
      {reset && <Confirm title="Reset to the original data?" body={<p>This replaces everything on this device with the Course Desk data you started with. Ticks, marks, xp and sessions added since then are lost unless you export first. Your theme, companion and calendar settings stay.</p>} confirmLabel="Reset" danger onCancel={() => setReset(false)}
        onConfirm={() => { const keep = getState(); const n = seedState(); n.settings = { ...keep.settings }; n.cal = { ...keep.cal }; n.prefs = { ...keep.prefs }; n.classes = { ...keep.classes }; n.ics = { ...keep.ics }; n.gcache = keep.gcache; replaceState(n); setReset(false); toast('Reset to the original data.') }} />}
    </>
  )
}
