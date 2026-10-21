/* Dashboard. Right Now and the capacity sentence come first; everything else is below them. */
import { CalendarDays, BookOpen, ListOrdered, Sprout, ArrowRight } from 'lucide-react'
import { Scene } from '../components/Scene'
import { Panel, I, Empty, ReadyBar } from '../components/ui'
import { CourseTile } from './CourseTile'
import { D2lPanel } from './D2lPanel'
import { DayTimeline, SuggestionRow } from './Calendar'
import { RightNowCard, CapacityLine } from './RightNow'
import { Digest } from './Digest'
import { useCal, useSync } from '../lib/calendar'
import { useData, useToday } from '../lib/hooks'
import { prioritize } from '../lib/schedule'
import { readiness } from '../lib/readiness'
import { COURSE_KEYS, courseColor } from '../data/courses'
import { fmt, parse, hm, monday, daysBetween } from '../lib/dates'
import { Cat } from '../components/Cat'

function greeting(d = new Date()) { const h = d.getHours(); return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }

export function Dashboard() {
  const { s, items } = useData()
  const t = useToday()
  const cal = useCal()
  const sync = useSync()
  // Three priorities, not five.
  const top = prioritize(items, t).slice(0, 3)
  const nextTest = items.filter(i => i.k === 'test' && !i.done && i.d && i.d >= t).sort((a, b) => a.d!.localeCompare(b.d!))[0]
  const ready = nextTest ? readiness(s, nextTest, t) : null
  const mon = monday(parse(t))
  let weekMin = 0
  for (const [d, doc] of Object.entries(s.study)) if (parse(d) >= mon) for (const v of Object.values(doc)) weekMin += Number(v || 0)
  const todayMin = Object.values(s.study[t] || {}).reduce((a, b) => a + Number(b || 0), 0)
  // At most two suggestions per day here; the full set lives in Calendar.
  const perDay: Record<string, number> = {}
  const sugg = cal.sched.suggestions.filter(x => {
    const d = x.start.slice(0, 10)
    if (d < t) return false
    perDay[d] = (perDay[d] || 0) + 1
    return perDay[d] <= 2
  }).slice(0, 4)

  return (
    <div className="page dash-page">
      <header className="hero">
        <div>
          <div className="eyebrow">{fmt(parse(t), { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</div>
          <h1 className="ptitle">{greeting()}, <em>Annika</em></h1>
        </div>
      </header>

      <RightNowCard />
      <CapacityLine />
      <Digest />

      <div className="dash">
        <div className="stack" style={{ gap: 16 }}>
          <Scene />
          <Panel icon={ListOrdered} title="Next up" id="pri" right={<a className="btn link" href="#/schedule">Calendar</a>}>
            {top.length ? (
              <ol className="plist">
                {top.map(p => {
                  const flag = p.flags[0]
                  return (
                    <li className="pi" key={p.i.id}>
                      <div style={{ minWidth: 0 }}>
                        <div className="ptitle-row"><span className="course-tag" style={{ color: courseColor(p.i.c) }}>{p.i.c}</span><span className="t">{p.i.t}</span></div>
                        <div className="why">{flag && <span className={'flag ' + flag[1]}>{flag[0]}</span>}{p.i.w && <span className="flag">{p.i.w}</span>}</div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            ) : <Empty>Nothing due in the next two weeks.</Empty>}
          </Panel>

          <Panel icon={BookOpen} title={<span className="caps">Your courses</span>} id="courses" right={<a className="btn link" href="#/study">All courses <I as={ArrowRight} size={14} /></a>}>
            <div className="tilegrid tight">{COURSE_KEYS.map(c => <CourseTile key={c} c={c} />)}</div>
          </Panel>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <Panel icon={CalendarDays} title="Today" id="dash-day" right={<a className="btn link" href="#/schedule/day">Open day</a>}>
            <DayTimeline date={t} cal={cal} compact />
          </Panel>

          {nextTest && ready && (
            <Panel icon={BookOpen} title="Next test" id="nt" right={<ReadyBar pct={ready.pct} tracked={ready.tracked} total={ready.total} />}>
              <a className="big-row" href={'#/study/' + nextTest.c.toLowerCase().replace(/\s+/g, '-') + '/progress'}>
                <span className="grow">
                  <b>{nextTest.c} {nextTest.t}</b>
                  <span className="note">{(() => { const n = daysBetween(t, nextTest.d!); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days' })()}{ready.weak[0] ? ` · weakest: ${ready.weak[0].name}` : ''}</span>
                </span>
                <I as={ArrowRight} size={16} />
              </a>
            </Panel>
          )}

          <Panel icon={Sprout} title="Suggested study blocks" id="sugg" right={sync === 'syncing' ? <Cat status="sync" size={30} /> : <a className="btn link" href="#/schedule/week">All</a>}>
            {sugg.length ? sugg.map(x => <SuggestionRow key={x.key} sg={x} />)
              : cal.sched.unplaced.length ? <Empty status="busy">No free slots this week that fit your study window. Try widening it in Settings.</Empty>
              : <Empty status="proud">Nothing to schedule: you're ahead.</Empty>}
          </Panel>

          <D2lPanel compact />

          <p className="dash-foot note">{hm(weekMin)} this week · {hm(todayMin)} today</p>
        </div>
      </div>
      <p className="foot-note"><span className="script">Study · plan · a bit every day</span></p>
    </div>
  )
}
