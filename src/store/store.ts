/* In-memory store with a single save() path. Every change goes through update(); saving is debounced. */
import { useSyncExternalStore } from 'react'
import type { AppState } from './types'
import { pickAdapter, type StorageAdapter } from './storage'
import { migrate } from './migrate'
import { seedState } from './seed'
import { levelInfo, xpTotal } from '../lib/game'
import { emit } from '../lib/events'

let state: AppState | null = null
let adapter: StorageAdapter | null = null
const listeners = new Set<() => void>()
let saveTimer: ReturnType<typeof setTimeout> | null = null
let firstRun = false

export function getState(): AppState { if (!state) throw new Error('store not ready'); return state }
export function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }
function notify() { listeners.forEach(l => l()) }
export function storageName() { return adapter?.name ?? '' }
export function wasFirstRun() { return firstRun }

export function save() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(flush, 250)
}
export async function flush() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  if (adapter && state) { try { await adapter.save(state) } catch (e) { console.warn('save failed', e) } }
}

function checkLevel(before: AppState, after: AppState) {
  const a = levelInfo(xpTotal(before)).level, b = levelInfo(xpTotal(after))
  if (b.level > a) emit('levelup', { level: b.level, name: b.name })
}

/** Mutate a copy of the state. The recipe may change anything; the result is saved once. */
export function update(recipe: (draft: AppState) => void) {
  const before = getState()
  const draft = structuredClone(before)
  recipe(draft)
  state = draft
  notify(); save(); checkLevel(before, draft)
}
export function replaceState(next: AppState) { state = next; notify(); save() }

export async function initStore() {
  adapter = await pickAdapter()
  let raw: unknown = null
  try { raw = await adapter.load() } catch { raw = null }
  if (raw && typeof raw === 'object') {
    try { state = migrate(raw as Record<string, unknown>) } catch (e) { console.warn('could not read saved data, reseeding', e); state = seedState(); firstRun = true }
  } else { state = seedState(); firstRun = true }
  await flush()
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => { void flush() })
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void flush() })
  }
}

export function useAppState() { return useSyncExternalStore(subscribe, getState, getState) }

/** For unit tests and offline rendering scripts only. */
export function __setStateForTests(s: AppState) { state = s }
