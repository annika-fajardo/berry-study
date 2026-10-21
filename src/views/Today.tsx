import { useData, useToday, useBerryMood } from '../lib/hooks'
import { prioritize, stripStats } from '../lib/schedule'
import { levelInfo, xpTotal, streak } from '../lib/game'
import { courseColor } from '../data/courses'
import { daysBetween, fmt, parse, hm, monday } from '../lib/dates'
import { setSetting } from '../store/actions'
import { Berry, TuxCat, Sparkle } from '../components/Characters'
import { go } from '../lib/router'

export function greeting(d = new Date()) { const h = d.getHours(); return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }

export function LevelCard({ compact }: { compact?: boolean }) {
  const { s } = useData()
  const t = useToday()
  const info = levelInfo(xpTotal(s)), st = streak(s, t)
  return (
    <section className="level-card" aria-label="Your level">
      <svg className="sparkle-deco" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><Sparkle x={24} y={14} s={10} /><Sparkle x={10} y={30} s={5} /></svg>
      <div className="lc-top">
        <Berry mood={info.pct > 0.85 ? 'cheering' : 'happy'} size={compact ? 64 : 84} title="Berry" />
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">Level up</div>
          <div className="lc-name">{info.name}</div>
          <div className="lc-sub">lv. <b>{info.level}</b> ({info.total.toLocaleString('en-CA')} xp)</div>
        </div>
      </div>
      <div className="bar" role="progressbar" aria-label="Progress to next level" aria-valuemin={info.cur} aria-valuemax={info.next} aria-valuenow={info.total}><span style={{ width: Math.round(info.pct * 100) + '%' }} /></div>
      <div className="lc-ends"><span>{info.cur.toLocaleString('en-CA')} xp</span><span>{info.next.toLocaleString('en-CA')} xp</span></div>
      <div className="wrap">
        <span className={'streak' + (st.count ? '' : ' cold')} title="Days in a row with at least one XP action">
          <svg viewBox="0 0 64 64" width="28" height="28" aria-hidden="true"><path d="M32 8 Q 40 22 50 26 Q 56 44 44 54 Q 32 62 20 54 Q 8 44 14 28 Q 22 30 24 20 Q 28 14 32 8 Z" fill={st.count ? 'var(--berry)' : 'var(--wilt-petal)'} stroke="var(--char-ink)" strokeWidth="3.5" strokeLinejoin="round" /><path d="M32 30 Q 38 38 38 44 Q 36 52 32 52 Q 26 52 26 44 Q 26 38 32 30 Z" fill="var(--gold)" stroke="var(--char-ink)" strokeWidth="2.5" /></svg>
          {st.count ? `${st.count}-day streak` : 'No streak yet'}
        </span>
        <span className="note">{st.count && !st.today ? 'Do one thing today to keep it going.' : st.today ? 'Today counts already. Nice.' : 'Tick a task or answer a question to start one.'}</span>
      </div>
    </section>
  )
}

export function Today() {
  const { s, items } = useData()
  const t = useToday()
  const mood = useBerryMood()
  const top = prioritize(items, t)
  const urgent = top.filter(p => p.urg === 'u-red').length
  const { next, wk, late } = stripStats(items, t)
  const nextDays = next ? daysBetween(t, next.d!) : null
  const mon = monday(parse(t))
  let weekMin = 0; for (const [d, doc] of Object.entries(s.study)) if (parse(d) >= mon) for (const v of Object.values(doc)) weekMin += Number(v || 0)
  const cat = s.settings.catName
  return (
    <div className="page">
      <header className="hero">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">{fmt(parse(t), { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h1>{greeting()} <span aria-hidden="true">✦</span></h1>
          <p>{mood === 'worried' ? `Something slipped past its date. Berry's a little worried; a quick look at Schedule will fix it.`
            : mood === 'sleepy' ? `Berry's been napping. One small thing today wakes the garden back up.`
            : mood === 'studying' ? `Focus session running. ${cat} is napping on the timer.`
            : top.length ? `${top.length} thing${top.length > 1 ? 's' : ''} to focus on today. ${cat} believes in you.` : `Nothing pressing. A good day to get ahead.`}</p>
        </div>
        <div className="chars" aria-hidden="false">
          <Berry mood={mood} size={96} />
          <TuxCat pose={s.timer ? 'sleep' : mood === 'sleepy' ? 'loaf' : 'sit'} size={92} name={cat} />
        </div>
      </header>

      <div className="grid2">
        <LevelCard />
        <div className="stack">
          <section className="card bold" aria-label="Next test">
            <div className="eyebrow">Next test</div>
            {next ? (
              <div className="row-between">
                <div style={{ minWidth: 0 }}>
                  <div className="course-tag" style={{ color: courseColor(next.c) }}>{next.c}</div>
                  <div className="h3">{next.t}</div>
                  <div className="note">{fmt(parse(next.d!), { weekday: 'long', month: 'short', day: 'numeric' })}{next.w ? ' · ' + next.w : ''}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="serif-num" style={{ fontSize: 48 }}>{nextDays === 0 ? 'Today' : nextDays}</div>
                  {nextDays !== 0 && <div className="note">{nextDays === 1 ? 'day to go' : 'days to go'}</div>}
                </div>
              </div>
            ) : <p className="note">No tests ahead.</p>}
          </section>
          <section className="card tint" aria-label="Quick focus">
            <div className="row-between">
              <div>
                <div className="h3">Ready for a focus session?</div>
                <div className="note">{hm(weekMin)} studied this week · {wk.length} graded item{wk.length === 1 ? '' : 's'} in the next 7 days{late.length ? ` · ${late.length} past due` : ''}</div>
              </div>
              <button type="button" className="btn berry" onClick={() => go('focus')}>{s.timer ? 'Open timer' : 'Start focus'}</button>
            </div>
          </section>
        </div>
      </div>

      <details className="card plan" open={s.settings.planOpen} onToggle={e => { const o = (e.currentTarget as HTMLDetailsElement).open; if (o !== s.settings.planOpen) setSetting('planOpen', o) }}>
        <summary>
          <h2 className="h2">Today's priorities</h2>
          <span className="note">{top.length ? top.length + ' to focus on' + (urgent ? ' · ' + urgent + ' due in the next day' : '') : 'nothing pressing'}</span>
          <svg className="chev" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </summary>
        {top.length ? (
          <ol className="plist">
            {top.map(p => (
              <li className="pi" key={p.i.id}>
                <div style={{ minWidth: 0 }}>
                  <div><span className="course-tag" style={{ color: courseColor(p.i.c) }}>{p.i.c}</span>{'  '}<span className="title" style={{ cursor: 'auto' }}>{p.i.t}</span></div>
                  {p.i.n && <div className="note">{p.i.n}</div>}
                  <div className="why">{p.flags.map(([txt, c], k) => <span key={k} className={'flag ' + c}>{txt}</span>)}</div>
                </div>
              </li>
            ))}
          </ol>
        ) : <p className="note">Nothing pressing in the next two weeks. A good day to get ahead on readings.</p>}
        <div><button type="button" className="btn ghost sm" onClick={() => go('schedule')}>Open the schedule</button></div>
      </details>
    </div>
  )
}
