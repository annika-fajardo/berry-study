import { useEffect, useState } from 'react'
import { useRoute, TABS } from './lib/router'
import { TabIcon, TAB_LABEL } from './components/Icons'
import { Toasts, XpFloats, BerryBuddy, LevelUp } from './components/Overlays'
import { Berry, TuxCat } from './components/Characters'
import { Modal } from './components/Modal'
import { Today } from './views/Today'
import { Schedule } from './views/Schedule'
import { Courses } from './views/Courses'
import { Focus } from './views/Focus'
import { Grades } from './views/Grades'
import { Settings, applyTheme } from './views/Settings'
import { useAppState, getState } from './store/store'
import { completeTimer, setSetting } from './store/actions'
import { useNow } from './lib/hooks'

/** Completes the focus timer when it runs out, on whichever tab is open (and after a reload). */
function TimerWatcher() {
  const s = useAppState()
  const now = useNow(1000)
  useEffect(() => {
    const t = getState().timer
    if (t && now - t.start >= t.planned * 60000) completeTimer()
  }, [now, s.timer])
  return null
}

function Onboarding() {
  const s = useAppState()
  const [name, setName] = useState('Tux')
  if (s.settings.onboarded) return null
  const done = () => { setSetting('catName', name.trim().slice(0, 24) || 'Tux'); setSetting('onboarded', true) }
  return (
    <Modal title="Welcome to Berry Study" onClose={done}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <Berry mood="cheering" size={110} /><TuxCat pose="sit" size={110} name={name || 'Tux'} style={{ marginLeft: -16 }} />
      </div>
      <p>Your Course Desk schedule, grades and practice history are already here. Berry will keep you company, and so will your tuxedo cat.</p>
      <form className="stack" onSubmit={e => { e.preventDefault(); done() }}>
        <label className="field">What's your cat's name?<input className="input" value={name} maxLength={24} onChange={e => setName(e.target.value)} autoFocus id="onboard-name" /></label>
        <div className="wrap" style={{ justifyContent: 'flex-end' }}><button type="submit" className="btn berry">Let's go</button></div>
      </form>
    </Modal>
  )
}

export function App() {
  const r = useRoute()
  const s = useAppState()
  useEffect(() => { applyTheme(s.settings.theme) }, [s.settings.theme])
  useEffect(() => { document.title = TAB_LABEL[r.tab] + ' · Berry Study' }, [r.tab])
  const nav = (cls: string) => (
    <nav className={cls} aria-label="Main">
      {cls === 'rail' && <div className="wordmark" aria-label="Berry Study">berry<span>study</span></div>}
      {TABS.map(t => <a key={t} href={'#/' + t} aria-current={r.tab === t ? 'page' : undefined}><TabIcon name={t} /><span>{TAB_LABEL[t]}</span></a>)}
      {cls === 'rail' && <div className="rail-foot"><Berry mood={s.timer ? 'studying' : 'happy'} size={64} /><span>Works offline · data on this device</span></div>}
    </nav>
  )
  return (
    <div className="shell">
      <a href="#main" className="sr-only" onFocus={e => e.currentTarget.classList.remove('sr-only')} onBlur={e => e.currentTarget.classList.add('sr-only')}>Skip to content</a>
      {nav('rail')}
      <main className="main" id="main">
        {r.tab === 'today' && <Today />}
        {r.tab === 'schedule' && <Schedule />}
        {r.tab === 'courses' && <Courses parts={r.parts} />}
        {r.tab === 'focus' && <Focus parts={r.parts} />}
        {r.tab === 'grades' && <Grades />}
        {r.tab === 'settings' && <Settings />}
      </main>
      {nav('tabbar')}
      <TimerWatcher />
      <Toasts /><XpFloats /><BerryBuddy /><LevelUp /><Onboarding />
    </div>
  )
}
