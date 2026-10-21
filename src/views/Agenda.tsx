/* Agenda: the old list view, grouped by week, with filters and tick-to-complete. */
import { useState } from 'react'
import { useData, useToday } from '../lib/hooks'
import { agenda, prioritize, type Filter } from '../lib/schedule'
import { COURSES, COURSE_KEYS, KIND, courseColor } from '../data/courses'
import { fmt, parse } from '../lib/dates'
import { setItemDone, deleteItem, saveItem, type ItemDraft } from '../store/actions'
import { toast } from '../lib/events'
import { Modal, Confirm } from '../components/Modal'
import { Empty, I } from '../components/ui'
import { Pencil } from 'lucide-react'
import { FitChip } from './RightNow'
import { effortHours } from '../lib/scheduler'
import type { Item, Kind } from '../store/types'

let saved: Filter = { course: 'all', major: false, past: false, done: false }

export function Agenda() {
  const { items } = useData()
  const t = useToday()
  const [filter, setF] = useState<Filter>(saved)
  const [leaving, setLeaving] = useState<Set<string>>(new Set())
  const [edit, setEdit] = useState<Item | null>(null)
  const set = (f: Filter) => { saved = f; setF(f) }
  const flagged = new Set(prioritize(items, t).filter(p => p.urg === 'u-red').map(p => p.i.id))
  const { weeks, tbd } = agenda(items, filter, t)

  const toggle = (i: Item, done: boolean) => {
    if (done && !filter.done) {
      setLeaving(s => new Set(s).add(i.id))
      setTimeout(() => {
        const g = setItemDone(i.id, true)
        setLeaving(s => { const n = new Set(s); n.delete(i.id); return n })
        toast(`Done: ${i.t}${g ? ' · +' + g + ' xp' : ''}`, { actionLabel: 'Undo', action: () => setItemDone(i.id, false) })
      }, 240)
    } else {
      const g = setItemDone(i.id, done)
      if (done) toast(`Done: ${i.t}${g ? ' · +' + g + ' xp' : ''}`, { actionLabel: 'Undo', action: () => setItemDone(i.id, false) })
    }
  }
  const row = (i: Item) => {
    const kb = KIND[i.k] || KIND.class
    return (
      <div key={i.id} className={'row' + (i.done ? ' done' : '') + (i.d === t ? ' today' : '') + (flagged.has(i.id) ? ' flagged' : '') + (leaving.has(i.id) ? ' leaving' : '')} data-item={i.id}>
        <input type="checkbox" className="check" id={'cb-' + i.id} checked={!!i.done || leaving.has(i.id)} onChange={e => toggle(i, e.target.checked)} aria-label={'Mark done: ' + i.t} />
        <div className="date">{i.d ? <><strong>{fmt(parse(i.d), { month: 'short', day: 'numeric' })}</strong>{fmt(parse(i.d), { weekday: 'short' })}</> : <strong>TBD</strong>}</div>
        <div className="body">
          <div className="top"><span className="course-tag" style={{ color: courseColor(i.c) }}>{i.c}</span><label className="title" htmlFor={'cb-' + i.id}>{i.t}</label></div>
          {i.n && <div className="note">{i.n}</div>}
          <FitChip itemId={i.id} />
        </div>
        <div className="meta">
          <span className={'tag k-' + i.k}>{kb[0]}</span>
          {i.w && <span className="w">{i.w}</span>}
          <button type="button" className="edbtn" aria-label={'Edit ' + i.t} onClick={() => setEdit(i)}><I as={Pencil} size={13} /></button>
        </div>
      </div>
    )
  }
  const chip = (label: string, pressed: boolean, onClick: () => void, color?: string) => (
    <button type="button" className="chip" aria-pressed={pressed} onClick={onClick}>{color && <span className="dot" style={{ background: color }} />}{label}</button>
  )
  return (
    <>
      <div className="filters" role="toolbar" aria-label="Filters">
        {chip('All courses', filter.course === 'all', () => set({ ...filter, course: 'all' }))}
        {COURSE_KEYS.map(k => <span key={k}>{chip(k, filter.course === k, () => set({ ...filter, course: k }), COURSES[k].color)}</span>)}
        <span className="sep" />
        {chip('Graded only', filter.major, () => set({ ...filter, major: !filter.major }))}
        {chip('Show past', filter.past, () => set({ ...filter, past: !filter.past }))}
        {chip('Show completed', filter.done, () => set({ ...filter, done: !filter.done }))}
      </div>
      <div id="agenda">
        {weeks.map(w => (
          <section className="week" key={w.key}>
            <div className="week-h"><h3>{w.label}</h3><span className="eyebrow">{w.gradedOpen ? w.gradedOpen + ' graded open' : 'nothing graded open'}</span></div>
            {w.termBreak && <p className="tip">Term break Nov 8–14. No classes.</p>}
            {w.items.map(row)}
          </section>
        ))}
        {tbd.length > 0 && <section className="week"><div className="week-h"><h3>Date to be set</h3></div>{tbd.map(row)}</section>}
        {!weeks.length && !tbd.length && <Empty>{items.length ? 'Nothing matches these filters.' : 'No items yet.'}</Empty>}
      </div>
      <p className="note" style={{ marginTop: 10 }}>Worth checking with your profs: the SGMA 591 ICA date (the grade table says Oct 18, the assignment section says Oct 25 — the tracker uses Oct 18); FNCE 477 quizzes (the outline says 7 in one place, 8 in another — the schedule lists 7); and the FNCE 445 and MGST 451 final dates, which come from the Registrar.</p>
      {edit && <ItemEditor item={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

export function ItemEditor({ item, onClose }: { item: Item; onClose: () => void }) {
  const [x, setX] = useState<ItemDraft>(() => ({ c: item.c, k: item.k, t: item.t, d: item.d || '', w: item.w || '', n: item.n || '', effort: item.effort != null ? String(item.effort) : '' }))
  const [msg, setMsg] = useState('')
  const [del, setDel] = useState(false)
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => setX(o => ({ ...o, [k]: v }))
  const auto = effortHours({ k: x.k, w: x.w })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!x.t.trim()) { setMsg('Give it a title.'); return }
    saveItem(item.id, x); toast('Updated.'); onClose()
  }
  if (del) return <Confirm title="Delete this item?" body={<p>“{item.t}” ({item.c}) will be removed. You can undo right after.</p>} confirmLabel="Delete" danger onCancel={() => setDel(false)} onConfirm={() => { deleteItem(item.id); onClose() }} />
  return (
    <Modal title="Edit item" onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <label className="field">Course<select className="input" value={x.c} onChange={e => set('c', e.target.value)}>{COURSE_KEYS.map(k => <option key={k}>{k}</option>)}</select></label>
        <label className="field">Type<select className="input" value={x.k} onChange={e => set('k', e.target.value as Kind)}><option value="test">Test or exam</option><option value="due">Deadline</option><option value="class">Class prep or reading</option></select></label>
        <label className="field">Date<input className="input" type="date" value={x.d} onChange={e => set('d', e.target.value)} /></label>
        <label className="field">Weight<input className="input" value={x.w} placeholder="e.g. 10%" onChange={e => set('w', e.target.value)} /></label>
        <label className="field wide">Title<input className="input" id="ed-t" value={x.t} onChange={e => set('t', e.target.value)} autoFocus /></label>
        <label className="field wide">Notes<input className="input" value={x.n} onChange={e => set('n', e.target.value)} /></label>
        <label className="field wide">Study time needed<input className="input" id="ed-effort" type="number" min={0} max={40} step="0.25" inputMode="decimal" placeholder={auto + ' h (worked out from the weight)'} value={x.effort} onChange={e => set('effort', e.target.value)} />
          <span className="note">Hours. Leave blank to use {auto} h, which is what the scheduler estimates.</span></label>
        {msg && <p className="wide bad" role="alert">{msg}</p>}
        <div className="wide wrap" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn quiet" onClick={() => setDel(true)}>Delete</button>
          <span className="wrap"><button type="button" className="btn quiet" onClick={onClose}>Cancel</button><button type="submit" className="btn">Save</button></span>
        </div>
      </form>
    </Modal>
  )
}
