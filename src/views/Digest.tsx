/* "Since you were last here": what changed while she was away. Shown once per visit, dismissible. */
import { useMemo, useState } from 'react'
import { Clock3, X } from 'lucide-react'
import { useData, useToday } from '../lib/hooks'
import { useCal } from '../lib/calendar'
import { d2lUpdates } from '../lib/d2l'
import { daysBetween, fmt, parse } from '../lib/dates'
import { update } from '../store/store'
import { I } from '../components/ui'

/** The last visit is recorded on mount, so this only ever reports a real gap. */
export function Digest() {
  const { s, items } = useData()
  const t = useToday()
  const cal = useCal()
  const [open, setOpen] = useState(true)
  const since = useMemo(() => s.settings.lastSeen, [])
  const lines = useMemo(() => {
    if (!since || since === t) return []
    const gap = daysBetween(since, t)
    if (gap < 1) return []
    const out: string[] = []
    const overdue = items.filter(i => !i.done && i.d && i.d < t && i.d >= since && i.k !== 'class')
    if (overdue.length) out.push(`${overdue.length === 1 ? overdue[0].c + ' ' + overdue[0].t + ' went past its date' : overdue.length + ' things went past their date'}`)
    const soon = items.filter(i => !i.done && i.d && i.d >= t && daysBetween(t, i.d) <= 3 && i.k === 'test')
    if (soon.length) out.push(`${soon.length} test${soon.length === 1 ? '' : 's'} in the next three days`)
    const ups = d2lUpdates(cal.ext, s, items)
    if (ups.length) out.push(`${ups.length} date${ups.length === 1 ? '' : 's'} from D2L to review`)
    return out
  }, [since])
  // record this visit
  useMemo(() => { if (s.settings.lastSeen !== t) update(d => { d.settings.lastSeen = t }) }, [t])
  if (!open || !lines.length || !since) return null
  const gap = daysBetween(since, t)
  return (
    <div className="digest" role="status">
      <I as={Clock3} size={16} />
      <span className="grow"><b>Since {gap === 1 ? 'yesterday' : fmt(parse(since), { weekday: 'long' })}:</b> {lines.join(' · ')}.</span>
      <button type="button" className="icon-btn sm-x" aria-label="Dismiss" onClick={() => setOpen(false)}><I as={X} size={15} /></button>
    </div>
  )
}
