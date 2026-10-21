/* Calendar: a real week/day time grid (7am–11pm, 15-minute snapping), a month view and the agenda list.
   Shows the app's deadlines as all-day chips, connected calendar events, accepted study blocks, and
   suggested blocks as dashed outlines with Accept / Skip. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, CalendarRange, List, Grid3x3, ChevronLeft, ChevronRight, Plus, Check, X, Trash2, Briefcase, GraduationCap } from 'lucide-react'
import { Panel, I, ViewTabs, PageHead, Empty, ReadyBar } from '../components/ui'
import { Modal, Confirm } from '../components/Modal'
import { useCal, acceptSuggestion, skipSuggestion, saveEvent, deleteEvent, type CalData } from '../lib/calendar'
import { useData, useToday, useNow } from '../lib/hooks'
import { readiness } from '../lib/readiness'
import { COURSE_KEYS, KIND, courseColor } from '../data/courses'
import { addDays, dateStr, fmt, parse, monday, todayStr } from '../lib/dates'
import { atMin, hhmm, minOfDay, timeRange, durMin, fromLocal, snap } from '../lib/time'
import type { Suggestion } from '../lib/scheduler'
import { toast } from '../lib/events'
import { go } from '../lib/router'
import type { CalEvent, Item } from '../store/types'
import { D2lPanel } from './D2lPanel'
import { Agenda } from './Agenda'

const DAY_START = 7 * 60, DAY_END = 23 * 60, PX = 0.92 // pixels per minute

type View = 'day' | 'week' | 'month' | 'agenda'
const VIEWS: { v: View; label: string; icon: typeof CalendarDays }[] = [
  { v: 'day', label: 'Day', icon: CalendarDays }, { v: 'week', label: 'Week', icon: CalendarRange },
  { v: 'month', label: 'Month', icon: Grid3x3 }, { v: 'agenda', label: 'Agenda', icon: List },
]

export function Calendar({ parts }: { parts: string[] }) {
  const t = useToday()
  const cal = useCal()
  const isPhone = typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches
  const urlView = VIEWS.find(v => v.v === parts[0])?.v
  const [view, setView] = useState<View>(urlView || (isPhone ? 'day' : 'week'))
  useEffect(() => { if (urlView && urlView !== view) setView(urlView) }, [urlView])
  const [anchor, setAnchor] = useState(t)
  const [edit, setEdit] = useState<null | { ev?: CalEvent & { id: string }; start?: string }>(null)
  const shift = (n: number) => setAnchor(a => addDays(a, view === 'month' ? 0 : view === 'week' ? 7 * n : n))
  const shiftMonth = (n: number) => { const d = parse(anchor); d.setMonth(d.getMonth() + n, 1); setAnchor(dateStr(d)) }

  const label = view === 'week' ? (() => { const m = dateStr(monday(parse(anchor))); return fmt(parse(m), { month: 'long', day: 'numeric' }) + ' – ' + fmt(parse(addDays(m, 6)), { day: 'numeric', month: parse(m).getMonth() === parse(addDays(m, 6)).getMonth() ? undefined : 'long' }) })()
    : view === 'month' ? fmt(parse(anchor), { month: 'long', year: 'numeric' })
    : fmt(parse(anchor), { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="page">
      <PageHead title="Calendar" desc="Your deadlines and exams, your connected calendars, and the study blocks Berry Study suggests." right={<button type="button" className="btn" onClick={() => setEdit({ start: atMin(anchor, 16 * 60) })}><I as={Plus} size={16} />New block</button>} />
      <Panel title={label} id="cal" right={
        <div className="cal-nav">
          <button type="button" className="icon-btn" aria-label="Previous" onClick={() => (view === 'month' ? shiftMonth(-1) : shift(-1))}><I as={ChevronLeft} size={18} /></button>
          <button type="button" className="btn quiet sm" onClick={() => setAnchor(t)}>Today</button>
          <button type="button" className="icon-btn" aria-label="Next" onClick={() => (view === 'month' ? shiftMonth(1) : shift(1))}><I as={ChevronRight} size={18} /></button>
        </div>}
        tabs={<ViewTabs value={view} onChange={v => { setView(v); go('schedule/' + v) }} options={VIEWS.map(x => ({ v: x.v, label: x.label, icon: x.icon }))} label="Calendar views" />}>
        {view === 'day' && <TimeGrid days={[anchor]} cal={cal} onNew={s => setEdit({ start: s })} onOpen={ev => setEdit({ ev })} />}
        {view === 'week' && <TimeGrid days={Array.from({ length: 7 }, (_, i) => addDays(dateStr(monday(parse(anchor))), i))} cal={cal} onNew={s => setEdit({ start: s })} onOpen={ev => setEdit({ ev })} />}
        {view === 'month' && <MonthGrid anchor={anchor} cal={cal} onPick={d => { setAnchor(d); setView('day'); go('schedule/day') }} />}
        {view === 'agenda' && <Agenda />}
      </Panel>
      {view !== 'agenda' && (
        <Panel title="Suggested study blocks" id="sg" right={<span className="note">{cal.sched.suggestions.length} suggested</span>}>
          {cal.sched.suggestions.length ? cal.sched.suggestions.slice(0, 8).map(x => <SuggestionRow key={x.key} sg={x} />)
            : <Empty status="busy">No free slots that fit your study window. Widen it in Settings, or mark fewer days as off.</Empty>}
        </Panel>
      )}
      <D2lPanel />
      {edit && <EventEditor ev={edit.ev} start={edit.start} onClose={() => setEdit(null)} />}
    </div>
  )
}

/* ---------------- time grid ---------------- */
type Block = { key: string; start: string; end: string; title: string; sub?: string; cls: string; c?: string; onClick?: () => void }
function layout(blocks: Block[]) {
  const sorted = [...blocks].sort((a, b) => a.start.localeCompare(b.start))
  const cols: Block[][] = []
  const out: (Block & { col: number; cols: number })[] = []
  const groups: Block[][] = []
  let cur: Block[] = []
  let curEnd = ''
  for (const b of sorted) {
    if (cur.length && b.start >= curEnd) { groups.push(cur); cur = [] ; curEnd = '' }
    cur.push(b); if (b.end > curEnd) curEnd = b.end
  }
  if (cur.length) groups.push(cur)
  for (const g of groups) {
    const lanes: string[] = []
    const placed: (Block & { col: number })[] = []
    for (const b of g) {
      let k = lanes.findIndex(end => end <= b.start)
      if (k === -1) { k = lanes.length; lanes.push(b.end) } else lanes[k] = b.end
      placed.push({ ...b, col: k })
    }
    for (const b of placed) out.push({ ...b, cols: lanes.length })
  }
  void cols
  return out
}

export function TimeGrid({ days, cal, onNew, onOpen }: { days: string[]; cal: CalData; onNew: (start: string) => void; onOpen: (ev: CalEvent & { id: string }) => void }) {
  const { s, items } = useData()
  const t = useToday()
  const now = useNow(60000)
  const gridRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (gridRef.current) gridRef.current.scrollTop = Math.max(0, (8 * 60 - DAY_START) * PX - 20) }, [])
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START + i * 60)
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes()

  return (
    <div className={'tgrid-wrap' + (days.length === 1 ? ' single' : '')}>
      <div className="tgrid-head">
        <div className="tg-gutter" />
        {days.map(d => {
          const info = cal.sched.days[d]
          const chips = items.filter(i => i.d === d && !i.done)
          const ext = cal.ext.filter(e => e.allDay && e.start.slice(0, 10) <= d && e.end.slice(0, 10) >= d)
          return (
            <div key={d} className={'tg-dh' + (d === t ? ' today' : '')}>
              <span className="dow">{fmt(parse(d), { weekday: 'short' })}</span>
              <b>{parse(d).getDate()}</b>
              <div className="allday">
                {chips.map(i => <ItemChip key={i.id} item={i} days={days.length} />)}
                {ext.map(e => <span key={e.id} className={'chip-ad' + (e.d2l ? ' d2l' : '')} title={e.title}>{e.d2l && <I as={GraduationCap} size={12} />}{e.title}</span>)}
                {info?.heavy && <span className="chip-ad work"><I as={Briefcase} size={12} />Shift day: light review only</span>}
              </div>
            </div>
          )
        })}
      </div>
      <div className="tgrid" ref={gridRef}>
        <div className="tg-inner" style={{ height: (DAY_END - DAY_START) * PX }}>
          <div className="tg-gutter">
            {hours.map(h => <div key={h} className="tg-hour" style={{ top: (h - DAY_START) * PX }}>{hhmm(h)}</div>)}
          </div>
          {days.map(d => {
            const blocks: Block[] = []
            for (const e of cal.ext) {
              if (e.allDay || e.d2l || e.berry || e.start.slice(0, 10) !== d) continue
              blocks.push({ key: e.id, start: e.start, end: e.end, title: e.title, cls: 'ext' + (e.work ? ' work' : ''), sub: timeRange(e.start, e.end) })
            }
            for (const [cid, cm] of Object.entries(s.classes)) {
              if (cm.weekday !== parse(d).getDay()) continue
              blocks.push({ key: 'cls' + cid + d, start: atMin(d, cm.start), end: atMin(d, cm.end), title: cm.c + (cm.selfStudy ? ' · self-study' : ' class'), cls: 'cls' + (cm.selfStudy ? ' self' : ''), c: cm.c })
            }
            for (const e of cal.own) {
              if (e.start.slice(0, 10) !== d) continue
              blocks.push({ key: e.id, start: e.start, end: e.end, title: e.title, sub: timeRange(e.start, e.end), cls: 'own', c: e.c, onClick: () => onOpen(e) })
            }
            for (const sg of cal.sched.suggestions) {
              if (sg.start.slice(0, 10) !== d) continue
              blocks.push({ key: sg.key, start: sg.start, end: sg.end, title: sg.title, sub: 'suggested', cls: 'sugg', c: sg.c })
            }
            const laid = layout(blocks)
            return (
              <div key={d} className={'tg-col' + (d === t ? ' today' : '')} onDoubleClick={e => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                onNew(atMin(d, Math.min(DAY_END - 30, snap(DAY_START + (e.clientY - r.top) / PX))))
              }}>
                {hours.map(h => <div key={h} className="tg-line" style={{ top: (h - DAY_START) * PX }} />)}
                {d === t && nowMin >= DAY_START && nowMin <= DAY_END && <div className="tg-now" style={{ top: (nowMin - DAY_START) * PX }} aria-label="Now" />}
                {laid.map(b => {
                  const top = (minOfDay(b.start) - DAY_START) * PX
                  const h = Math.max(16, (durMin(b.start, b.end)) * PX)
                  const w = 100 / b.cols
                  const Tag = b.onClick ? 'button' : 'div'
                  return (
                    <Tag key={b.key} className={'tg-ev ' + b.cls} style={{ top, height: h, left: `calc(${b.col * w}% + 2px)`, width: `calc(${w}% - 4px)`, ['--cc' as string]: b.c ? courseColor(b.c) : undefined }}
                      {...(b.onClick ? { type: 'button' as const, onClick: b.onClick } : {})} title={b.title + ' · ' + timeRange(b.start, b.end)}>
                      <b>{b.title}</b>{h > 34 && <span>{b.sub}</span>}
                    </Tag>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ItemChip({ item, days }: { item: Item; days: number }) {
  const { s } = useData()
  const t = useToday()
  const kb = KIND[item.k] || KIND.class
  void kb
  const r = item.k === 'test' ? readiness(s, item, t) : null
  return (
    <span className={'chip-ad k-' + item.k} title={item.t + (item.w ? ' · ' + item.w : '')}>
      <span className="dot" style={{ background: courseColor(item.c) }} />
      <b>{item.c.split(' ')[1]}</b> {item.t}
      {item.k === 'test' && r && days === 1 && <ReadyBar pct={r.pct} compact />}
    </span>
  )
}

/* ---------------- month ---------------- */
function MonthGrid({ anchor, cal, onPick }: { anchor: string; cal: CalData; onPick: (d: string) => void }) {
  const t = useToday()
  const { items } = useData()
  const first = (() => { const d = parse(anchor); d.setDate(1); return d })()
  const start = monday(first)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(dateStr(start), i))
  const month = first.getMonth()
  return (
    <>
      <div className="month">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="dow">{d}</div>)}
        {cells.map(d => {
          const its = items.filter(i => i.d === d && !i.done)
          const has = cal.own.some(e => e.start.slice(0, 10) === d)
          return (
            <button type="button" key={d} className={'d' + (parse(d).getMonth() !== month ? ' out' : '') + (d === t ? ' today' : '')} onClick={() => onPick(d)} aria-label={fmt(parse(d), { weekday: 'long', month: 'long', day: 'numeric' })}>
              {parse(d).getDate()}
              {(its.length > 0 || has) && <i>{its.slice(0, 3).map((x, k) => <span key={k} className={x.k === 'test' ? 't' : ''} />)}{!its.length && has && <span />}</i>}
            </button>
          )
        })}
      </div>
      <div className="legend"><span><span className="dot" style={{ background: 'var(--accent)' }} />Test</span><span><span className="dot" style={{ background: 'var(--sage)' }} />Deadline or study block</span></div>
    </>
  )
}

/* ---------------- one day's timeline (dashboard) ---------------- */
export function DayTimeline({ date, cal, compact }: { date: string; cal: CalData; compact?: boolean }) {
  const { s, items } = useData()
  const rows = useMemo(() => {
    const out: { key: string; start: string; end: string; title: string; cls: string; c?: string }[] = []
    for (const e of cal.ext) if (!e.allDay && !e.d2l && !e.berry && e.start.slice(0, 10) === date) out.push({ key: e.id, start: e.start, end: e.end, title: e.title, cls: e.work ? 'work' : 'ext' })
    for (const [cid, cm] of Object.entries(s.classes)) if (cm.weekday === parse(date).getDay()) out.push({ key: cid, start: atMin(date, cm.start), end: atMin(date, cm.end), title: cm.c + (cm.selfStudy ? ' · self-study' : ' class'), cls: 'cls', c: cm.c })
    for (const e of cal.own) if (e.start.slice(0, 10) === date) out.push({ key: e.id, start: e.start, end: e.end, title: e.title, cls: 'own', c: e.c })
    return out.sort((a, b) => a.start.localeCompare(b.start))
  }, [cal, date, s.classes])
  const due = items.filter(i => i.d === date && !i.done)
  if (!rows.length && !due.length) return <Empty status="proud">Nothing booked today.</Empty>
  return (
    <div className="daylist">
      {due.map(i => <div key={i.id} className={'dayrow due k-' + i.k}><span className="dt">all day</span><span className="dl"><b>{i.t}</b><span className="note">{i.c}{i.w ? ' · ' + i.w : ''}</span></span></div>)}
      {rows.slice(0, compact ? 6 : 99).map(r => (
        <div key={r.key} className={'dayrow ' + r.cls} style={{ ['--cc' as string]: r.c ? courseColor(r.c) : undefined }}>
          <span className="dt">{hhmm(minOfDay(r.start))}</span>
          <span className="dl"><b>{r.title}</b><span className="note">{timeRange(r.start, r.end)}</span></span>
        </div>
      ))}
    </div>
  )
}

/* ---------------- suggestions ---------------- */
export function SuggestionRow({ sg }: { sg: Suggestion }) {
  const t = useToday()
  const d = sg.start.slice(0, 10)
  const when = d === t ? 'Today' : d === addDays(t, 1) ? 'Tomorrow' : fmt(parse(d), { weekday: 'short', month: 'short', day: 'numeric' })
  return (
    <div className="sugg-row" style={{ ['--cc' as string]: courseColor(sg.c) }} data-sugg={sg.key} data-start={sg.start}>
      <span className="grow">
        <b>{when} {timeRange(sg.start, sg.end)}</b>
        <span className="note">{sg.title}{sg.note ? ' · ' + sg.note : ''}</span>
      </span>
      <span className="wrap">
        <button type="button" className="btn sm" onClick={() => acceptSuggestion(sg)}><I as={Check} size={15} />Accept</button>
        <button type="button" className="btn quiet sm" onClick={() => skipSuggestion(sg)}><I as={X} size={15} />Skip</button>
      </span>
    </div>
  )
}

/* ---------------- event editor ---------------- */
function EventEditor({ ev, start, onClose }: { ev?: CalEvent & { id: string }; start?: string; onClose: () => void }) {
  const base = ev || { title: '', start: start || atMin(todayStr(), 16 * 60), end: '', c: 'FNCE 445', kind: 'custom' as const }
  const [title, setTitle] = useState(base.title)
  const [date, setDate] = useState(base.start.slice(0, 10))
  const [from, setFrom] = useState(base.start.slice(11, 16))
  const [to, setTo] = useState((ev ? ev.end : atMin(todayStr(), minOfDay(base.start) + 50)).slice(11, 16))
  const [c, setC] = useState(base.c || 'FNCE 445')
  const [del, setDel] = useState(false)
  const [err, setErr] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setErr('Give it a title.'); return }
    const s = date + 'T' + from, en = date + 'T' + to
    if (fromLocal(en) <= fromLocal(s)) { setErr('The end has to be after the start.'); return }
    void saveEvent(ev?.id || null, { ...(ev || {}), title: title.trim(), start: s, end: en, c, kind: ev?.kind || 'custom' })
    toast(ev ? 'Block updated.' : 'Block added.')
    onClose()
  }
  if (del && ev) return <Confirm title="Remove this block?" body={<p>“{ev.title}” will be removed{ev.gcalId ? ', including from Google Calendar' : ''}.</p>} confirmLabel="Remove" danger onCancel={() => setDel(false)} onConfirm={() => { void deleteEvent(ev.id); onClose() }} />
  return (
    <Modal title={ev ? 'Edit block' : 'New study block'} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <label className="field wide">Title<input className="input" id="ev-title" autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. FNCE 445 · forward pricing" /></label>
        <label className="field">Course<select className="input" value={c} onChange={e => setC(e.target.value)}>{COURSE_KEYS.map(k => <option key={k}>{k}</option>)}</select></label>
        <label className="field">Date<input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label className="field">From<input className="input" type="time" step={900} value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label className="field">To<input className="input" type="time" step={900} value={to} onChange={e => setTo(e.target.value)} /></label>
        {err && <p className="wide bad" role="alert">{err}</p>}
        <div className="wide wrap" style={{ justifyContent: 'space-between' }}>
          {ev ? <button type="button" className="btn quiet" onClick={() => setDel(true)}><I as={Trash2} size={15} />Remove</button> : <span />}
          <span className="wrap"><button type="button" className="btn quiet" onClick={onClose}>Cancel</button><button type="submit" className="btn">Save</button></span>
        </div>
      </form>
    </Modal>
  )
}

