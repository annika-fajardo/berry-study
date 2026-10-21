/* Emi, drawn in the soft-toy style of the references (variant C): one boneless blob per pose, stubby legs,
   a thick tapering tail, feathered edges, small ears set wide, and thin green outline ring eyes set low and
   wide. Her markings: white chin/moustache patch, a small bib running into a belly streak, white boots on
   all four paws (higher at the back) and long white whiskers.

   Each pose is split into parts (body, head, ears, eyes, tail, paws, marks) so they animate separately.
   <Cat> is used two ways:
   - a status icon: <Cat status="sync" | "question" | "alert" | "busy" | "focus" | "sleep" | "proud" | "done" />
   - the live cat: <Cat live />, which runs the behaviour machine (blinks, ear twitches, tail swish, yawns,
     taps, petting, reactions to app events). <CatTrack> makes her wander inside a scene or along a panel. */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { on } from '../lib/events'
import { useAppState } from '../store/store'

export type CatStatus = 'idle' | 'sync' | 'question' | 'alert' | 'busy' | 'focus' | 'sleep' | 'proud' | 'done'
type Pose = 'sit' | 'low' | 'loaf' | 'curl' | 'stretch' | 'back'
type React_ = '' | 'squish' | 'question' | 'mrrp' | 'roll' | 'purr' | 'hop' | 'slowblink' | 'tilt' | 'yawn' | 'wiggle' | 'zoom' | 'peek' | 'look' | 'groom' | 'hide'
export type AnimMode = 'full' | 'calm' | 'off'

export function useCatMode(): AnimMode {
  const s = useAppState()
  const m = s.settings.catAnim || 'auto'
  if (m !== 'auto') return m
  const reduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return reduced ? 'calm' : 'full'
}

/* ---------------------------------------------------------------- companions
   One component, many cats: colours and markings from a look table, personality from timing multipliers. */
export type Breed = 'emi' | 'tabby' | 'grey' | 'calico' | 'siamese' | 'void' | 'goldstripe'
type Look = { fur: string; white: string; eye: string; whisker: string; point?: string; stripes?: string; patches?: [string, string]; tailTip?: string; marks: boolean }
type Personality = { fidget: number; wander: number; blink: number; yawn: number; zoom: number; mrrp: number; follow: number; knock: number; slow: number }
export const BREEDS: Record<Breed, { name: string; blurb: string; look: Look; p: Personality }> = {
  emi: { name: 'Emi', blurb: 'Tuxedo. The real one.', look: { fur: '#171816', white: '#FAF9F4', eye: '#8FB85F', whisker: '#FAF9F4', marks: true }, p: { fidget: 1, wander: 1, blink: 1, yawn: 1, zoom: 1, mrrp: 1, follow: 1, knock: 1, slow: 1 } },
  tabby: { name: 'Tabby', blurb: 'Orange, lazy, loafs a lot.', look: { fur: '#CE8244', white: '#F7E9D4', eye: '#7E9A3E', whisker: '#FBF3E6', stripes: '#A75A26', marks: false }, p: { fidget: 0.6, wander: 0.5, blink: 1.4, yawn: 2.6, zoom: 0.3, mrrp: 0.8, follow: 0.6, knock: 0.5, slow: 1.6 } },
  grey: { name: 'Smoke', blurb: 'Soft grey, shy at first.', look: { fur: '#868A91', white: '#F4F3F0', eye: '#C9B458', whisker: '#FFFFFF', marks: true }, p: { fidget: 0.8, wander: 0.7, blink: 1.1, yawn: 1, zoom: 0.5, mrrp: 0.6, follow: 0.8, knock: 0.4, slow: 1.2 } },
  calico: { name: 'Pip', blurb: 'Calico chaos. Zoomies.', look: { fur: '#F3EDE2', white: '#FFFDF8', eye: '#B39A3C', whisker: '#8B8378', patches: ['#D98A45', '#2A2622'], marks: false }, p: { fidget: 1.5, wander: 1.6, blink: 0.9, yawn: 0.7, zoom: 4, mrrp: 1.2, follow: 1.2, knock: 3, slow: 0.8 } },
  siamese: { name: 'Mochi', blurb: 'Siamese. Very chatty.', look: { fur: '#E8DCC7', white: '#F6EFE2', eye: '#5E9CC8', whisker: '#FFFFFF', point: '#564031', marks: false }, p: { fidget: 1.2, wander: 1.1, blink: 1, yawn: 0.8, zoom: 0.8, mrrp: 3.5, follow: 2, knock: 1, slow: 0.9 } },
  void: { name: 'Void', blurb: 'All black, gold eyes.', look: { fur: '#121311', white: '#121311', eye: '#E2B33E', whisker: '#4A4C46', marks: false }, p: { fidget: 0.9, wander: 1, blink: 0.8, yawn: 1, zoom: 1.2, mrrp: 0.7, follow: 1.4, knock: 1.2, slow: 1 } },
  goldstripe: { name: 'Goldie', blurb: 'Black, gold-tipped tail.', look: { fur: '#171816', white: '#FAF9F4', eye: '#C9B458', whisker: '#F0E7D2', tailTip: '#D9AF4A', marks: true }, p: { fidget: 1, wander: 1, blink: 1, yawn: 1, zoom: 1.5, mrrp: 1, follow: 1, knock: 1, slow: 1 } },
}
export function useBreed(): Breed {
  const s = useAppState()
  const b = (s.settings.companion || 'emi') as Breed
  return BREEDS[b] ? b : 'emi'
}

/* ---------------------------------------------------------------- poses
   boot: [x, y, w, h, tilt] — a white sock drawn as a rounded blob on the leg, taller at the back. */
type Boot = [number, number, number, number, number]
type PoseDef = {
  body: string; ears?: string
  tail?: string; tailW?: number; tailBehind?: boolean
  eyes: [number, number][]; chin: [number, number]; whisk: [number, number]; whiskSide?: 'both' | 'right'
  bib?: [number, number, number]; belly?: string; boots: Boot[]
  headO: [number, number]; tailO: [number, number]; earLO: [number, number]; earRO: [number, number]
  mark: [number, number]; sleepy?: boolean
}
const POSE: Record<Pose, PoseDef> = {
  /* upright sit, tail curled round the feet */
  sit: {
    body: 'M28.8 92.1 C 24.9 80.4, 25.4 66.2, 27.0 52.3 C 27.6 44.1, 28.2 38.2, 30.3 33.1 L 31.2 24.3 C 31.5 22.1, 33.2 21.5, 34.5 22.9 L 40.1 28.3 C 44.3 27.1, 50.2 26.9, 55.1 28.1 L 61.2 22.5 C 62.5 21.3, 64.2 21.9, 64.1 23.8 L 64.9 33.2 C 67.6 38.6, 68.7 45.2, 69.1 52.1 C 70.6 62.3, 72.4 76.1, 73.6 86.0 C 74.1 89.8, 73.0 92.3, 68.2 92.8 C 54.6 94.0, 40.2 93.6, 28.8 92.1 Z',
    tail: 'M72.4 90.4 C 86.6 92.4, 99.8 90.2, 104.6 83.4 C 107.4 79.4, 106.8 74.4, 103.4 72.8', tailW: 5.6,
    eyes: [[39.6, 46.4], [55.4, 46.6]], chin: [47.6, 52.4], whisk: [47.6, 52.8],
    bib: [47.8, 64.6, 3.6], belly: 'M47.9 70.4 C 48.4 76, 48.6 81, 48.4 85.4',
    boots: [[38.0, 90.2, 7.2, 5.4, -4], [53.4, 90.4, 7.2, 5.4, 4]],
    headO: [47, 54], tailO: [72, 90], earLO: [34, 27], earRO: [62, 27], mark: [86, 16],
  },
  /* crouch, tail up — alert and busy */
  low: {
    body: 'M18.4 92.4 C 11.2 90.6, 9.4 82.4, 14.8 75.4 C 21.2 67.2, 36.2 62.4, 54.2 62.1 C 63.1 62.0, 71.4 62.9, 78.2 64.6 L 80.1 55.4 C 80.4 53.4, 82.3 53.0, 83.4 54.5 L 88.1 60.6 C 91.6 60.2, 94.9 60.5, 97.9 61.5 L 103.1 55.8 C 104.4 54.4, 106.3 55.1, 106.1 57.0 L 105.4 66.6 C 110.1 71.4, 111.4 79.2, 108.9 85.6 C 106.8 90.8, 102.4 92.8, 94.2 93.0 C 70.1 93.8, 38.2 93.9, 18.4 92.4 Z',
    tail: 'M20.4 88.4 C 10.2 84.2, 5.4 70.4, 9.8 56.4 C 11.2 51.8, 15.4 51.0, 16.4 55.0', tailW: 6, tailBehind: true,
    eyes: [[86.4, 74.6], [100.1, 75.0]], chin: [93.3, 80.4], whisk: [93.3, 80.8],
    boots: [[85.2, 91.0, 7.0, 4.6, 0], [99.2, 91.2, 7.0, 4.6, 0], [26.4, 90.0, 8.4, 6.4, -6]],
    headO: [93, 82], tailO: [20, 88], earLO: [83, 58], earRO: [104, 58], mark: [60, 44],
  },
  /* loaf, paws tucked — the focus pose */
  loaf: {
    body: 'M14.1 92.2 C 9.0 89.8, 8.2 80.1, 12.3 72.2 C 17.2 62.1, 30.1 56.2, 46.2 54.6 C 54.1 54.0, 64.0 54.4, 72.1 55.7 L 77.1 47.5 C 78.1 46.0, 80.1 46.3, 80.5 48.0 L 82.1 56.4 C 86.0 56.2, 89.1 56.6, 92.1 57.5 L 97.1 49.7 C 98.1 48.3, 100.1 48.7, 100.3 50.5 L 101.1 59.7 C 107.1 64.1, 109.7 72.0, 108.5 80.1 C 107.4 88.0, 104.1 92.1, 96.1 92.7 C 70.2 94.1, 40.1 94.1, 14.1 92.2 Z',
    tail: 'M15.4 86.8 C 5.0 85.6, 1.4 74.2, 7.4 66.4 C 9.4 63.8, 12.8 64.4, 13.2 67.2', tailW: 6, tailBehind: true,
    eyes: [[84.6, 70.4], [98.2, 70.8]], chin: [91.4, 76.2], whisk: [91.4, 76.6],
    boots: [[84.0, 91.0, 7.4, 4.4, 0], [97.4, 91.2, 7.4, 4.4, 0]],
    headO: [91, 78], tailO: [15, 86], earLO: [79, 50], earRO: [99, 50], mark: [56, 42],
  },
  /* curled asleep, tail wrapped round the front */
  curl: {
    body: 'M16.2 90.1 C 10.1 82.2, 12.2 68.1, 26.1 62.2 C 40.1 56.1, 66.2 55.2, 82.1 58.1 L 86.1 51.1 C 87.1 49.6, 89.1 50.1, 89.2 51.9 L 90.6 59.1 C 93.1 59.9, 95.6 61.1, 97.6 62.5 L 102.6 56.7 C 103.8 55.4, 105.6 56.1, 105.4 57.9 L 104.6 66.7 C 108.4 72.1, 108.4 82.1, 104.1 87.7 C 99.1 93.1, 90.1 93.5, 80.1 93.7 C 58.2 94.4, 30.1 94.4, 16.2 90.1 Z',
    tail: 'M22.4 89.6 C 41.6 97.2, 78.4 97.4, 97.2 90.6', tailW: 6.6,
    eyes: [[92.2, 74.2], [102.0, 74.6]], chin: [97.2, 79.8], whisk: [97.2, 80.2],
    boots: [], sleepy: true,
    headO: [97, 82], tailO: [22, 90], earLO: [88, 54], earRO: [103, 54], mark: [58, 44],
  },
  /* play-bow stretch: front end down, back end up — "done" */
  stretch: {
    body: 'M8.4 92.8 C 4.4 90.4, 4.6 84.4, 9.8 81.6 C 14.4 79.0, 21.4 77.6, 29.4 77.2 C 38.4 76.6, 46.4 73.4, 54.4 67.4 C 63.4 60.4, 72.4 50.4, 82.4 47.2 C 94.4 43.4, 103.4 49.4, 105.4 62.4 C 106.8 72.4, 105.6 82.4, 103.4 90.6 C 102.6 93.0, 100.0 93.8, 97.2 93.2 C 94.4 92.6, 93.2 90.4, 93.8 87.4 C 95.4 79.4, 96.0 70.4, 94.6 64.4 C 88.4 70.4, 78.4 80.4, 68.4 86.0 C 58.4 91.6, 44.4 93.6, 30.4 93.8 C 18.4 94.0, 11.4 94.0, 8.4 92.8 Z',
    ears: 'M13.8 81.2 L 10.4 71.6 C 9.8 69.6, 11.6 68.4, 12.9 69.7 L 18.8 76.0 Z M26.8 77.4 L 29.6 68.4 C 30.2 66.5, 32.3 66.9, 32.5 68.7 L 33.2 76.2 Z',
    tail: 'M101.8 54.4 C 107.4 42.4, 105.4 30.4, 111.4 22.4 C 113.4 19.6, 116.4 20.4, 115.8 23.8', tailW: 5.6, tailBehind: true,
    eyes: [[16.4, 86.0], [27.0, 86.4]], chin: [21.6, 90.6], whisk: [21.6, 90.8],
    boots: [[12.4, 92.0, 7.6, 4.2, 0], [25.4, 92.4, 7.6, 4.2, 0], [97.0, 91.6, 8.0, 6.4, 0]],
    headO: [21, 88], tailO: [101, 54], earLO: [14, 77], earRO: [30, 73], mark: [56, 56],
  },
  /* flopped on her back, legs up, belly showing */
  back: {
    body: 'M26.4 90.4 C 18.4 88.4, 16.4 80.4, 22.4 74.4 C 30.4 66.4, 50.4 63.4, 70.4 64.4 C 88.4 65.4, 100.4 70.4, 102.4 78.4 C 104.4 86.4, 96.4 91.4, 82.4 92.4 C 62.4 93.8, 36.4 92.4, 26.4 90.4 Z',
    ears: 'M24.4 80.4 L 16.4 87.4 C 14.8 88.8, 15.8 90.8, 17.8 90.2 L 26.4 87.4 Z M30.4 74.4 L 28.4 65.4 C 28.0 63.4, 30.4 62.6, 31.4 64.2 L 35.4 71.4 Z',
    tail: 'M100.4 82.4 C 110.4 84.4, 116.4 82.4, 118.4 77.4', tailW: 5.4, tailBehind: true,
    eyes: [[30.4, 81.4], [40.4, 80.8]], chin: [34.4, 86.4], whisk: [34.4, 86.6],
    belly: 'M46.4 68.4 C 58.4 65.9, 74.4 66.4, 86.4 69.4',
    boots: [[50.4, 56.4, 7.0, 5.0, -18], [62.4, 54.4, 7.0, 5.0, -8], [84.4, 58.4, 7.6, 5.6, 14], [94.4, 62.4, 7.6, 5.6, 22]],
    headO: [34, 84], tailO: [100, 82], earLO: [22, 84], earRO: [31, 70], mark: [62, 46],
  },
}
/* legs for the on-her-back pose, drawn behind the body */
const BACK_LEGS = 'M52.4 60.4 C 50.4 68.4, 50.4 72.4, 52.4 76.4 M64.4 58.4 C 62.4 66.4, 62.4 70.4, 64.4 74.4 M84.4 62.4 C 86.4 68.4, 87.4 72.4, 86.4 76.4 M94.4 66.4 C 96.4 70.4, 97.4 74.4, 96.4 78.4'

/* ---------------------------------------------------------------- bits */
function Whisk({ at: [x, y], side = 'both', short, color }: { at: [number, number]; side?: 'both' | 'right'; short?: boolean; color: string }) {
  const k = short ? 0.62 : 1
  const r = [`M${x + 3} ${y - 0.2} C ${x + 11} ${y - 2}, ${x + 19} ${y - 3.4}, ${x + 27 * k} ${y - 5.4 * k}`, `M${x + 3} ${y + 1.4} C ${x + 12} ${y + 1.6}, ${x + 21} ${y + 2.6}, ${x + 29 * k} ${y + 4.2 * k}`]
  const l = [`M${x - 3} ${y - 0.2} C ${x - 11} ${y - 2}, ${x - 19} ${y - 3.4}, ${x - 27 * k} ${y - 5.4 * k}`, `M${x - 3} ${y + 1.4} C ${x - 12} ${y + 1.6}, ${x - 21} ${y + 2.6}, ${x - 29 * k} ${y + 4.2 * k}`]
  return <g className="cat-whiskers" stroke={color} strokeWidth=".62" strokeLinecap="round" fill="none" opacity=".9">{[...r, ...(side === 'both' ? l : [])].map((d, i) => <path key={i} d={d} />)}</g>
}
const chinPath = (x: number, y: number) => `M${x - 0.7} ${y - 0.3} C ${x - 0.1} ${y - 0.9}, ${x + 0.6} ${y - 0.8}, ${x + 1.0} ${y - 0.2} C ${x + 2.0} ${y + 0.8}, ${x + 2.0} ${y + 2.4}, ${x + 1.0} ${y + 3.2} C ${x + 0.3} ${y + 3.7}, ${x - 0.8} ${y + 3.6}, ${x - 1.4} ${y + 3.0} C ${x - 2.2} ${y + 2.0}, ${x - 1.9} ${y + 0.6}, ${x - 0.7} ${y - 0.3} Z`
const bibPath = (x: number, y: number, r: number) => `M${x - r * 0.9} ${y - r * 0.6} C ${x - r * 0.3} ${y - r * 0.2}, ${x + r * 0.3} ${y - r * 0.2}, ${x + r * 0.9} ${y - r * 0.6} C ${x + r * 0.7} ${y + r * 0.6}, ${x + r * 0.2} ${y + r * 1.4}, ${x} ${y + r * 1.7} C ${x - r * 0.2} ${y + r * 1.4}, ${x - r * 0.7} ${y + r * 0.6}, ${x - r * 0.9} ${y - r * 0.6} Z`
/** A boot: a soft rounded sock blob, wider at the foot. */
const bootPath = ([x, y, w, h]: Boot) => `M${x - w / 2} ${y} C ${x - w / 2 - 0.4} ${y - h * 0.75}, ${x - w * 0.3} ${y - h}, ${x} ${y - h} C ${x + w * 0.3} ${y - h}, ${x + w / 2 + 0.4} ${y - h * 0.75}, ${x + w / 2} ${y} C ${x + w / 2} ${y + 2.2}, ${x + w * 0.3} ${y + 2.8}, ${x} ${y + 2.8} C ${x - w * 0.3} ${y + 2.8}, ${x - w / 2} ${y + 2.2}, ${x - w / 2} ${y} Z`

function Marks({ kind, at, forehead }: { kind: string; at: [number, number]; forehead: [number, number] }) {
  const [x, y] = kind === 'spinner' ? forehead : at
  if (!kind) return null
  return (
    <g className={'cat-mark mark-' + kind} transform={`translate(${x} ${y})`} fill="none" stroke="var(--cat-mark)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'question' && <><path d="M0.2 -4.6 C 0.4 -9.2, 7.6 -9.4, 7.4 -4.8 C 7.2 -1.8, 3.6 -1.6, 3.7 1.8" /><path d="M3.7 5.2 l.1 .2" strokeWidth="2.6" /></>}
      {kind === 'spinner' && <g className="spin">{Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return <path key={i} d={`M${Math.cos(a) * 3} ${Math.sin(a) * 3} L ${Math.cos(a) * 5.6} ${Math.sin(a) * 5.6}`} stroke="#F4F2EC" strokeWidth="1.8" opacity={0.25 + i * 0.1} /> })}</g>}
      {kind === 'alert' && <g><path d="M0 2.6 L 8.6 -2.4 L 10.4 8.4 L 1.6 7.8 Z" /><path d="M10.4 -1 l3.4 -3 M11.6 3.6 h4.2 M10.6 8.2 l3.4 2.4" strokeWidth="1.4" /><path d="M-6 -10 l1.2 8" strokeWidth="2.2" /><path d="M-4.6 -0.2 l.1 .2" strokeWidth="2.8" /></g>}
      {kind === 'busy' && <g><path d="M-2 4 C -10 3.6, -13 -4, -10 -10 C -7 -16.6, 3.4 -18, 8.4 -12.4 C 12.8 -7.4, 10.4 1.4, 3.4 3.8 L 0.6 8.8 Z" /><g className="spin-slow" strokeWidth="1"><path d="M-6 -7 C -2 -12, 5 -11, 4 -6 C 3 -2, -4 -3, -3 -8 C -2 -12, 6 -10, 5 -4 C 4 0, -3 0, -5 -4" /></g></g>}
      {kind === 'mrrp' && <g><path d="M-4 2 C -10 1, -12 -6, -8 -10 C -3 -14.6, 9 -14.2, 12 -8.4 C 14.6 -3.4, 10 1.8, 3 2.2 L -2 7 Z" /><path d="M-6 -6 c2 -3 3 3 5 0 s3 3 5 0 s3 3 5 0" strokeWidth="1.3" /></g>}
      {kind === 'purr' && <g strokeWidth="1.3"><path d="M-8 -2 c1.5 -2 3 2 4.5 0 s3 2 4.5 0" /><path d="M4 -9 c1.5 -2 3 2 4.5 0 s3 2 4.5 0" /><path d="M-2 -15 c1.5 -2 3 2 4.5 0 s3 2 4.5 0" /></g>}
      {kind === 'zzz' && <g strokeWidth="1.5"><path d="M0 0 h4.6 l-4.6 5 h4.6" /><path d="M7 -9 h3.4 l-3.4 3.8 h3.4" /></g>}
    </g>
  )
}

type DrawProps = { pose: Pose; eyes: 'open' | 'closed' | 'happy'; sleepy?: number; mark?: string; look?: [number, number]; yawn?: boolean; breed: Breed; uid: string; soft: boolean }
function CatDrawing({ pose, eyes, sleepy = 0, mark, look = [0, 0], yawn, breed, uid, soft }: DrawProps) {
  const p = POSE[pose]
  const L = BREEDS[breed].look
  const F = L.fur, W = L.white, E = L.eye, PT = L.point || L.fur
  const pat = L.stripes ? `url(#${uid}-st)` : L.patches ? `url(#${uid}-pa)` : null
  const tw = p.tailW ?? 6
  const tail = p.tail && (
    <g className="cat-tail" style={{ transformOrigin: `${p.tailO[0]}px ${p.tailO[1]}px` }}>
      <path d={p.tail} fill="none" stroke={PT} strokeWidth={tw} strokeLinecap="round" />
      {L.stripes && <path d={p.tail} fill="none" stroke={L.stripes} strokeWidth={tw} strokeDasharray="2.4 5" opacity=".55" />}
      {L.patches && <path d={p.tail} fill="none" stroke={L.patches[0]} strokeWidth={tw} strokeLinecap="round" strokeDasharray="7 11" />}
      {L.tailTip && <path d={p.tail} fill="none" stroke={L.tailTip} strokeWidth={tw} strokeLinecap="round" pathLength={100} strokeDasharray="15 100" strokeDashoffset={-85} />}
    </g>
  )
  return (
    <>
      <defs>
        {soft && (
          <filter id={uid + '-soft'} x="-12%" y="-12%" width="124%" height="124%">
            <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" result="d" />
            <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="3" result="f" />
            <feDisplacementMap in="d" in2="f" scale="0.9" result="e" />
            <feGaussianBlur in="e" stdDeviation="0.5" />
          </filter>
        )}
        {L.stripes && <pattern id={uid + '-st'} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><path d="M0 2 C 3 1, 6 3, 9 2" stroke={L.stripes} strokeWidth="2.2" fill="none" opacity=".5" /></pattern>}
        {L.patches && <pattern id={uid + '-pa'} width="58" height="46" patternUnits="userSpaceOnUse"><path d="M4 6 C 14 0, 26 4, 24 14 C 22 24, 8 24, 4 16 Z" fill={L.patches[0]} /><path d="M34 22 C 44 16, 56 22, 52 32 C 48 42, 34 40, 32 32 Z" fill={L.patches[1]} /><path d="M14 32 C 20 28, 28 32, 26 38 C 24 44, 14 44, 12 38 Z" fill={L.patches[0]} /></pattern>}
      </defs>
      <g filter={soft ? `url(#${uid}-soft)` : undefined}>
        {/* halo keeps her readable on photos and dark panels */}
        <g className="cat-halo" fill="var(--cat-halo)" stroke="var(--cat-halo)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
          <path d={p.body} />{p.ears && <path d={p.ears} />}
          {p.tail && <path d={p.tail} fill="none" strokeWidth={tw + 3} />}
        </g>
        {p.tailBehind && tail}
        {pose === 'back' && <path d={BACK_LEGS} fill="none" stroke={PT} strokeWidth="6.4" strokeLinecap="round" />}
        <g className="cat-body" style={{ transformOrigin: `${p.headO[0]}px 94px` }}>
          <path d={p.body} fill={F} />
          {pat && <path d={p.body} fill={pat} />}
          {p.ears && <path d={p.ears} fill={PT} />}
          {L.marks && p.bib && <path d={bibPath(...p.bib)} fill={W} opacity=".95" />}
          {L.marks && p.belly && <path d={p.belly} fill="none" stroke={W} strokeWidth={pose === 'back' ? 5 : 2.4} strokeLinecap="round" opacity=".92" />}
          {L.marks && p.boots.map((b, i) => <path key={i} d={bootPath(b)} fill={W} transform={b[4] ? `rotate(${b[4]} ${b[0]} ${b[1]})` : undefined} />)}
        </g>
        {!p.tailBehind && tail}
      </g>
      <g className="cat-head" style={{ transformOrigin: `${p.headO[0]}px ${p.headO[1]}px` }}>
        {L.marks !== false && <path d={chinPath(p.chin[0], p.chin[1])} fill={W} />}
        {yawn && <ellipse className="yawn-mouth" cx={p.chin[0]} cy={p.chin[1] + 1.4} rx="1.8" ry="2.4" fill="var(--cat-mouth)" />}
        <Whisk at={p.whisk} side={p.whiskSide} short={pose === 'curl'} color={L.whisker} />
        <g className="cat-eyes" style={{ transform: `translate(${look[0]}px, ${look[1]}px)` }}>
          {p.eyes.map(([x, y], i) => eyes === 'open'
            ? <g key={i} className="eye" style={{ transformOrigin: `${x}px ${y}px` }}>
                <circle cx={x} cy={y} r="3.1" fill="none" stroke={E} strokeWidth="1.25" />
                {sleepy > 0.05 && <rect className="lid" x={x - 4} y={y - 4.2} width="8" height={4.2 * 2 * Math.min(1, sleepy)} fill={PT} />}
              </g>
            : <path key={i} d={eyes === 'happy' ? `M${x - 2.6} ${y + 0.8} Q ${x} ${y - 2.4} ${x + 2.6} ${y + 0.8}` : p.sleepy ? `M${x - 2.6} ${y} h5.2` : `M${x - 2.4} ${y - 0.8} Q ${x} ${y + 2.4} ${x + 2.4} ${y - 0.8}`}
                fill="none" stroke={E} strokeWidth="1.3" strokeLinecap="round" />)}
        </g>
      </g>
      <Marks kind={mark || ''} at={p.mark} forehead={[(p.eyes[0][0] + p.eyes[p.eyes.length - 1][0]) / 2 - 1, p.eyes[0][1] - 11]} />
    </>
  )
}

const STATUS: Record<CatStatus, { pose: Pose; eyes: DrawProps['eyes']; mark?: string }> = {
  idle: { pose: 'sit', eyes: 'open' },
  sync: { pose: 'sit', eyes: 'open', mark: 'spinner' },
  question: { pose: 'sit', eyes: 'open', mark: 'question' },
  alert: { pose: 'low', eyes: 'open', mark: 'alert' },
  busy: { pose: 'low', eyes: 'open', mark: 'busy' },
  focus: { pose: 'loaf', eyes: 'open' },
  sleep: { pose: 'curl', eyes: 'closed', mark: 'zzz' },
  proud: { pose: 'sit', eyes: 'happy' },
  done: { pose: 'stretch', eyes: 'happy' },
}
const STATUS_LABEL: Record<CatStatus, string> = { idle: 'sitting', sync: 'syncing', question: 'puzzled', alert: 'sounding the alarm', busy: 'thinking', focus: 'loafing by the timer', sleep: 'asleep', proud: 'sitting proudly', done: 'stretching' }

export type CatProps = { status?: CatStatus; size?: number; live?: boolean; sleepy?: number; className?: string; style?: CSSProperties; label?: string; caption?: boolean; breed?: Breed }

let warmth = 0 // the shy one warms up over a session
export function Cat({ status = 'idle', size = 56, live = false, sleepy = 0, className, style, label, caption, breed: breedProp }: CatProps) {
  const s = useAppState()
  const chosen = useBreed()
  const breed = breedProp || chosen
  const P = BREEDS[breed].p
  const name = breed === 'emi' ? (s.settings.catName || 'Emi') : BREEDS[breed].name
  const uidRef = useRef('c' + Math.random().toString(36).slice(2, 8))
  const mode = useCatMode()
  const animate = mode !== 'off'
  const full = mode === 'full'
  const ref = useRef<SVGSVGElement>(null)
  const base = STATUS[status]
  const [react, setReact] = useState<React_>('')
  const [pose, setPose] = useState<Pose | null>(null)
  const [blink, setBlink] = useState(false)
  const [twitch, setTwitch] = useState<'' | 'l' | 'r'>('')
  const [petting, setPetting] = useState(false)
  const [look, setLook] = useState<[number, number]>([0, 0])
  const [cap, setCap] = useState('')
  const taps = useRef<number[]>([])
  const press = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (fn: () => void, ms: number) => { const t = setTimeout(fn, ms); timers.current.push(t); return t }
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])

  const doReact = useCallback((r: React_, ms = 1400, p?: Pose) => {
    if (!animate) return
    if (!full && r !== 'slowblink') return
    setReact(r); if (p) setPose(p)
    later(() => { setReact(''); if (p) setPose(null) }, ms)
  }, [animate, full])

  // idle: blinks every 3–7s, ear twitches, the odd yawn or head tilt
  useEffect(() => {
    if (!animate) return
    let alive = true
    const blinkLoop = () => { if (!alive) return; later(() => { setBlink(true); later(() => setBlink(false), 170 * P.slow); blinkLoop() }, (3000 + Math.random() * 4000) * P.blink) }
    blinkLoop()
    if (!full || !live) return () => { alive = false }
    const misc = () => {
      if (!alive) return
      later(() => {
        const w: [React_ | 'twitch', number][] = [['twitch', 4.5], ['yawn', 1.7 * P.yawn], ['tilt', 1.6], ['groom', 0.6], ['zoom', 0.08 * P.zoom], ['mrrp', 0.3 * P.mrrp]]
        let r = Math.random() * (w.reduce((a, x) => a + x[1], 0) + 2)
        for (const [k, x] of w) {
          r -= x; if (r > 0) continue
          if (k === 'twitch') { const side = Math.random() < 0.5 ? 'l' : 'r'; setTwitch(side); later(() => setTwitch(''), 380) }
          else doReact(k, k === 'yawn' ? 1800 * P.slow : k === 'zoom' ? 1700 : k === 'groom' ? 2400 : 1300)
          break
        }
        misc()
      }, (6000 + Math.random() * 9000) / P.fidget)
    }
    misc()
    return () => { alive = false }
  }, [animate, full, live, doReact])

  // eyes follow the pointer (or the last tap) within a small radius
  useEffect(() => {
    if (!live || !full) return
    const f = (e: globalThis.PointerEvent) => {
      const el = ref.current; if (!el) return
      const r = el.getBoundingClientRect(), cx = r.left + r.width * 0.5, cy = r.top + r.height * 0.45
      const dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / (240 / P.follow))
      setLook([dx / d * 1.1 * k, dy / d * 0.9 * k])
    }
    window.addEventListener('pointermove', f); window.addEventListener('pointerdown', f)
    return () => { window.removeEventListener('pointermove', f); window.removeEventListener('pointerdown', f) }
  }, [live, full])

  // app events
  useEffect(() => {
    if (!live) return
    return on('cat', e => {
      if (e.kind === 'tick') doReact('hop', 900)
      else if (e.kind === 'correct') doReact('slowblink', 1600)
      else if (e.kind === 'wrong') doReact('question', 1500)
      else if (e.kind === 'levelup') doReact('wiggle', 1400)
      else if (e.kind === 'timerdone') doReact('hop', 1800, 'stretch')
      else if (e.kind === 'look') doReact('look', 1200)
    })
  }, [live, doReact])

  const reactions: React_[] = ['squish', 'question', 'mrrp', 'roll', 'purr']
  const onTap = () => {
    if (!live) return
    const now = Date.now()
    taps.current = [...taps.current.filter(t => now - t < 1500), now]
    if (taps.current.length >= 5 && full) { taps.current = []; doReact('zoom', 1700); return }
    warmth++
    if (breed === 'grey' && taps.current.length >= 3) { doReact('hide', 1800); return }
    if (breed === 'grey' && warmth < 5) { doReact(Math.random() < 0.5 ? 'peek' : 'slowblink', 1300); return }
    const pool = [...reactions, ...Array(Math.max(0, Math.round(P.mrrp) - 1)).fill('mrrp')] as React_[]
    const r = pool[Math.floor(Math.random() * pool.length)]
    if (!full) { doReact('slowblink', 1400); return }
    doReact(r, r === 'roll' ? 2200 : 1400, r === 'roll' ? 'back' : undefined)
  }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap() } }
  const onDown = () => {
    if (!live) return
    if (press.current) clearTimeout(press.current)
    press.current = setTimeout(() => { press.current = null; setPose('loaf'); setCap(`${name} is loafing`); later(() => { setPose(null); setCap('') }, 2600) }, 550)
  }
  const onUp = () => { if (press.current) { clearTimeout(press.current); press.current = null } }

  const curPose: Pose = pose || (status === 'idle' && live && breed === 'tabby' ? 'loaf' : base.pose)
  let eyes: DrawProps['eyes'] = POSE[curPose].sleepy ? 'closed' : base.eyes
  if (petting || react === 'squish' || react === 'purr' || react === 'wiggle') eyes = 'happy'
  if (react === 'slowblink') eyes = 'closed'
  if (curPose === 'stretch') eyes = 'happy'
  if (blink && eyes === 'open') eyes = 'closed'
  const mark = react === 'question' ? 'question' : react === 'mrrp' ? 'mrrp' : react === 'purr' ? 'purr' : base.mark
  const nm = label ?? `${name} the ${breed === 'emi' ? 'tuxedo ' : ''}cat, ${react === 'roll' ? 'rolling over' : STATUS_LABEL[status]}`
  const cls = ['cat', 'breed-' + breed, 'st-' + status, 'pose-' + curPose, animate ? 'anim' : 'still', full ? 'full' : 'calm', react ? 'r-' + react : '', twitch ? 'tw-' + twitch : '', petting ? 'petting' : '', live ? 'live' : '', className || ''].join(' ')
  return (
    <span className={'cat-wrap' + (live ? ' is-live' : '')} style={style}>
      <svg ref={ref} viewBox="0 0 120 100" width={size} height={size * 100 / 120} className={cls} role={live ? 'button' : 'img'} aria-label={nm}
        tabIndex={live ? 0 : undefined} data-reaction={react || undefined} data-pose={curPose}
        onClick={live ? onTap : undefined} onKeyDown={live ? onKey : undefined}
        onPointerDown={live ? onDown : undefined} onPointerUp={live ? onUp : undefined}
        onPointerEnter={live ? () => { setPetting(true); if (caption !== false) setCap(name) } : undefined}
        onPointerLeave={live ? () => { setPetting(false); onUp(); if (!pose) setCap('') } : undefined}>
        <g className="cat-all">
          {react === 'zoom' && <g className="speed" stroke="var(--cat-mark)" strokeWidth="1.4" strokeLinecap="round" opacity=".5"><path d="M2 60 h12" /><path d="M0 70 h16" /><path d="M4 80 h10" /></g>}
          <CatDrawing pose={curPose} eyes={eyes} sleepy={status === 'focus' ? sleepy * 0.75 : 0} mark={mark} look={look} yawn={react === 'yawn'} breed={breed} uid={uidRef.current} soft={size >= 40} />
        </g>
      </svg>
      {live && cap && <span className="cat-cap" aria-hidden="true">{cap}</span>}
    </span>
  )
}

/* ---------------------------------------------------------------- wandering */
/** A strip the live cat walks along: she wanders, sits, grooms and curls up.
    At most one wander every ~45s, never while a quiz question is open, and only inside the strip. */
export function CatTrack({ size = 54, status, sleepy, rest = 'right', bottom = 0 }: { size?: number; status?: CatStatus; sleepy?: number; rest?: 'left' | 'right'; bottom?: number }) {
  const mode = useCatMode()
  const P = BREEDS[useBreed()].p
  const trackRef = useRef<HTMLDivElement>(null)
  const [x, setX] = useState<number | null>(null)
  const [phase, setPhase] = useState<'rest' | 'walk' | 'sit' | 'curl'>('rest')
  const [dir, setDir] = useState<1 | -1>(-1)
  const last = useRef(0)
  const still = useRef<{ x: number; t: number } | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)) }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const width = () => Math.max(40, (trackRef.current?.clientWidth || 300) - size)
  useEffect(() => { setX(rest === 'right' ? width() : 0) }, [])
  const walkTo = useCallback((tx: number) => {
    const cur = x ?? 0
    setDir(tx < cur ? -1 : 1); setPhase('walk'); setX(tx)
    const dur = Math.min(4200, Math.abs(tx - cur) * 14 + 400)
    later(() => { setPhase('sit'); later(() => setPhase('curl'), 3200); later(() => setPhase('rest'), 10000) }, dur)
  }, [x])
  useEffect(() => {
    if (mode !== 'full') return
    const iv = setInterval(() => {
      if (document.querySelector('[data-quiz-active="true"]') || Date.now() - last.current < 45000 || phase === 'walk') return
      if (Math.random() < 0.5 * P.wander) { last.current = Date.now(); walkTo(Math.round(Math.random() * width())) }
    }, 5000)
    return () => clearInterval(iv)
  }, [mode, phase, walkTo])
  useEffect(() => {
    if (mode !== 'full') return
    const f = (e: globalThis.PointerEvent) => {
      const r = trackRef.current?.getBoundingClientRect(); if (!r) return
      if (e.clientY < r.top - 160 || e.clientY > r.bottom + 40 || e.clientX < r.left || e.clientX > r.right) { still.current = null; return }
      still.current = { x: e.clientX - r.left - size / 2, t: Date.now() }
    }
    const iv = setInterval(() => {
      const st = still.current
      if (st && Date.now() - st.t > 1800 / P.follow && Date.now() - last.current > 45000 && phase !== 'walk' && !document.querySelector('[data-quiz-active="true"]')) {
        last.current = Date.now(); still.current = null; walkTo(Math.max(0, Math.min(width(), st.x)))
      }
    }, 600)
    window.addEventListener('pointermove', f)
    return () => { window.removeEventListener('pointermove', f); clearInterval(iv) }
  }, [mode, phase, walkTo])
  const st: CatStatus = status ?? (phase === 'curl' ? 'sleep' : 'idle')
  return (
    <div className="cat-track" ref={trackRef} data-cat-phase={phase} data-cat-mode={mode}>
      <div className={'cat-walker' + (phase === 'walk' ? ' walking' : '')} style={{ bottom, transform: `translateX(${x ?? 0}px) scaleX(${dir})`, transitionDuration: phase === 'walk' ? '3.2s' : '0s' }}>
        <Cat live status={st} size={size} sleepy={sleepy} className={phase === 'sit' ? 'grooming' : ''} />
      </div>
    </div>
  )
}

/** Emi's head: ears, green ring eyes, white chin. Used for the favicon and app icon on a sage tile. */
export function CatHead({ size = 64, tile = true }: { size?: number; tile?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      {tile && <rect width="64" height="64" rx="14" fill="#9CAD8C" />}
      <g transform="translate(32 38) scale(.85) translate(-48 -46)">
        <path d="M28.8 86 C 24.9 74, 25.4 62, 27.0 50.3 C 27.6 43.1, 28.2 38.2, 30.3 33.1 L 31.2 24.3 C 31.5 22.1, 33.2 21.5, 34.5 22.9 L 40.1 28.3 C 44.3 27.1, 50.2 26.9, 55.1 28.1 L 61.2 22.5 C 62.5 21.3, 64.2 21.9, 64.1 23.8 L 64.9 33.2 C 67.6 38.6, 68.7 45.2, 69.1 52.1 C 70.0 60, 70.4 68, 69.8 74 C 56 76, 40 75.6, 28.8 74 Z" fill="#171816" />
        <path d={chinPath(47.6, 52.4)} fill="#FAF9F4" />
        <circle cx="39.6" cy="46.4" r="3.6" fill="none" stroke="#8FB85F" strokeWidth="1.6" />
        <circle cx="55.4" cy="46.6" r="3.6" fill="none" stroke="#8FB85F" strokeWidth="1.6" />
      </g>
    </svg>
  )
}
