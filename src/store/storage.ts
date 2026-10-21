/* Storage layer behind an interface, so a cloud adapter (e.g. Supabase) can be added later
   without touching the app: implement StorageAdapter and pass it to initStore(). */
import { get, set, del } from 'idb-keyval'
import type { AppState } from './types'

export interface StorageAdapter {
  readonly name: string
  load(): Promise<unknown | null>
  save(state: AppState): Promise<void>
  clear(): Promise<void>
}

const KEY = 'berry-study:state'

export class IndexedDbAdapter implements StorageAdapter {
  readonly name = 'IndexedDB (this device)'
  async load() { return (await get(KEY)) ?? null }
  async save(state: AppState) { await set(KEY, state) }
  async clear() { await del(KEY) }
}

/** Used when IndexedDB is unavailable (some private windows). Data lasts for this tab only. */
export class MemoryAdapter implements StorageAdapter {
  readonly name = 'Memory (not saved)'
  private v: AppState | null = null
  async load() { return this.v ? structuredClone(this.v) : null }
  async save(state: AppState) { this.v = structuredClone(state) }
  async clear() { this.v = null }
}

export async function pickAdapter(): Promise<StorageAdapter> {
  try {
    const a = new IndexedDbAdapter()
    await a.load()
    return a
  } catch {
    return new MemoryAdapter()
  }
}
