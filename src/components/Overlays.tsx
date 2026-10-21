/* Global feedback: toasts (with undo, and a small cat for level-ups), and the tiny "+N xp" fade. */
import { useEffect, useState } from 'react'
import { on, toast, type Toast } from '../lib/events'
import { Cat } from './Cat'
import { useAppState } from '../store/store'
import { levelInfo, xpTotal } from '../lib/game'

export function Toasts() {
  const [list, setList] = useState<Toast[]>([])
  useEffect(() => on('toast', t => {
    setList(l => [...l.slice(-2), t])
    setTimeout(() => setList(l => l.filter(x => x.id !== t.id)), t.ms ?? (t.action ? 6000 : 3400))
  }), [])
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map(t => (
        <div className={'toast' + (t.cat ? ' has-cat' : '')} key={t.id}>
          {t.cat && <Cat status={t.cat === 'proud' ? 'proud' : t.cat} size={40} />}
          <span className="grow">{t.text}</span>
          {t.action && <button type="button" className="btn quiet sm" onClick={() => { t.action!(); setList(l => l.filter(x => x.id !== t.id)) }}>{t.actionLabel || 'Undo'}</button>}
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
      setF(l => [...l, { id, ...e, x: Math.min(window.innerWidth - 30, Math.max(30, e.x)), y: Math.max(40, e.y - 14) }])
      setTimeout(() => setF(l => l.filter(x => x.id !== id)), 1150)
    })
  }, [])
  return <>{f.map(x => <div key={x.id} className="xpfloat" style={{ left: x.x, top: x.y }} aria-hidden="true">+{x.amount} xp</div>)}</>
}

/** Level-ups are a small toast with the cat sitting proudly. */
export function LevelUpToasts() {
  const s = useAppState()
  useEffect(() => on('levelup', e => {
    const info = levelInfo(xpTotal(s))
    toast(`Level ${e.level} · ${e.name}. Next level at ${info.next.toLocaleString('en-CA')} xp.`, { cat: 'proud', ms: 5200 })
  }), [s])
  return null
}
