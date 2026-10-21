/* Quick capture: add a deadline, exam or reading, or log focus time, from anywhere. */
import { useState } from 'react'
import { Modal } from '../components/Modal'
import { COURSE_KEYS } from '../data/courses'
import { todayStr } from '../lib/dates'
import { saveItem, logFlora, type ItemDraft } from '../store/actions'
import { toast } from '../lib/events'
import type { Kind } from '../store/types'

const TITLE: Record<string, string> = { due: 'New deadline', test: 'New exam', class: 'New reading', focus: 'Log focus time' }

export function QuickCapture({ kind, onClose }: { kind: 'due' | 'test' | 'class' | 'focus'; onClose: () => void }) {
  const [x, setX] = useState<ItemDraft>(() => ({ c: 'FNCE 445', k: (kind === 'focus' ? 'due' : kind) as Kind, t: '', d: todayStr(), w: '', n: '', effort: '' }))
  const [mins, setMins] = useState('25')
  const [err, setErr] = useState('')
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => setX(o => ({ ...o, [k]: v }))
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (kind === 'focus') {
      const n = Number(mins)
      if (!Number.isFinite(n) || n < 1 || n > 600) { setErr('Enter minutes between 1 and 600.'); return }
      logFlora(x.c, Math.round(n), x.d); onClose(); return
    }
    if (!x.t.trim()) { setErr('Give it a title.'); return }
    saveItem(null, x); toast('Added to your calendar.'); onClose()
  }
  return (
    <Modal title={TITLE[kind]} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <label className="field">Course<select className="input" value={x.c} onChange={e => set('c', e.target.value)}>{COURSE_KEYS.map(k => <option key={k}>{k}</option>)}</select></label>
        <label className="field">Date<input className="input" type="date" value={x.d} max={kind === 'focus' ? todayStr() : undefined} onChange={e => set('d', e.target.value)} /></label>
        {kind === 'focus' ? (
          <label className="field">Minutes<input className="input" id="qc-min" type="number" min={1} max={600} inputMode="numeric" value={mins} onChange={e => setMins(e.target.value)} /></label>
        ) : (
          <>
            <label className="field">Weight<input className="input" value={x.w} placeholder="e.g. 10%" onChange={e => set('w', e.target.value)} /></label>
            <label className="field wide">Title<input className="input" id="qc-title" autoFocus value={x.t} placeholder={kind === 'test' ? 'e.g. Quiz 6' : kind === 'class' ? 'e.g. Read Ch 7' : 'e.g. Assignment 3'} onChange={e => set('t', e.target.value)} /></label>
            <label className="field wide">Notes<input className="input" value={x.n} placeholder="What it covers, where to submit" onChange={e => set('n', e.target.value)} /></label>
          </>
        )}
        {err && <p className="wide bad" role="alert">{err}</p>}
        <div className="wide wrap" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn quiet" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn">{kind === 'focus' ? 'Log it' : 'Add'}</button>
        </div>
      </form>
    </Modal>
  )
}
