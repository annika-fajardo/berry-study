/* Capture: one text field. Type "FNCE 445 quiz friday 20% ~3h" and it becomes correctable chips.
   Removing a chip returns its words to the title. Also handles the #/add?t= URL and dropped files. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { X, CornerDownLeft } from 'lucide-react'
import { Modal } from '../components/Modal'
import { COURSES, COURSE_KEYS } from '../data/courses'
import { todayStr } from '../lib/dates'
import { saveItem, logFlora } from '../store/actions'
import { update, getState } from '../store/store'
import { toast } from '../lib/events'
import { parseCapture, strip, fmtChip, type Chip, type Field } from '../lib/parse'
import { I } from '../components/ui'
import type { Kind } from '../store/types'

const KIND_LABEL: Record<Kind, string> = { test: 'Test', due: 'Deadline', class: 'Reading' }

export function QuickCapture({ initial, kind, onClose }: { initial?: string; kind?: 'due' | 'test' | 'class' | 'focus'; onClose: () => void }) {
  const [text, setText] = useState(initial || '')
  /** Chips the user removed by field, so the parser stops re-adding them. */
  const [dropped, setDropped] = useState<Field[]>([])
  const [override, setOverride] = useState<Partial<Record<Field, string>>>(() => (kind && kind !== 'focus' ? { kind } : {}))
  const [err, setErr] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  const s = getState()
  useEffect(() => { ref.current?.focus() }, [])

  const names = useMemo(() => Object.fromEntries(COURSE_KEYS.map(k => [k, COURSES[k].name])), [])
  const p = useMemo(() => parseCapture(text, { today: todayStr(), courseNames: names, lastCourse: s.settings.capture?.lastCourse }), [text, names])
  const chips: Chip[] = p.chips
    .filter(c => !dropped.includes(c.field))
    .map(c => (override[c.field] ? { ...c, value: override[c.field]!, label: c.field === 'date' ? fmtChip(override[c.field]!) : c.field === 'kind' ? KIND_LABEL[override[c.field] as Kind] : override[c.field]!, guessed: false } : c))
  for (const f of Object.keys(override) as Field[]) {
    if (chips.some(c => c.field === f) || dropped.includes(f)) continue
    const v = override[f]!
    chips.push({ field: f, value: v, label: f === 'date' ? fmtChip(v) : f === 'kind' ? KIND_LABEL[v as Kind] : v, start: -1, end: -1 })
  }
  const title = strip(text, p.chips.filter(c => !dropped.includes(c.field)))
  const val = (f: Field) => chips.find(c => c.field === f)?.value
  const removeChip = (c: Chip) => {
    // the words go back into the title, exactly as Todoist does it
    setDropped(d => [...d, c.field])
    setOverride(o => { const n = { ...o }; delete n[c.field]; return n })
  }

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!title.trim()) { setErr('Give it a title.'); return }
    const c = val('course') || s.settings.capture?.lastCourse || 'FNCE 445'
    saveItem(null, {
      c, k: (val('kind') as Kind) || 'due', t: title.trim(), d: val('date') || todayStr(),
      w: val('weight') || '', n: '', effort: val('effort') || '',
    })
    update(d => { d.settings.capture = { lastCourse: c } })
    toast('Added: ' + title.trim())
    onClose()
  }

  if (kind === 'focus') return <FocusLog onClose={onClose} />
  return (
    <Modal title="Add" onClose={onClose}>
      <form onSubmit={submit} className="stack" style={{ gap: 10 }}>
        {chips.length > 0 && (
          <div className="chips-row" aria-label="What I understood">
            {chips.map(c => (
              <span key={c.field} className={'pchip pchip-' + c.field + (c.guessed ? ' guessed' : '')}>
                {c.field === 'course' && <span className="dot" style={{ background: COURSES[c.value]?.color || 'var(--sage)' }} />}
                <button type="button" className="pchip-body" onClick={() => {
                  if (c.field === 'course') { const i = COURSE_KEYS.indexOf(c.value); setOverride(o => ({ ...o, course: COURSE_KEYS[(i + 1) % COURSE_KEYS.length] })) }
                  if (c.field === 'kind') { const order: Kind[] = ['due', 'test', 'class']; const i = order.indexOf(c.value as Kind); setOverride(o => ({ ...o, kind: order[(i + 1) % order.length] })) }
                }}>{c.label}</button>
                {c.field === 'date' && <input className="pchip-date" type="date" value={c.value} aria-label="Change the date" onChange={e => setOverride(o => ({ ...o, date: e.target.value }))} />}
                <button type="button" className="pchip-x" aria-label={'Remove ' + c.label} onClick={() => removeChip(c)}><I as={X} size={12} /></button>
              </span>
            ))}
          </div>
        )}
        <input ref={ref} className="input capture-input" id="capture" value={text} placeholder="FNCE 445 quiz friday 20% ~3h"
          aria-label="What do you want to add?" onChange={e => { setText(e.target.value); setErr('') }} />
        <div className="row-between">
          <span className="note">{title ? <>Title: <b>{title}</b></> : 'Type it the way you\'d say it.'}</span>
          <button type="submit" className="btn sm"><I as={CornerDownLeft} size={14} />Add</button>
        </div>
        {err && <p className="bad" role="alert">{err}</p>}
      </form>
    </Modal>
  )
}

function FocusLog({ onClose }: { onClose: () => void }) {
  const [c, setC] = useState('FNCE 445')
  const [m, setM] = useState('25')
  const [d, setD] = useState(todayStr())
  const [err, setErr] = useState('')
  return (
    <Modal title="Log focus time" onClose={onClose}>
      <form className="form-grid" onSubmit={e => {
        e.preventDefault()
        const n = Number(m)
        if (!Number.isFinite(n) || n < 1 || n > 600) { setErr('Enter minutes between 1 and 600.'); return }
        logFlora(c, Math.round(n), d); onClose()
      }}>
        <label className="field">Minutes<input className="input" id="qc-min" type="number" min={1} max={600} inputMode="numeric" value={m} onChange={e => setM(e.target.value)} autoFocus /></label>
        <label className="field">Course<select className="input" value={c} onChange={e => setC(e.target.value)}>{COURSE_KEYS.map(k => <option key={k}>{k}</option>)}</select></label>
        <label className="field">Date<input className="input" type="date" value={d} max={todayStr()} onChange={e => setD(e.target.value)} /></label>
        {err && <p className="wide bad" role="alert">{err}</p>}
        <div className="wide wrap" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn quiet" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn">Log it</button>
        </div>
      </form>
    </Modal>
  )
}
