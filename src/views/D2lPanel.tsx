/* Updates from D2L: course dates from a subscribed D2L/Brightspace feed that aren't in her list,
   or whose date has moved. Nothing changes automatically. */
import { GraduationCap, Plus, CalendarClock, X } from 'lucide-react'
import { Panel, I, Empty } from '../components/ui'
import { useData } from '../lib/hooks'
import { useCal } from '../lib/calendar'
import { d2lUpdates } from '../lib/d2l'
import { update } from '../store/store'
import { saveItem } from '../store/actions'
import { fmt, parse, uid } from '../lib/dates'
import { toast } from '../lib/events'
import { courseColor } from '../data/courses'

export function D2lPanel({ compact }: { compact?: boolean }) {
  const { s, items } = useData()
  const cal = useCal()
  const ups = d2lUpdates(cal.ext, s, items)
  const hasFeed = s.cal.calendars.some(c => c.d2l) || Object.values(s.ics).some(x => x.d2l)
  if (!hasFeed && !ups.length) return null
  if (compact && !ups.length) return null
  return (
    <Panel icon={GraduationCap} title="Updates from D2L" id="d2l" right={<span className="note">{ups.length} to review</span>}>
      {!ups.length ? <Empty status="proud">Everything in D2L matches your list.</Empty> : ups.slice(0, compact ? 3 : 20).map(u => (
        <div className="sugg-row" key={u.it.key} style={{ ['--cc' as string]: courseColor(u.it.c) }} data-d2l={u.it.key}>
          <span className="grow">
            <b>{u.it.c} · {u.it.t}</b>
            <span className="note">{u.kind === 'new'
              ? `Not in your list · ${fmt(parse(u.it.d), { weekday: 'short', month: 'short', day: 'numeric' })}`
              : `Moved: ${fmt(parse(u.item.d!), { month: 'short', day: 'numeric' })} → ${fmt(parse(u.it.d), { month: 'short', day: 'numeric' })}`}</span>
          </span>
          <span className="wrap">
            {u.kind === 'new'
              ? <button type="button" className="btn sm" onClick={() => { saveItem(null, { c: u.it.c, k: u.it.k, t: u.it.t, d: u.it.d, w: '', n: 'From D2L' }); toast('Added ' + u.it.t + '.') }}><I as={Plus} size={15} />Add</button>
              : <button type="button" className="btn sm" onClick={() => { update(d => { const it = d.items[u.item.id]; if (it) it.d = u.it.d }); toast('Date updated.') }}><I as={CalendarClock} size={15} />Update date</button>}
            <button type="button" className="btn quiet sm" onClick={() => update(d => { d.d2lIgnore[u.it.key] = true })}><I as={X} size={15} />Ignore</button>
          </span>
        </div>
      ))}
      {!compact && <p className="note">In D2L: Calendar → Subscribe → copy the URL. In Google Calendar: Other calendars → + → From URL → paste. Then tag that calendar as D2L in Settings → Calendars. Google can take a few hours to pick up changes to the feed.{uid.length ? '' : ''}</p>}
    </Panel>
  )
}
