/* The companion scene: Emi's home on the dashboard. A simple illustrated environment that changes with the
   time of day and the season, drawn as smooth vector shapes (no pixels). She wanders along the ground. */
import { useMemo } from 'react'
import { CatTrack } from './Cat'
import { useAppState } from '../store/store'
import { levelInfo, xpTotal, streak } from '../lib/game'
import { useToday } from '../lib/hooks'
import { Flame } from 'lucide-react'
import { I } from './ui'

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night'
export type Season = 'winter' | 'spring' | 'summer' | 'autumn'
export function timeOfDay(d = new Date()): TimeOfDay { const h = d.getHours(); return h < 7 ? 'dawn' : h < 17 ? 'day' : h < 20 ? 'dusk' : 'night' }
export function seasonOf(d = new Date()): Season { const m = d.getMonth(); return m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 8 ? 'summer' : 'autumn' }

const SKY: Record<TimeOfDay, [string, string]> = {
  dawn: ['#F3DCD8', '#F7EDE0'], day: ['#D8E6EC', '#EFF2E6'], dusk: ['#E8D3D6', '#F2E4DA'], night: ['#39414A', '#4E5560'],
}
const SKY_DARK: Record<TimeOfDay, [string, string]> = {
  dawn: ['#3B3038', '#45383B'], day: ['#2E3A41', '#36413C'], dusk: ['#3A2F36', '#43383A'], night: ['#222831', '#2B313A'],
}
const GROUND: Record<Season, [string, string]> = {
  winter: ['#E9EBE6', '#DADFD6'], spring: ['#D5E0C0', '#C3D2AB'], summer: ['#C9D7AA', '#B5C795'], autumn: ['#DCCFA8', '#CBBC90'],
}
const GROUND_DARK: Record<Season, [string, string]> = {
  winter: ['#333B3A', '#2B3231'], spring: ['#333D2C', '#2B3425'], summer: ['#334028', '#2C3722'], autumn: ['#3B3527', '#322D21'],
}
const LEAF: Record<Season, string> = { winter: '#9DA89B', spring: '#9CB97A', summer: '#7E9A5C', autumn: '#C08A4A' }
const LEAF_DARK: Record<Season, string> = { winter: '#5C6660', spring: '#566B42', summer: '#4A5E38', autumn: '#7A5C30' }
function useDark() {
  const s = useAppState()
  const t = s.settings.theme
  if (t === 'dark') return true
  if (t === 'light') return false
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function Scene({ height = 250 }: { height?: number }) {
  const s = useAppState()
  const today = useToday()
  const now = new Date()
  const tod = timeOfDay(now), season = seasonOf(now)
  const info = levelInfo(xpTotal(s)), st = streak(s, today)
  const dark = useDark()
  const [sky1, sky2] = (dark ? SKY_DARK : SKY)[tod], [g1, g2] = (dark ? GROUND_DARK : GROUND)[season]
  const leaf = (dark ? LEAF_DARK : LEAF)[season]
  const trunk = dark ? '#5A4F3D' : '#8A7A5E'
  const night = tod === 'night' || dark
  const stars = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ x: (i * 37 + 11) % 96, y: (i * 23 + 7) % 42, r: i % 3 === 0 ? 1.4 : 1 })), [])
  return (
    <div className={'scene tod-' + tod + ' season-' + season} style={{ minHeight: height }}>
      <svg className="scene-art" viewBox="0 0 320 240" preserveAspectRatio="xMidYMax slice" aria-label={`${season} ${tod} scene`} role="img">
        <rect width="320" height="240" fill={sky1} />
        <rect y="40" width="320" height="140" fill={sky2} opacity=".55" />
        {night && <g fill="#F6F3E8">{stars.map((p, i) => <circle key={i} cx={p.x * 3.3} cy={p.y * 2.2 + 8} r={p.r} opacity={0.5 + (i % 3) * 0.2} />)}</g>}
        {night
          ? <circle cx="252" cy="48" r="17" fill="#F2EEDC" opacity=".9" />
          : <circle cx={tod === 'dawn' ? 64 : tod === 'dusk' ? 258 : 252} cy={tod === 'day' ? 42 : 62} r={tod === 'day' ? 18 : 21} fill={dark ? '#D9D2BC' : tod === 'day' ? '#F4E6AE' : '#F0C9A8'} opacity=".95" />}
        {/* hills */}
        <path d="M-10 182 C 40 150, 92 158, 130 176 C 166 192, 214 150, 262 158 C 292 163, 320 176, 330 182 L 330 250 L -10 250 Z" fill={g2} opacity=".55" />
        <path d="M-10 196 C 48 174, 108 186, 162 196 C 216 206, 272 190, 330 198 L 330 250 L -10 250 Z" fill={g1} />
        <rect y="206" width="320" height="44" fill={g1} />
        {/* trees */}
        {[[250, 198, 1], [296, 200, .8], [214, 196, .6]].map(([x, y, k], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${k})`}>
            <path d="M0 0 V-26" stroke={trunk} strokeWidth="4" strokeLinecap="round" />
            {season === 'winter'
              ? <g stroke={trunk} strokeWidth="3" strokeLinecap="round" fill="none"><path d="M0 -18 l-10 -10 M0 -22 l10 -9 M0 -12 l-8 -7" /></g>
              : <><circle cx="0" cy="-32" r="15" fill={leaf} /><circle cx="-11" cy="-24" r="10" fill={leaf} opacity=".92" /><circle cx="11" cy="-25" r="11" fill={leaf} opacity=".92" /></>}
          </g>
        ))}
        {/* grass / flowers */}
        {Array.from({ length: 16 }, (_, i) => {
          const x = (i * 47 + 18) % 310, y = 212 + ((i * 13) % 20)
          return season === 'winter'
            ? <circle key={i} cx={x} cy={y} r="2" fill={dark ? '#C9D0C6' : '#F4F6F2'} opacity=".9" />
            : <g key={i}><path d={`M${x} ${y} q2 -6 4 -8`} stroke={leaf} strokeWidth="1.6" fill="none" strokeLinecap="round" />{i % 4 === 0 && <circle cx={x + 4} cy={y - 9} r="2.4" fill={season === 'autumn' ? (dark ? '#9A6C34' : '#D9A05B') : dark ? '#8C5C66' : '#E9B5BD'} />}</g>
        })}
      </svg>
      <div className="scene-floor"><CatTrack size={86} rest="left" bottom={4} /></div>
      <div className="scene-chips">
        <span className={'streak-chip' + (st.count ? '' : ' cold')}><I as={Flame} size={14} />{st.count} day{st.count === 1 ? '' : 's'}</span>
        <span className="xp-chip"><b>{info.total.toLocaleString('en-CA')}</b> / {info.next.toLocaleString('en-CA')} xp</span>
      </div>
    </div>
  )
}
