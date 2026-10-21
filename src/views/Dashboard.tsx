/* Dashboard: the companion scene on the left, then what to do next, the week, courses and updates. */
import { Play, CalendarDays, BookOpen, ListOrdered, Sprout, ArrowRight } from 'lucide-react'
import { Scene } from '../components/Scene'
import { Panel, I, Empty, ReadyBar } from '../components/ui'
import { CourseTile } from './CourseTile'
import { D2lPanel } from './D2lPanel'
import { DayTimeline, SuggestionRow } from './Calendar'
import { useCal, useSync } from '../lib/calendar'
import { useData, useToday } from '../lib/hooks'
import { prioritize } from '../lib/schedule'
import { readiness } from '../lib/readiness'
import { COURSE_KEYS, courseColor } from '../data/courses'
import { fmt, parse, hm, monday, daysBetween } from '../lib/dates'
import { Cat } from '../components/Cat'
import { go } from '../lib/router'

function greeting(d = new Date()) { const h = d.getHours(); return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }

export function Dashboard() {
  const { s, items } = useData()
  const t = useToday()
  const cal = useCal()
  const sync = useSync()
  const top = prioritize(items, t)
  const nextTest = items.filter(i => i.k === 'test' && !i.done && i.d && i.d >= t).sort((a, b) => a.d!.localeCompare(b.d!))[0]
  const ready = nextTest ? readiness(s, nextTest, t) : null
  const mon = monday(parse(t))
  let weekMin = 0
  for (const [d, doc] of Object.entries(s.study)) if (parse(d) >= mon) for (const v of Object.values(doc)) weekMin += Number(v || 0)
  const todayMin = Object.values(s.study[t] || {}).reduce((a, b) => a + Number(b || 0), 0)
  const sugg = cal.sched.suggestions.filter(x => x.start.slice(0, 10) >= t).slice(0, 3)

  return (
    <div className="page dash-page">
      <header className="hero">
        <div>
          <div className="eyebrow">{fmt(parse(t), { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</div>
          <h1 className="ptitle">{greeting()}, <em>Annika</em></h1>
        </div>
      </header>

      <div className="dash">
        <div className="stack" style={{ gap: 16 }}>
          <Scene />
          <Panel icon={ListOrdered} title="Today's priorities" id="pri" right={<a className="btn link" href="#/schedule">Calendar</a>}>
            {top.length ? (
              <ol className="plist">
                {top.map(p => (
                  <li className="pi" key={p.i.id}>
                    <div style={{ minWidth: 0 }}>
                      <div className="ptitle-row"><span className="course-tag" style={{ color: courseColor(p.i.c) }}>{p.i.c}</span><span className="t">{p.i.t}</span></div>
                      {p.i.n && <div className="note">{p.i.n}</div>}
                      <div className="why">{p.flags.map(([txt, c], k) => <span key={k} className={'flag ' + c}>{txt}</span>)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : <Empty>Nothing due in the next two weeks.</Empty>}
          </Panel>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <Panel title={<span className="caps">Ready to study?</span>} id="rts">
            <a className="big-row" href="#/garden">
              <span className="big-ico"><I as={Play} size={18} /></span>
              <span className="grow"><b>Start a session</b><span className="note">{s.timer ? 'A session is running' : nextTest ? `Next: ${nextTest.c} ${nextTest.t}` : 'Pick a course and go'}</span></span>
              <span className="num-side"><b>{hm(todayMin)}</b><span className="note">today</span></span>
            </a>
            {nextTest && ready && (
              <a className="big-row" href={'#/study/' + nextTest.c.toLowerCase().replace(/\s+/g, '-') + '/progress'}>
                <span className="big-ico"><I as={BookOpen} size={18} /></span>
                <span className="grow"><b>{nextTest.c} {nextTest.t}</b><span className="note">{(() => { const n = daysBetween(t, nextTest.d!); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days' })()} · weakest: {ready.weak[0]?.name || 'not practised yet'}</span></span>
                <ReadyBar pct={ready.pct} />
              </a>
            )}
          </Panel>

          <Panel icon={CalendarDays} title="Today" id="dash-day" right={<a className="btn link" href="#/schedule/day">Open day</a>}>
            <DayTimeline date={t} cal={cal} compact />
          </Panel>

          <Panel icon={Sprout} title="Suggested for you" id="sugg" right={sync === 'syncing' ? <Cat status="sync" size={30} /> : undefined}>
            {sugg.length ? sugg.map(x => <SuggestionRow key={x.key} sg={x} />)
              : cal.sched.unplaced.length ? <Empty status="busy">No free slots this week that fit your study window. Try widening it in Settings.</Empty>
              : <Empty status="proud">Nothing to schedule: you're ahead.</Empty>}
          </Panel>

          <D2lPanel compact />

          <Panel icon={BookOpen} title={<span className="caps">Your courses</span>} id="courses" right={<a className="btn link" href="#/study">All courses <I as={ArrowRight} size={14} /></a>}>
            <div className="tilegrid">{COURSE_KEYS.map(c => <CourseTile key={c} c={c} />)}</div>
          </Panel>
        </div>
      </div>
      <p className="foot-note"><span className="script">Study · plan · a bit every day</span></p>
    </div>
  )
}
