/* The Right Now card and the capacity sentence: the first two things on the dashboard. */
import { useState } from 'react'
import { Play, ChevronRight, Scissors, CalendarPlus, Target } from 'lucide-react'
import { useData, useToday } from '../lib/hooks'
import { useCal } from '../lib/calendar'
import { rightNow } from '../lib/rightnow'
import { capacity, countWord } from '../lib/capacity'
import { hm, todayStr } from '../lib/dates'
import { courseColor, COURSES } from '../data/courses'
import { update } from '../store/store'
import { startTimer } from '../store/actions'
import { toast } from '../lib/events'
import { Modal } from '../components/Modal'
import { I } from '../components/ui'
import { Cat } from '../components/Cat'
import { effortHours } from '../lib/scheduler'
import { go } from '../lib/router'

export function RightNowCard() {
  const { s } = useData()
  const t = useToday()
  const cal = useCal()
  const { pick, count } = rightNow(s, cal, t)
  if (!pick) {
    return (
      <section className="rightnow quiet-day" aria-labelledby="rn-h">
        <div className="rn-body">
          <div className="rn-eyebrow" id="rn-h">Right now</div>
          <h2 className="rn-action">Nothing is due for a while</h2>
          <p className="rn-reason">Add what's coming up, or take the evening off.</p>
        </div>
        <Cat status="sleep" size={64} />
      </section>
    )
  }
  const start = () => {
    if (pick.kind === 'work') { startTimer(pick.c, pick.minutes); go('garden') }
    else { startTimer(pick.c, pick.minutes); location.hash = pick.href }
    toast(`${pick.minutes} minutes on ${pick.c}. Timer running.`)
  }
  const notThis = () => {
    update(d => {
      const prev = d.settings.notThis && d.settings.notThisDay === t ? d.settings.notThis : []
      d.settings.notThis = [...prev, pick.key]
      d.settings.notThisDay = t
    })
  }
  return (
    <section className="rightnow" aria-labelledby="rn-h" data-rn={pick.key}>
      <div className="rn-body">
        <div className="rn-eyebrow" id="rn-h">Right now</div>
        <h2 className="rn-action">
          <span className="rn-course" style={{ color: courseColor(pick.c) }}>{pick.c}</span>
          <span className="rn-verb">{pick.action}</span>
          <span className="rn-dur">{hm(pick.minutes)}</span>
        </h2>
        <p className="rn-reason">{pick.reason}</p>
      </div>
      <div className="rn-actions">
        <button type="button" className="btn rn-start" onClick={start}><I as={Play} size={16} />Start</button>
        {count > 1 && <button type="button" className="btn link rn-skip" onClick={notThis}>Not this <I as={ChevronRight} size={14} /></button>}
      </div>
    </section>
  )
}

export function CapacityLine() {
  const { s } = useData()
  const t = useToday()
  const cal = useCal()
  const [fix, setFix] = useState(false)
  const cap = capacity(s, cal, t)
  if (!cap) return null
  return (
    <>
      <p className={'capacity' + (cap.tight ? ' tight' : '')} data-capacity={cap.unplaced}>
        <b>{hm(cap.needed)} of work before {cap.byLabel}</b> · {hm(cap.free)} free
        {cap.unplaced > 0 && <> · {countWord(cap.unplaced)} block{cap.unplaced === 1 ? '' : 's'} won't fit</>}
        {cap.tight && <button type="button" className="btn link" onClick={() => setFix(true)}>Fix <I as={ChevronRight} size={13} /></button>}
      </p>
      {fix && <FixSheet onClose={() => setFix(false)} />}
    </>
  )
}

function FixSheet({ onClose }: { onClose: () => void }) {
  const { s } = useData()
  const t = useToday()
  const cal = useCal()
  const cap = capacity(s, cal, t)
  const stuck = cap?.items || []
  const first = stuck[0]
  const item = first ? cal.items.find(i => i.id === first.id) : null
  const offDays = s.prefs.noStudy
  const shrinkTo = item ? Math.max(0.5, Math.round((effortHours(item) * 0.6) * 2) / 2) : 0
  const curTarget = item ? COURSES[item.c] : null
  return (
    <Modal title="Make it fit" onClose={onClose}>
      {!stuck.length ? <p>Everything fits — it's just tight. Nothing to change.</p> : (
        <>
          <p className="note">{stuck.length === 1 ? 'One thing' : stuck.length + ' things'} can't fit before {cap?.byLabel}. Three honest ways out.</p>
          <div className="fix-list">
            <button type="button" className="fix-opt" onClick={() => {
              if (!item) return
              update(d => { const i = d.items[item.id]; if (i) i.effort = shrinkTo })
              toast(`${item.t} is now ${hm(shrinkTo * 60)} of work.`); onClose()
            }}>
              <I as={Scissors} size={17} />
              <span><b>Shrink</b><span className="note">{item ? `Call ${item.t} ${hm(shrinkTo * 60)} instead of ${hm(effortHours(item) * 60)}.` : ''}</span></span>
            </button>
            <button type="button" className="fix-opt" disabled={!offDays.length} onClick={() => {
              update(d => { d.prefs.noStudy = [] })
              toast('Days you had marked off are back in play.'); onClose()
            }}>
              <I as={CalendarPlus} size={17} />
              <span><b>Borrow</b><span className="note">{offDays.length ? `Study on the ${offDays.length === 1 ? 'day' : 'days'} you'd marked off. This uses time you'd set aside.` : 'No days are marked off, so there is nothing to borrow.'}</span></span>
            </button>
            <button type="button" className="fix-opt" onClick={() => {
              if (!item) return
              update(d => { const i = d.items[item.id]; if (i) i.effort = Math.max(0.5, Math.round((first.free / 60) * 2) / 2) })
              toast(`Aiming lower on ${item.t}. Planned for the time you actually have.`); onClose()
            }}>
              <I as={Target} size={17} />
              <span><b>Accept</b><span className="note">{item && curTarget ? `Aim lower on ${item.t} and plan ${hm(first.free)}, the time you actually have.` : ''}</span></span>
            </button>
          </div>
          <ul className="fix-items">
            {stuck.map(x => <li key={x.id}><span className="course-tag" style={{ color: courseColor(x.c) }}>{x.c}</span> {x.title} <b className="note">{hm(x.needed)} needed · {hm(x.free)} free</b></li>)}
          </ul>
        </>
      )}
      <div className="wrap" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn quiet" onClick={onClose}>Close</button></div>
    </Modal>
  )
}

/** The per-item chip for the agenda: "3h needed · 1h15 free". */
export function FitChip({ itemId }: { itemId: string }) {
  const { s } = useData()
  const t = useToday()
  const cal = useCal()
  const cap = capacity(s, cal, t)
  const hit = cap?.items.find(x => x.id === itemId)
  if (!hit) return null
  return <span className="fit-chip" title="This needs more time than is free before it is due">{hm(hit.needed)} needed · {hm(hit.free)} free</span>
}
