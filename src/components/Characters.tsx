/* Original hand-drawn-style characters, all inline SVG.
   Drawing language (shared by Berry and the cat): chubby "mochi" silhouettes, flat fills,
   soft dark-ink outlines, dot eyes, tiny mouths, minimal detail. Silhouettes are drawn twice
   (a thick outline pass, then a fill pass) so overlapping shapes merge into one clean outline. */
import type { CSSProperties, ReactNode } from 'react'
import type { Mood } from '../lib/events'

const INK = 'var(--char-ink)'
const LINE = 5 // outline pass stroke width (half of it shows outside the fill)

function Duo({ fill, children, sticker }: { fill: string; children: ReactNode; sticker?: boolean }) {
  return (
    <>
      {sticker && <g fill="var(--sticker)" stroke="var(--sticker)" strokeWidth={LINE + 9} strokeLinejoin="round">{children}</g>}
      <g fill={INK} stroke={INK} strokeWidth={LINE} strokeLinejoin="round">{children}</g>
      <g fill={fill}>{children}</g>
    </>
  )
}

/* ------------------------------------------------------------------ Berry */
export type BerryProps = { mood?: Mood; size?: number; className?: string; style?: CSSProperties; title?: string; sticker?: boolean; bounce?: boolean }

const BERRY_BODY = 'M60 31 C 93 29, 108 48, 101 72 C 95 94, 73 112, 60 112 C 47 112, 25 94, 19 72 C 12 48, 27 29, 60 31 Z'
const BERRY_HAT = 'M33 36 Q 40 20 54 29 Q 58 14 66 28 Q 80 18 88 34 Q 76 42 62 37 Q 46 43 33 36 Z'
const SEEDS: [number, number, number][] = [[36, 50, -20], [84, 50, 20], [28, 68, -10], [92, 68, 10], [40, 94, -25], [80, 94, 25], [60, 103, 0], [48, 44, -8], [72, 44, 8]]

export function Berry({ mood = 'happy', size = 120, className, style, title, sticker = true, bounce }: BerryProps) {
  const label = title ?? `Berry the strawberry, ${mood}`
  const cls = ['berry', 'mood-' + mood, bounce ? 'is-bouncing' : '', className || ''].join(' ')
  const eyesY = mood === 'sleepy' ? 70 : 66
  return (
    <svg viewBox="0 0 120 124" width={size} height={size * 124 / 120} className={cls} style={style} role="img" aria-label={label}>
      <g className="berry-float">
        {sticker && <g fill="var(--sticker)" stroke="var(--sticker)" strokeWidth={LINE + 9} strokeLinejoin="round"><path d={BERRY_BODY} /><path d={BERRY_HAT} /><path d="M61 28 Q 61 14 72 10" fill="none" strokeLinecap="round" /></g>}
        {/* arms (behind body) */}
        {mood === 'cheering' && <g stroke={INK} strokeWidth="9" strokeLinecap="round"><path d="M24 62 L10 40" /><path d="M96 62 L110 40" /></g>}
        {mood === 'cheering' && <g stroke="var(--berry)" strokeWidth="4" strokeLinecap="round"><path d="M24 62 L10 40" /><path d="M96 62 L110 40" /></g>}
        {mood === 'proud' && <g stroke={INK} strokeWidth="9" strokeLinecap="round"><path d="M22 74 Q 12 66 22 58" fill="none" /><path d="M98 74 Q 108 66 98 58" fill="none" /></g>}
        {mood === 'proud' && <g stroke="var(--berry)" strokeWidth="4" strokeLinecap="round" fill="none"><path d="M22 74 Q 12 66 22 58" /><path d="M98 74 Q 108 66 98 58" /></g>}
        <Duo fill="var(--berry)"><path d={BERRY_BODY} /></Duo>
        {/* soft highlight */}
        <path d="M34 54 C 36 44, 44 38, 52 37" stroke="var(--berry-hi)" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".75" />
        {SEEDS.map(([x, y, r], k) => <ellipse key={k} cx={x} cy={y} rx="2.1" ry="3.1" fill="var(--seed)" transform={`rotate(${r} ${x} ${y})`} />)}
        {/* matcha-leaf hat */}
        <g className="berry-hat">
          <Duo fill="var(--leaf)"><path d={BERRY_HAT} /></Duo>
          <path d="M44 33 Q 52 31 58 33 M66 33 Q 72 31 78 33" stroke="var(--leaf-dark)" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".6" />
          <path d="M61 28 Q 61 14 72 10" stroke={INK} strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M61 28 Q 61 14 72 10" stroke="var(--leaf-dark)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        </g>
        {/* cheeks */}
        <ellipse cx="38" cy="78" rx="7" ry="4.5" fill="var(--cheek)" opacity=".9" />
        <ellipse cx="82" cy="78" rx="7" ry="4.5" fill="var(--cheek)" opacity=".9" />
        {/* eyes */}
        {mood === 'happy' || mood === 'studying' ? (
          <g className="berry-eyes" fill={INK}>
            <ellipse cx="47" cy={mood === 'studying' ? eyesY + 2 : eyesY} rx="3.6" ry="4.2" />
            <ellipse cx="73" cy={mood === 'studying' ? eyesY + 2 : eyesY} rx="3.6" ry="4.2" />
            <circle cx="48.3" cy={eyesY - 1.4} r="1.2" fill="#fff" opacity={mood === 'studying' ? 0 : 1} />
            <circle cx="74.3" cy={eyesY - 1.4} r="1.2" fill="#fff" opacity={mood === 'studying' ? 0 : 1} />
          </g>
        ) : mood === 'worried' ? (
          <g fill={INK}>
            <ellipse cx="47" cy="68" rx="3.4" ry="4" /><ellipse cx="73" cy="68" rx="3.4" ry="4" />
            <path d="M40 61 L51 57 M80 61 L69 57" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          </g>
        ) : (
          <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
            {mood === 'sleepy'
              ? <><path d="M41 70 Q 47 73 53 70" /><path d="M67 70 Q 73 73 79 70" /></>
              : <><path d="M41 68 Q 47 61 53 68" /><path d="M67 68 Q 73 61 79 68" /></>}
          </g>
        )}
        {/* mouth */}
        {mood === 'cheering' ? <path d="M53 76 Q 60 88 67 76 Z" fill="var(--mouth)" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          : mood === 'worried' ? <path d="M53 81 Q 56.5 77 60 80 Q 63.5 83 67 79" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          : mood === 'sleepy' ? <ellipse cx="60" cy="80" rx="2.6" ry="2" fill={INK} />
          : mood === 'proud' ? <path d="M53 76 Q 60 83 67 76" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          : <path d="M55 76 Q 60 81 65 76" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />}
        {/* mood props */}
        {mood === 'studying' && (
          <g transform="translate(0 2)">
            <Duo fill="var(--oat)"><path d="M40 92 L60 98 L80 92 L80 110 L60 116 L40 110 Z" /></Duo>
            <path d="M60 98 L60 116" stroke={INK} strokeWidth="2.4" />
            <path d="M45 98 L55 101 M45 103 L55 106 M65 101 L75 98 M65 106 L75 103" stroke="var(--leaf-dark)" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        )}
        {mood === 'worried' && <path d="M98 50 Q 104 60 98 64 Q 92 60 98 50 Z" fill="var(--drop)" stroke={INK} strokeWidth="2" />}
        {mood === 'sleepy' && <g className="zzz" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M92 30 h9 l-9 10 h9" /><path d="M104 14 h6 l-6 7 h6" /></g>}
        {(mood === 'cheering' || mood === 'proud') && <g className="sparkles"><Sparkle x={10} y={22} s={9} /><Sparkle x={106} y={20} s={7} /><Sparkle x={112} y={86} s={5} /></g>}
        {mood === 'proud' && (
          <g>
            <path d="M60 86 L54 100 M60 86 L66 100" stroke="var(--c477)" strokeWidth="3" />
            <Duo fill="var(--gold)"><circle cx="60" cy="102" r="7" /></Duo>
            <path d="M60 98 l1.4 2.8 3 .4 -2.2 2.1 .5 3 -2.7 -1.4 -2.7 1.4 .5 -3 -2.2 -2.1 3 -.4 z" fill="var(--char-ink)" opacity=".55" />
          </g>
        )}
      </g>
    </svg>
  )
}

export function Sparkle({ x, y, s = 8, fill = 'var(--sparkle)' }: { x: number; y: number; s?: number; fill?: string }) {
  const d = `M${x} ${y - s} Q ${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q ${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q ${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q ${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z`
  return <path d={d} fill={fill} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
}

/* ------------------------------------------------------------------ Tuxedo cat */
export type CatPose = 'sit' | 'loaf' | 'sleep' | 'stretch' | 'jump'
export type CatProps = { pose?: CatPose; size?: number; name?: string; blink?: boolean; className?: string; style?: CSSProperties; sticker?: boolean }

const FUR = 'var(--fur)'
const WHITE = 'var(--fur-white)'

function CatEyes({ x1, x2, y, closed, blink }: { x1: number; x2: number; y: number; closed?: boolean; blink?: boolean }) {
  if (closed) return <g stroke={WHITE} strokeWidth="2.4" strokeLinecap="round" fill="none"><path d={`M${x1 - 3.5} ${y} Q ${x1} ${y + 3} ${x1 + 3.5} ${y}`} /><path d={`M${x2 - 3.5} ${y} Q ${x2} ${y + 3} ${x2 + 3.5} ${y}`} /></g>
  return (
    <g className={blink ? 'cat-eyes blink' : 'cat-eyes'}>
      <ellipse cx={x1} cy={y} rx="3.4" ry="3.8" fill="var(--cat-eye)" />
      <ellipse cx={x2} cy={y} rx="3.4" ry="3.8" fill="var(--cat-eye)" />
      <ellipse cx={x1 + 0.3} cy={y + 0.3} rx="1.6" ry="2.6" fill={INK} />
      <ellipse cx={x2 + 0.3} cy={y + 0.3} rx="1.6" ry="2.6" fill={INK} />
    </g>
  )
}
function Muzzle({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 -14 Q 3 -6 8 -3 Q 13 0 11 5 Q 8 10 0 9 Q -8 10 -11 5 Q -13 0 -8 -3 Q -3 -6 0 -14 Z" fill={WHITE} />
      <path d="M-2 0 L2 0 L0 2.4 Z" fill="var(--cat-nose)" stroke="var(--cat-nose)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M0 2.6 Q -1.8 5.4 -4 4.2 M0 2.6 Q 1.8 5.4 4 4.2" stroke={INK} strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <path d="M9 2 L17 0 M9 5 L17 6 M-9 2 L-17 0 M-9 5 L-17 6" stroke={WHITE} strokeWidth="1" opacity=".8" strokeLinecap="round" />
    </g>
  )
}
const ear = (x: number, y: number, dir: 1 | -1) => `M${x - 8 * dir} ${y + 6} Q ${x - 5 * dir} ${y - 9} ${x + 2 * dir} ${y - 11} Q ${x + 6 * dir} ${y - 2} ${x + 8 * dir} ${y + 6} Z`

export function TuxCat({ pose = 'sit', size = 120, name = 'Tux', blink, className, style, sticker = true }: CatProps) {
  const label = `${name} the tuxedo cat, ${pose === 'sit' ? 'sitting' : pose === 'loaf' ? 'in a loaf' : pose === 'sleep' ? 'curled up asleep' : pose === 'stretch' ? 'stretching' : 'mid-jump'}`
  return (
    <svg viewBox="0 0 140 120" width={size} height={size * 120 / 140} className={['tuxcat', 'pose-' + pose, className || ''].join(' ')} style={style} role="img" aria-label={label}>
      {pose === 'sit' && (
        <g className="cat-breathe">
          <Duo fill={FUR} sticker={sticker}>
            <path d="M102 100 Q 124 98 120 78 Q 117 68 110 72 Q 114 80 108 88 Q 102 94 96 94 Z" />
            <ellipse cx="70" cy="80" rx="33" ry="28" />
            <circle cx="70" cy="46" r="23" />
            <path d={ear(54, 30, 1)} /><path d={ear(86, 30, -1)} />
          </Duo>
          <path d="M70 62 Q 84 70 82 88 Q 78 104 70 104 Q 62 104 58 88 Q 56 70 70 62 Z" fill={WHITE} />
          <Muzzle x={70} y={52} />
          <CatEyes x1={61} x2={79} y={44} blink={blink} />
          <path d={ear(54, 30, 1)} transform="translate(54 30) scale(.45) translate(-54 -30)" fill="var(--cat-ear)" />
          <path d={ear(86, 30, -1)} transform="translate(86 30) scale(.45) translate(-86 -30)" fill="var(--cat-ear)" />
          <Duo fill={WHITE}><ellipse cx="58" cy="106" rx="9" ry="5.5" /><ellipse cx="82" cy="106" rx="9" ry="5.5" /></Duo>
          <path d="M55 104 v3 M61 104 v3 M79 104 v3 M85 104 v3" stroke={INK} strokeWidth="1.2" opacity=".5" />
        </g>
      )}
      {pose === 'loaf' && (
        <g className="cat-breathe">
          <Duo fill={FUR} sticker={sticker}>
            <path d="M24 96 Q 10 98 14 86 Q 20 84 26 88 Z" />
            <path d="M22 92 Q 20 62 56 58 Q 96 54 114 74 Q 124 88 114 100 Q 104 106 66 106 Q 28 106 22 92 Z" />
            <circle cx="88" cy="56" r="21" />
            <path d={ear(74, 40, 1)} /><path d={ear(102, 40, -1)} />
          </Duo>
          <path d="M80 74 Q 94 74 96 86 Q 96 98 88 104 L 74 104 Q 70 92 80 74 Z" fill={WHITE} />
          <Muzzle x={88} y={62} s={0.95} />
          <CatEyes x1={80} x2={96} y={54} blink={blink} />
          <Duo fill={WHITE}><ellipse cx="78" cy="106" rx="8" ry="4.5" /><ellipse cx="96" cy="106" rx="8" ry="4.5" /></Duo>
        </g>
      )}
      {pose === 'sleep' && (
        <g className="cat-breathe">
          {sticker && <path d="M116 88 Q 112 108 76 108 Q 46 108 36 98" stroke="var(--sticker)" strokeWidth="24" strokeLinecap="round" fill="none" />}
          <Duo fill={FUR} sticker={sticker}>
            <ellipse cx="72" cy="82" rx="46" ry="26" />
            <circle cx="42" cy="78" r="20" />
            <path d={ear(30, 64, 1)} /><path d={ear(52, 60, -1)} />
          </Duo>
          <path d="M30 86 Q 42 98 56 88 Q 50 80 42 82 Q 34 84 30 86 Z" fill={WHITE} />
          <g stroke={WHITE} strokeWidth="2.4" strokeLinecap="round" fill="none"><path d="M33 76 Q 36 79 40 76" /><path d="M46 74 Q 49 77 53 74" /></g>
          <path d="M42 82 L45 82 L43.5 84 Z" fill="var(--cat-nose)" />
          {/* tail wrapped over the front */}
          <path d="M116 88 Q 112 108 76 108 Q 46 108 36 98" stroke={INK} strokeWidth="15" strokeLinecap="round" fill="none" />
          <path d="M116 88 Q 112 108 76 108 Q 46 108 36 98" stroke={FUR} strokeWidth="10" strokeLinecap="round" fill="none" />
          <path d="M36 98 Q 34 96 35 94" stroke={WHITE} strokeWidth="6" strokeLinecap="round" />
          <g className="zzz" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 40 h8 l-8 9 h8" /><path d="M8 24 h6 l-6 6 h6" /></g>
        </g>
      )}
      {pose === 'stretch' && (
        <g>
          <Duo fill={FUR} sticker={sticker}>
            <path d="M112 54 Q 124 30 132 30 Q 134 36 128 40 Q 122 50 118 62 Z" />
            <path d="M30 96 Q 38 80 70 72 Q 100 60 116 56 Q 130 60 124 80 Q 118 100 104 104 Q 70 106 30 96 Z" />
            <circle cx="30" cy="84" r="18" />
            <path d={ear(18, 70, 1)} /><path d={ear(40, 68, -1)} />
          </Duo>
          <Muzzle x={30} y={90} s={0.85} />
          <CatEyes x1={23} x2={37} y={82} closed />
          <Duo fill={WHITE}><ellipse cx="10" cy="104" rx="9" ry="4.5" /><ellipse cx="26" cy="106" rx="9" ry="4.5" /><ellipse cx="108" cy="106" rx="8" ry="4.5" /></Duo>
        </g>
      )}
      {pose === 'jump' && (
        <g>
          <g stroke="var(--muted)" strokeWidth="2.4" strokeLinecap="round" opacity=".7"><path d="M6 52 h14" /><path d="M2 64 h18" /><path d="M8 76 h12" /></g>
          <Duo fill={FUR} sticker={sticker}>
            <path d="M34 62 Q 20 46 26 34 Q 30 30 32 36 Q 32 48 42 56 Z" />
            <path d="M30 70 Q 30 46 62 42 Q 96 38 108 50 Q 116 62 104 74 Q 90 86 62 86 Q 32 86 30 70 Z" />
            <circle cx="104" cy="46" r="19" />
            <path d={ear(92, 30, 1)} /><path d={ear(116, 30, -1)} />
          </Duo>
          <path d="M84 62 Q 98 60 102 70 Q 98 82 86 82 Q 78 72 84 62 Z" fill={WHITE} />
          <Muzzle x={106} y={52} s={0.9} />
          <CatEyes x1={98} x2={113} y={44} blink={blink} />
          <Duo fill={WHITE}><ellipse cx="118" cy="76" rx="8" ry="4.5" transform="rotate(-20 118 76)" /><ellipse cx="34" cy="84" rx="8" ry="4.5" transform="rotate(20 34 84)" /><ellipse cx="46" cy="88" rx="8" ry="4.5" transform="rotate(10 46 88)" /></Duo>
        </g>
      )}
    </svg>
  )
}

/* ------------------------------------------------------------------ Plants */
export type PlantProps = { kind: 'flower' | 'strawberry' | 'matcha'; wilted?: boolean; grow?: number; tint?: string; size?: number; title?: string }
export function Plant({ kind, wilted, grow = 1, tint, size = 56, title }: PlantProps) {
  const g = Math.max(0.15, Math.min(1, grow))
  const leaf = wilted ? 'var(--wilt)' : 'var(--leaf)'
  const label = title ?? (wilted ? 'Wilted ' : '') + (kind === 'matcha' ? 'matcha bush' : kind === 'strawberry' ? 'strawberry plant' : 'little flower')
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={label} className={'plant' + (wilted ? ' wilted' : '')}>
      <ellipse cx="32" cy="58" rx="16" ry="4" fill="var(--soil)" />
      <g transform={`translate(32 58) scale(${g}) translate(-32 -58)`} style={{ transition: 'transform .6s' }}>
        <g transform={wilted ? (kind === 'matcha' ? 'translate(0 14) scale(1 .76)' : 'rotate(18 32 58)') : undefined}>
          {kind === 'flower' && <>
            <path d="M32 58 Q 31 44 32 34" stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d="M32 58 Q 31 44 32 34" stroke={leaf} strokeWidth="2.4" strokeLinecap="round" fill="none" />
            <Duo fill={leaf}><path d="M32 50 Q 22 44 20 48 Q 24 54 32 50 Z" /></Duo>
            <Duo fill={wilted ? 'var(--wilt-petal)' : tint || 'var(--pink)'}>
              {[0, 72, 144, 216, 288].map(r => <ellipse key={r} cx="32" cy="24" rx="5.4" ry="7" transform={`rotate(${r} 32 31)`} />)}
            </Duo>
            <circle cx="32" cy="31" r="4.6" fill={wilted ? 'var(--wilt)' : 'var(--gold)'} stroke={INK} strokeWidth="2" />
          </>}
          {kind === 'strawberry' && <>
            <Duo fill={leaf}>
              <path d="M32 56 Q 14 50 14 36 Q 26 36 32 50 Z" /><path d="M32 56 Q 50 50 50 36 Q 38 36 32 50 Z" /><path d="M32 54 Q 22 30 32 22 Q 42 30 32 54 Z" />
            </Duo>
            <path d="M32 54 L32 30" stroke="var(--leaf-dark)" strokeWidth="1.6" opacity=".6" />
            {!wilted && <>
              <Duo fill={tint || 'var(--berry)'}><path d="M46 46 Q 54 46 53 53 Q 51 60 46 60 Q 41 60 39 53 Q 38 46 46 46 Z" /><path d="M17 44 Q 24 44 23 50 Q 22 56 17 56 Q 12 56 11 50 Q 10 44 17 44 Z" /></Duo>
              <path d="M42 46 Q 46 42 50 46 M13 44 Q 17 40 21 44" stroke="var(--leaf-dark)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
              <g fill="var(--seed)"><circle cx="44" cy="52" r=".9" /><circle cx="48" cy="54" r=".9" /><circle cx="46" cy="57" r=".9" /><circle cx="15" cy="49" r=".9" /><circle cx="19" cy="51" r=".9" /></g>
            </>}
          </>}
          {kind === 'matcha' && <>
            <Duo fill={wilted ? 'var(--wilt)' : 'var(--matcha)'}>
              <circle cx="22" cy="42" r="12" /><circle cx="42" cy="42" r="12" /><circle cx="32" cy="30" r="14" /><rect x="14" y="40" width="36" height="16" rx="8" />
            </Duo>
            <g fill={wilted ? 'var(--wilt-petal)' : 'var(--leaf)'} opacity=".95">
              <path d="M28 26 Q 32 18 36 26 Q 32 30 28 26 Z" /><path d="M18 40 Q 20 32 26 38 Q 22 42 18 40 Z" /><path d="M38 38 Q 44 32 46 40 Q 42 42 38 38 Z" />
            </g>
            {!wilted && <g fill="var(--pistachio)"><circle cx="26" cy="48" r="1.6" /><circle cx="40" cy="50" r="1.6" /><circle cx="33" cy="40" r="1.6" /></g>}
          </>}
        </g>
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ Course icons */
export function CourseIcon({ kind, size = 56, color }: { kind: 'coin' | 'chart' | 'gavel' | 'compass'; size?: number; color: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="course-icon">
      {kind === 'coin' && <>
        <Duo fill="var(--gold)"><ellipse cx="34" cy="40" rx="20" ry="8" /><rect x="14" y="30" width="40" height="10" /><ellipse cx="34" cy="30" rx="20" ry="8" /></Duo>
        <ellipse cx="34" cy="30" rx="20" ry="8" fill="var(--gold)" stroke={INK} strokeWidth="2.5" />
        <Duo fill={color}><ellipse cx="26" cy="22" rx="14" ry="6" /><rect x="12" y="16" width="28" height="6" /><ellipse cx="26" cy="16" rx="14" ry="6" /></Duo>
        <ellipse cx="26" cy="16" rx="14" ry="6" fill={color} stroke={INK} strokeWidth="2.5" />
        <path d="M24 13 h5 M24 19 h5" stroke="var(--sticker)" strokeWidth="2" strokeLinecap="round" />
      </>}
      {kind === 'chart' && <>
        <Duo fill="var(--sticker)"><rect x="8" y="10" width="48" height="44" rx="10" /></Duo>
        <path d="M14 44 L30 44 L50 18" stroke={INK} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M14 44 L30 44 L50 18" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="30" cy="44" r="4" fill="var(--gold)" stroke={INK} strokeWidth="2" />
      </>}
      {kind === 'gavel' && <>
        <path d="M30 34 L50 54" stroke={INK} strokeWidth="9" strokeLinecap="round" />
        <path d="M30 34 L50 54" stroke="var(--oat-deep)" strokeWidth="4.5" strokeLinecap="round" />
        <Duo fill={color}><rect x="12" y="14" width="30" height="16" rx="6" transform="rotate(45 27 22)" /></Duo>
        <Duo fill="var(--oat)"><rect x="6" y="50" width="26" height="8" rx="4" /></Duo>
      </>}
      {kind === 'compass' && <>
        <Duo fill="var(--sticker)"><circle cx="32" cy="32" r="22" /></Duo>
        <Duo fill={color}><path d="M32 12 L38 32 L32 36 L26 32 Z" /></Duo>
        <Duo fill="var(--pistachio)"><path d="M32 52 L26 32 L32 28 L38 32 Z" /></Duo>
        <circle cx="32" cy="32" r="3" fill="var(--gold)" stroke={INK} strokeWidth="2" />
      </>}
    </svg>
  )
}
