import { useEffect, useState } from 'react'
import { LayoutDashboard, CalendarDays, BookOpen, Sprout, GraduationCap, Settings as SettingsIcon, Menu, X, Plus, CalendarPlus, ClipboardList, Timer as TimerIcon } from 'lucide-react'
import { useRoute, type Route } from './lib/router'
import { I, type Icon } from './components/ui'
import { Toasts, XpFloats, LevelUpToasts } from './components/Overlays'
import { Dashboard } from './views/Dashboard'
import { Calendar } from './views/Calendar'
import { Courses } from './views/Courses'
import { Focus } from './views/Focus'
import { Grades } from './views/Grades'
import { Settings, applyTheme } from './views/Settings'
import { QuickCapture } from './views/QuickCapture'
import { useAppState, getState } from './store/store'
import { completeTimer } from './store/actions'
import { useNow } from './lib/hooks'
import { startAutoSync } from './lib/calendar'
import { levelInfo, xpTotal, streak } from './lib/game'
import { todayStr } from './lib/dates'
import { on } from './lib/events'

const NAV_ITEMS: { k: string; label: string; icon: Icon }[] = [
  { k: 'home', label: 'Dashboard', icon: LayoutDashboard },
  { k: 'schedule', label: 'Calendar', icon: CalendarDays },
  { k: 'study', label: 'Courses', icon: BookOpen },
  { k: 'garden', label: 'Focus', icon: Sprout },
]
const MORE: { k: string; label: string; icon: Icon }[] = [
  { k: 'grades', label: 'Grades', icon: GraduationCap },
  { k: 'settings', label: 'Settings', icon: SettingsIcon },
]

/** Completes a focus session when its time is up, whatever page is open (and after a reload). */
function TimerWatcher() {
  const s = useAppState()
  const now = useNow(1000)
  useEffect(() => {
    const t = getState().timer
    if (t && now - t.start >= t.planned * 60000) completeTimer()
  }, [now, s.timer])
  return null
}

function LevelLine() {
  const s = useAppState()
  const info = levelInfo(xpTotal(s)), st = streak(s, todayStr())
  return (
    <div className="level-line">
      <span>Level <b>{info.level}</b> · {info.name} · <b className="num">{info.total.toLocaleString('en-CA')}</b> xp</span>
      <span className="thin"><span style={{ width: Math.round(info.pct * 100) + '%' }} /></span>
      <span className="note">{st.count ? `${st.count}-day streak` : 'No streak yet'}</span>
    </div>
  )
}

function Capture({ onPick }: { onPick: (k: 'due' | 'test' | 'class' | 'focus') => void }) {
  return (
    <div className="nav-group">
      <div className="nav-label">Quick capture</div>
      <div className="capture">
        <button type="button" onClick={() => onPick('due')}><I as={Plus} />New deadline</button>
        <button type="button" onClick={() => onPick('test')}><I as={CalendarPlus} />New exam</button>
        <button type="button" onClick={() => onPick('class')}><I as={ClipboardList} />New reading</button>
        <button type="button" onClick={() => onPick('focus')}><I as={TimerIcon} />Log focus time</button>
      </div>
    </div>
  )
}

function NavList({ route, onNavigate }: { route: Route; onNavigate?: () => void }) {
  return (
    <>
      <div className="nav-group">
        <div className="nav-label">Navigation</div>
        {[...NAV_ITEMS, ...MORE].map(x => (
          <a key={x.k} href={'#/' + x.k} aria-current={route.tab === x.k ? 'page' : undefined} onClick={onNavigate}><I as={x.icon} />{x.label}</a>
        ))}
      </div>
    </>
  )
}

export function App() {
  const r = useRoute()
  const s = useAppState()
  const [drawer, setDrawer] = useState(false)
  const [capture, setCapture] = useState<null | 'due' | 'test' | 'class' | 'focus'>(null)
  useEffect(() => { applyTheme(s.settings.theme) }, [s.settings.theme])
  useEffect(() => {
    const t = NAV_ITEMS.concat(MORE).find(x => x.k === r.tab)
    document.title = (t ? t.label : 'Dashboard') + ' · Berry Study'
  }, [r.tab])
  useEffect(() => { setDrawer(false) }, [r.tab, r.parts.join('/')])
  useEffect(() => { if (s.cal.connected) startAutoSync() }, [s.cal.connected])
  useEffect(() => on('capture', e => setCapture(e.k)), [])

  const body = (
    <>
      {r.tab === 'home' && <Dashboard />}
      {r.tab === 'schedule' && <Calendar parts={r.parts} />}
      {r.tab === 'study' && <Courses parts={r.parts} />}
      {r.tab === 'garden' && <Focus parts={r.parts} />}
      {r.tab === 'grades' && <Grades />}
      {r.tab === 'settings' && <Settings parts={r.parts} />}
    </>
  )
  return (
    <div className="app">
      <a href="#main" className="sr-only skip">Skip to content</a>
      <aside className="side">
        <a className="wordmark" href="#/home">Berry Study<small>·</small></a>
        <Capture onPick={setCapture} />
        <NavList route={r} />
        <LevelLine />
        <div className="side-foot"><span className="script">Small steps,<br />most days.</span></div>
      </aside>

      <header className="topbar">
        <a className="wordmark" href="#/home">Berry Study</a>
        <button type="button" className="icon-btn" aria-label="Menu" aria-expanded={drawer} onClick={() => setDrawer(true)}><I as={Menu} size={22} /></button>
      </header>

      <main className="main" id="main">{body}</main>

      <nav className="bottombar" aria-label="Main">
        {NAV_ITEMS.map(x => <a key={x.k} href={'#/' + x.k} aria-current={r.tab === x.k ? 'page' : undefined}><I as={x.icon} size={20} /><span>{x.label}</span></a>)}
      </nav>

      {drawer && (
        <>
          <div className="drawer-back" onClick={() => setDrawer(false)} />
          <div className="drawer" role="dialog" aria-label="Menu">
            <div className="row-between"><span className="wordmark">Berry Study</span><button type="button" className="icon-btn" aria-label="Close menu" onClick={() => setDrawer(false)}><I as={X} size={20} /></button></div>
            <Capture onPick={k => { setDrawer(false); setCapture(k) }} />
            <NavList route={r} onNavigate={() => setDrawer(false)} />
            <LevelLine />
          </div>
        </>
      )}

      {capture && <QuickCapture kind={capture} onClose={() => setCapture(null)} />}
      <TimerWatcher />
      <Toasts /><XpFloats /><LevelUpToasts />
    </div>
  )
}
