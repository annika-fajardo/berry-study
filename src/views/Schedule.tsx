import { useState } from 'react'
import { useData, useToday } from '../lib/hooks'
import { agenda, prioritize, stripStats, type Filter } from '../lib/schedule'
import { COURSES, COURSE_KEYS, KIND, courseColor } from '../data/courses'
import { fmt, parse, todayStr } from '../lib/dates'
import { setItemDone, saveItem, deleteItem, type ItemDraft } from '../store/actions'
import { toast } from '../lib/events'
import { Modal, Confirm } from '../components/Modal'
import type { Item, Kind } from '../store/types'

let savedFilter: Filter = { course: 'all', major: false, past: false, done: false }

export function Schedule() {
  const { items } = useData()
  const t = useToday()
  const [filter, setFilterState] = useState<Filter>(savedFilter)
  const [leaving, setLeaving] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const setFilter = (f: Filter) => { savedFilter = f; setFilterState(f) }
  const flagged = new Set(prioritize(items, t).filter(p => p.urg === 'u-red').map(p => p.i.id))
  const { weeks, tbd } = agenda(items, filter, t)
  const { wk, next, late } = stripStats(items, t)

  function toggle(i: Item, done: boolean) {
    if (done && !filter.done) {
      setLeaving(s => new Set(s).add(i.id))
      setTimeout(() => {
        const g = setItemDone(i.id, true)
        setLeaving(s => { const n = new Set(s); n.delete(i.id); return n })
        toast(`Done: ${i.t}${g ? ' · +' + g + ' XP' : ''}`, { actionLabel: 'Undo', action: () => setItemDone(i.id, false) })
      }, 280)
    } else {
      const g = setItemDone(i.id, done)
      if (done) toast(`Done: ${i.t}${g ? ' · +' + g + ' XP' : ''}`, { actionLabel: 'Undo', action: () => setItemDone(i.id, false) })
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
        </div>
        <div className="meta">
          <span className={'sticker ' + kb[1]}>{kb[0]}</span>
          {i.w && <span className="w">{i.w}</span>}
          <button type="button" className="edbtn" aria-label={'Edit ' + i.t} onClick={() => setEditing(i)}>Edit</button>
        </div>
      </div>
    )
  }

  const chip = (label: string, pressed: boolean, onClick: () => void, color?: string) => (
    <button type="button" className="chip" aria-pressed={pressed} onClick={onClick}>{color && <span className="dot" style={{ background: color }} />}{label}</button>
  )

  return (
    <div className="page">
      <header className="row-between">
        <div><div className="eyebrow">Haskayne · Fall 2026</div><h1 className="display">Schedule</h1></div>
        <button type="button" className="btn berry" onClick={() => setEditing('new')}>+ Add item</button>
      </header>
      <div className="stats" aria-label="Summary">
        <div className={'stat' + (wk.length >= 4 ? ' hot' : '')}><b>{wk.length}</b><span>graded items in the next 7 days</span></div>
        <div className="stat"><b>{next ? fmt(parse(next.d!), { month: 'short', day: 'numeric' }) : 'None'}</b><span>{next ? 'Next test: ' + next.c + ' · ' + next.t : 'No tests ahead'}</span></div>
        <div className={'stat' + (late.length ? ' hot' : '')}><b>{late.length}</b><span>{late.length ? 'past-due items not ticked off' : 'nothing past due'}</span></div>
      </div>
      <div className="wrap" role="toolbar" aria-label="Filters">
        {chip('All courses', filter.course === 'all', () => setFilter({ ...filter, course: 'all' }))}
        {COURSE_KEYS.map(k => <span key={k}>{chip(k, filter.course === k, () => setFilter({ ...filter, course: k }), COURSES[k].color)}</span>)}
        <span className="sep" aria-hidden="true" />
        {chip('Graded only', filter.major, () => setFilter({ ...filter, major: !filter.major }))}
        {chip('Show past', filter.past, () => setFilter({ ...filter, past: !filter.past }))}
        {chip('Show completed', filter.done, () => setFilter({ ...filter, done: !filter.done }))}
      </div>
      <div className="stack" style={{ gap: 28 }} id="agenda">
        {weeks.map(w => (
          <section className="week" key={w.key}>
            <div className="week-h"><h2>{w.label}</h2><span className="eyebrow">{w.gradedOpen ? w.gradedOpen + ' graded open' : 'no graded items open'}</span></div>
            {w.termBreak && <p className="tip green">Term break Nov 8–14. No classes.</p>}
            {w.items.map(row)}
          </section>
        ))}
        {tbd.length > 0 && <section className="week"><div className="week-h"><h2>Date to be set</h2></div>{tbd.map(row)}</section>}
        {!weeks.length && !tbd.length && <p className="empty">{items.length ? 'Nothing matches these filters.' : 'No items yet.'}</p>}
      </div>
      <section className="card flags-card" style={{ borderColor: 'var(--due)' }}>
        <h2 className="h2">Confirm with your profs</h2>
        <ul>
          <li><b>SGMA 591 ICA:</b> the grade table says Oct 18; the assignment section says Oct 25. The tracker uses Oct 18 until you confirm.</li>
          <li><b>FNCE 477 quizzes:</b> the outline says 7 in one place and 8 in another. The schedule lists 7.</li>
          <li><b>Finals:</b> FNCE 445 (35%) and MGST 451 (30%) dates come from the Registrar.</li>
        </ul>
      </section>
      {editing && <ItemEditor item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ItemEditor({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const [x, setX] = useState<ItemDraft>(() => ({ c: item?.c || 'FNCE 445', k: item?.k || 'due', t: item?.t || '', d: item ? item.d || '' : todayStr(), w: item?.w || '', n: item?.n || '' }))
  const [msg, setMsg] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => setX(o => ({ ...o, [k]: v }))
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!x.t.trim()) { setMsg('Give it a title.'); (document.getElementById('ed-t') as HTMLInputElement)?.focus(); return }
    saveItem(item ? item.id : null, x); toast(item ? 'Updated.' : 'Added.'); onClose()
  }
  if (confirmDel && item) return <Confirm title="Delete this item?" body={<p>“{item.t}” ({item.c}) will be removed from your schedule. You can undo right after.</p>} confirmLabel="Delete" danger onCancel={() => setConfirmDel(false)} onConfirm={() => { deleteItem(item.id); onClose() }} />
  return (
    <Modal title={item ? 'Edit item' : 'Add an item'} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <label className="field">Course<select className="input" value={x.c} onChange={e => set('c', e.target.value)}>{COURSE_KEYS.map(k => <option key={k}>{k}</option>)}</select></label>
        <label className="field">Type<select className="input" value={x.k} onChange={e => set('k', e.target.value as Kind)}><option value="test">Test or exam</option><option value="due">Deadline</option><option value="class">Class prep or reading</option></select></label>
        <label className="field">Date<input className="input" type="date" value={x.d} onChange={e => set('d', e.target.value)} /></label>
        <label className="field">Weight<input className="input" value={x.w} placeholder="e.g. 10%" onChange={e => set('w', e.target.value)} /></label>
        <label className="field wide">Title<input className="input" id="ed-t" value={x.t} placeholder="e.g. Quiz 5" onChange={e => set('t', e.target.value)} autoFocus /></label>
        <label className="field wide">Notes<input className="input" value={x.n} placeholder="What it covers, where to submit" onChange={e => set('n', e.target.value)} /></label>
        {msg && <p className="wide bad" role="alert">{msg}</p>}
        <div className="wide wrap" style={{ justifyContent: 'space-between' }}>
          {item ? <button type="button" className="btn ghost" onClick={() => setConfirmDel(true)}>Delete</button> : <span />}
          <div className="wrap"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button type="submit" className="btn">Save</button></div>
        </div>
      </form>
    </Modal>
  )
}
