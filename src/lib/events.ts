/* Tiny event bus for UI reactions (XP floats, Berry moods, toasts, level-ups). */
export type Mood = 'happy' | 'cheering' | 'studying' | 'proud' | 'sleepy' | 'worried'
export type Toast = { id: number; text: string; actionLabel?: string; action?: () => void; ms?: number }
type Events = {
  xp: { amount: number; x: number; y: number }
  berry: { mood: Mood }
  levelup: { level: number; name: string }
  toast: Toast
  catblink: Record<string, never>
}
type Handler<K extends keyof Events> = (e: Events[K]) => void
const handlers: { [K in keyof Events]?: Set<Handler<K>> } = {}
export function on<K extends keyof Events>(k: K, h: Handler<K>) {
  const set = (handlers[k] ??= new Set() as never) as Set<Handler<K>>
  set.add(h); return () => { set.delete(h) }
}
export function emit<K extends keyof Events>(k: K, e: Events[K]) { (handlers[k] as Set<Handler<K>> | undefined)?.forEach(h => h(e)) }

let lastPointer = { x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0, y: 200 }
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', e => { lastPointer = { x: e.clientX, y: e.clientY } }, true)
  window.addEventListener('keydown', () => {
    const a = document.activeElement as HTMLElement | null
    if (a && a !== document.body) { const r = a.getBoundingClientRect(); lastPointer = { x: r.left + r.width / 2, y: r.top } }
  }, true)
}
let toastId = 1
export function toast(text: string, opts: Omit<Toast, 'id' | 'text'> = {}) { emit('toast', { id: toastId++, text, ...opts }) }
/** Show a "+N" float near the last pointer/keyboard position and make Berry react. */
export function celebrateXp(amount: number, mood: Mood = 'cheering') {
  if (amount <= 0) return
  emit('xp', { amount, x: lastPointer.x, y: lastPointer.y })
  emit('berry', { mood })
}
