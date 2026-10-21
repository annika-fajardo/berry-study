/* Tiny event bus for UI reactions (XP fades, toasts, the cat's reactions, level-ups). */
export type Mood = 'happy' | 'cheering' | 'studying' | 'proud' | 'sleepy' | 'worried'
export type CatKind = 'tick' | 'correct' | 'wrong' | 'levelup' | 'timerdone' | 'look'
export type Toast = { id: number; text: string; actionLabel?: string; action?: () => void; ms?: number; cat?: 'proud' | 'sleep' | 'question' | 'alert' }
type Events = {
  xp: { amount: number; x: number; y: number }
  cat: { kind: CatKind }
  levelup: { level: number; name: string }
  toast: Toast
  catblink: Record<string, never>
  capture: { k: 'due' | 'test' | 'class' }
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
/** A small "+N xp" fade near the last pointer/keyboard position, and a reaction from the cat. */
export function celebrateXp(amount: number, kind: CatKind = 'correct') {
  if (amount <= 0) return
  emit('xp', { amount, x: lastPointer.x, y: lastPointer.y })
  emit('cat', { kind })
}
export const catSays = (kind: CatKind) => emit('cat', { kind })
