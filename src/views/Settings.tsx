import { useRef, useState } from 'react'
import { useData } from '../lib/hooks'
import { setSetting } from '../store/actions'
import { getState, replaceState, flush, storageName } from '../store/store'
import { seedState } from '../store/seed'
import { makeBackup, backupFilename, parseBackup, mergeStates, summarize } from '../lib/backup'
import { levelInfo, xpTotal, XP } from '../lib/game'
import { toast } from '../lib/events'
import { Berry, TuxCat, Plant, type CatPose } from '../components/Characters'
import { Modal, Confirm } from '../components/Modal'
import type { AppState } from '../store/types'
import type { Mood } from '../lib/events'

export function applyTheme(t: string) {
  const r = document.documentElement
  if (t === 'light' || t === 'dark') r.setAttribute('data-theme', t); else r.removeAttribute('data-theme')
}

export function Settings() {
  const { s } = useData()
  const [name, setName] = useState(s.settings.catName)
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
  const pickFile = async (f: File | undefined) => {
    setErr('')
    if (!f) return
    try { const st = parseBackup(await f.text()); setPending({ state: st, file: f.name }) }
    catch (e) { setErr((e as Error).message || "Couldn't read that file.") }
    if (fileRef.current) fileRef.current.value = ''
  }
  const doImport = (mode: 'replace' | 'merge') => {
    if (!pending) return
    const cur = getState()
    const next = mode === 'replace' ? { ...pending.state, settings: pending.state.settings } : mergeStates(cur, pending.state)
    replaceState(next); applyTheme(next.settings.theme); try { localStorage.setItem('berry-theme', next.settings.theme) } catch { /* ignore */ }
    setName(next.settings.catName); setPending(null)
    toast(mode === 'replace' ? 'Backup restored.' : 'Backup merged in.')
  }

  return (
    <div className="page">
      <header><div className="eyebrow">Make it yours</div><h1 className="display">Settings</h1></header>
      <div className="grid2">
        <section className="card" aria-labelledby="ap-h">
          <h2 className="h3" id="ap-h">Appearance</h2>
          <div className="seg-toggle" role="radiogroup" aria-label="Theme">
            {(['auto', 'light', 'dark'] as const).map(t => <button key={t} type="button" role="radio" aria-checked={s.settings.theme === t} onClick={() => { setSetting('theme', t); applyTheme(t) }}>{t === 'auto' ? 'Auto' : t === 'light' ? 'Light' : 'Dark'}</button>)}
          </div>
          <p className="note">Auto follows your device. Dark is “matcha latte at night”.</p>
        </section>
        <section className="card" aria-labelledby="cat-h">
          <h2 className="h3" id="cat-h">Your cat</h2>
          <div className="row-between" style={{ alignItems: 'flex-end' }}>
            <form className="wrap" style={{ flex: '1 1 200px' }} onSubmit={e => { e.preventDefault(); const n = name.trim() || 'Tux'; setSetting('catName', n.slice(0, 24)); setName(n.slice(0, 24)); toast('Say hi to ' + n.slice(0, 24) + '.') }}>
              <label className="field" style={{ flex: '1 1 140px' }}>Name<input className="input" value={name} maxLength={24} onChange={e => setName(e.target.value)} /></label>
              <button type="submit" className="btn sm" style={{ alignSelf: 'flex-end' }}>Save</button>
            </form>
            <TuxCat pose="sit" size={86} name={s.settings.catName} />
          </div>
        </section>
      </div>

      <section className="card bold" aria-labelledby="data-h">
        <h2 className="h3" id="data-h">Your data</h2>
        <p><b>Everything lives on this device</b>, in this browser's storage ({storageName()}). Nothing is sent anywhere. To move to another device or browser: <b>Export</b> here, send yourself the file, then <b>Import</b> it on the other device.</p>
        <p className="note">Right now: {sum.items} schedule items, {sum.grades} grade rows, {sum.practice} practice records, {sum.sessions} garden plants, {sum.xp} XP entries ({info.total.toLocaleString('en-CA')} xp, level {info.level}).</p>
        <div className="wrap">
          <button type="button" className="btn" onClick={exportData}>Export data (JSON)</button>
          <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>Import data…</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Choose a backup file to import" onChange={e => pickFile(e.target.files?.[0])} data-testid="import-input" tabIndex={-1} />
          <button type="button" className="btn ghost" onClick={() => setReset(true)}>Reset to seed…</button>
        </div>
        {err && <p className="bad" role="alert">{err}</p>}
        <p className="note">Tip: export now and then as a backup, especially before clearing your browser data. Clearing site data for this page deletes everything stored here.</p>
      </section>

      <section className="card" aria-labelledby="xp-h">
        <h2 className="h3" id="xp-h">How XP works</h2>
        <p className="note">Ticking a task: class prep 5, deadline 15, test 25, plus 1 per weight-% (bonus capped at 30); un-ticking takes it back. Each correct quiz or drill answer {XP.correct} (+{XP.firstTry} first try on the practice set and assignment checks), a clean quiz round or deck +{XP.cleanRound}, and {XP.perMinute} XP per focus or Flora minute. Your Course Desk history (done tasks, past correct answers, study time) was turned into XP on first launch.</p>
        <details>
          <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', fontWeight: 800 }}>XP ledger ({Object.keys(s.xp).length} entries)</summary>
          <ul className="ledger">
            {Object.values(s.xp).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 200).map(e => <li key={e.id}><span>{e.date} · {e.reason}</span><b>+{e.amount}</b></li>)}
          </ul>
        </details>
      </section>

      <section className="card" aria-labelledby="about-h">
        <h2 className="h3" id="about-h">About Berry Study</h2>
        <p>A cozy study planner for Fall 2026 at Haskayne: your schedule and priorities, projected GPA, course practice in the real quiz format, a focus timer that grows a garden, and a level card for showing up. It works offline and installs to your home screen. There are no AI features in this version.</p>
        <div className="gallery" aria-label="Meet the characters">
          {(['happy', 'cheering', 'studying', 'proud', 'sleepy', 'worried'] as Mood[]).map(m => <figure key={m}><Berry mood={m} size={64} /><figcaption>{m}</figcaption></figure>)}
        </div>
        <div className="gallery">
          {(['sit', 'loaf', 'sleep', 'stretch', 'jump'] as CatPose[]).map(p => <figure key={p}><TuxCat pose={p} size={84} name={s.settings.catName} /><figcaption>{p}</figcaption></figure>)}
          <figure><Plant kind="flower" size={52} /><figcaption>under 25 min</figcaption></figure>
          <figure><Plant kind="strawberry" size={52} /><figcaption>25+ min</figcaption></figure>
          <figure><Plant kind="matcha" size={52} /><figcaption>50+ min</figcaption></figure>
          <figure><Plant kind="strawberry" wilted size={52} /><figcaption>wilted</figcaption></figure>
        </div>
        <p className="note">Version 1.0 · data schema v{s.schema} · Berry and {s.settings.catName} are original illustrations.</p>
      </section>

      {pending && (
        <Modal title="Import this backup?" onClose={() => setPending(null)}>
          <p><b>{pending.file}</b>: {(() => { const x = summarize(pending.state); return `${x.items} schedule items, ${x.grades} grade rows, ${x.practice} practice records, ${x.sessions} plants, ${x.xp} XP entries` })()}.</p>
          <p className="note"><b>Replace</b> swaps everything on this device for the backup. <b>Merge</b> keeps what's here and adds the backup's records (the backup wins where the same record exists in both).</p>
          <div className="wrap" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn ghost" onClick={() => setPending(null)}>Cancel</button>
            <button type="button" className="btn ghost" onClick={() => doImport('merge')}>Merge</button>
            <button type="button" className="btn berry" onClick={() => doImport('replace')}>Replace</button>
          </div>
        </Modal>
      )}
      {reset && <Confirm title="Reset to the original data?" body={<p>This replaces everything on this device with the Course Desk data you started with. Ticks, marks, XP and plants added since then are lost unless you export first. Your theme and cat's name stay.</p>} confirmLabel="Reset" danger onCancel={() => setReset(false)}
        onConfirm={() => { const keep = getState().settings; const n = seedState(); n.settings = { ...keep }; replaceState(n); setReset(false); toast('Reset to the original data.') }} />}
    </div>
  )
}
