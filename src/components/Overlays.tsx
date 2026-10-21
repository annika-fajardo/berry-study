/* Global reactions: toasts with undo, floating "+XP", Berry peeking in, level-up celebration. */
import { useEffect, useState } from 'react'
import { on, type Mood, type Toast } from '../lib/events'
import { Berry, TuxCat, Sparkle } from './Characters'
import { useAppState } from '../store/store'
import { levelInfo, xpTotal } from '../lib/game'

export function Toasts() {
  const [list, setList] = useState<Toast[]>([])
  useEffect(() => on('toast', t => {
    setList(l => [...l.slice(-2), t])
    setTimeout(() => setList(l => l.filter(x => x.id !== t.id)), t.ms ?? (t.action ? 6000 : 3200))
  }), [])
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map(t => (
        <div className="toast" key={t.id}>
          <span>{t.text}</span>
          {t.action && <button type="button" className="btn sm" onClick={() => { t.action!(); setList(l => l.filter(x => x.id !== t.id)) }}>{t.actionLabel || 'Undo'}</button>}
        </div>
      ))}
    </div>
  )
}

export function XpFloats() {
  const [f, setF] = useState<{ id: number; amount: number; x: number; y: number }[]>([])
  useEffect(() => {
    let n = 0
    return on('xp', e => {
      const id = ++n
      setF(l => [...l, { id, ...e, x: Math.min(window.innerWidth - 40, Math.max(40, e.x)), y: Math.max(60, e.y - 10) }])
      setTimeout(() => setF(l => l.filter(x => x.id !== id)), 1300)
    })
  }, [])
  return <>{f.map(x => <div key={x.id} className="xpfloat" style={{ left: x.x, top: x.y }} aria-hidden="true">+{x.amount}</div>)}</>
}

export function BerryBuddy() {
  const [m, setM] = useState<{ mood: Mood; k: number } | null>(null)
  useEffect(() => {
    let k = 0, t: ReturnType<typeof setTimeout>
    const off = on('berry', e => {
      if (e.mood !== 'cheering' && e.mood !== 'proud') return
      clearTimeout(t); setM({ mood: e.mood, k: ++k }); t = setTimeout(() => setM(null), 1900)
    })
    return () => { off(); clearTimeout(t) }
  }, [])
  if (!m) return null
  return <div className="berry-buddy" key={m.k} aria-hidden="true"><Berry mood={m.mood} size={84} bounce /></div>
}

const CONF = ['#C66F80', '#F4C7D0', '#FCEBF1', '#4A6644', '#9FAA74', '#D7DAB3', '#ECE3D2']
export function LevelUp() {
  const s = useAppState()
  const [lv, setLv] = useState<{ level: number; name: string } | null>(null)
  useEffect(() => on('levelup', e => setLv(e)), [])
  useEffect(() => {
    if (!lv) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter') setLv(null) }
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k)
  }, [lv])
  if (!lv) return null
  const info = levelInfo(xpTotal(s))
  const bits = Array.from({ length: 70 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 14) * 0.12, dur: 2.4 + (i % 5) * 0.4, c: CONF[i % CONF.length], r: (i * 47) % 360, round: i % 3 === 0 }))
  return (
    <div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="lv-title" onClick={() => setLv(null)}>
      <div className="confetti" aria-hidden="true">
        {bits.map((b, i) => <i key={i} style={{ left: b.left + '%', background: b.c, animationDelay: b.delay + 's', animationDuration: b.dur + 's', transform: `rotate(${b.r}deg)`, borderRadius: b.round ? '50%' : 3 }} />)}
      </div>
      <div className="panel" onClick={e => e.stopPropagation()}>
        <svg width="0" height="0" aria-hidden="true" />
        <div className="eyebrow">Level up</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0 }}>
          <Berry mood="proud" size={130} bounce />
          <TuxCat pose="jump" size={120} name={s.settings.catName} style={{ marginLeft: -18 }} />
        </div>
        <div className="big" id="lv-title">{lv.name}</div>
        <div className="lc-sub" style={{ fontWeight: 700 }}>lv. {lv.level} <span className="note">({info.total.toLocaleString('en-CA')} xp)</span></div>
        <p className="note">{s.settings.catName} came out to celebrate. Keep showing up: next level at {info.next.toLocaleString('en-CA')} xp.</p>
        <svg viewBox="0 0 120 24" width="160" height="32" aria-hidden="true"><Sparkle x={14} y={12} s={9} /><Sparkle x={60} y={12} s={7} /><Sparkle x={106} y={12} s={9} /></svg>
        <button type="button" className="btn berry" autoFocus onClick={() => setLv(null)}>Yay, keep going</button>
      </div>
    </div>
  )
}
