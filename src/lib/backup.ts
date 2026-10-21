/* Export / import. A backup is the whole state, so export → import round-trips losslessly. */
import type { AppState } from '../store/types'
import { COLLECTION_KEYS, APP_KEYS } from '../store/types'
import { migrate, CURRENT_SCHEMA } from '../store/migrate'

export type Backup = { app: 'berry-study'; schema: number; exportedAt: string; data: AppState }
export function makeBackup(s: AppState): Backup { return { app: 'berry-study', schema: CURRENT_SCHEMA, exportedAt: new Date().toISOString(), data: structuredClone(s) } }
export function backupFilename() { const d = new Date(); return `berry-study-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json` }

const isObj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x)

/** Accepts a Berry Study backup, or a raw Course Desk export (collections → doc id → document). Throws a friendly Error if invalid. */
export function parseBackup(text: string): AppState {
  let j: unknown
  try { j = JSON.parse(text) } catch { throw new Error("That file isn't valid JSON.") }
  if (!isObj(j)) throw new Error("That file doesn't look like a Berry Study backup.")
  const raw = j.app === 'berry-study' && isObj(j.data) ? j.data : j
  const hasAny = COLLECTION_KEYS.some(k => isObj(raw[k]))
  if (!hasAny) throw new Error('No schedule, grades or practice data found in that file.')
  for (const k of [...COLLECTION_KEYS, ...APP_KEYS]) {
    if (raw[k] == null) continue
    if (!isObj(raw[k])) throw new Error(`"${k}" should be a collection of documents.`)
    if (k !== 'written') for (const [id, doc] of Object.entries(raw[k])) if (!isObj(doc)) throw new Error(`${k}/${id} isn't a document.`)
  }
  for (const [id, i] of Object.entries((raw.items || {}) as Record<string, any>)) {
    if (typeof i.c !== 'string' || typeof i.t !== 'string' || !['test', 'due', 'class'].includes(i.k)) throw new Error(`Schedule item ${id} is missing its course, title or type.`)
    if (i.d != null && !/^\d{4}-\d{2}-\d{2}$/.test(i.d)) throw new Error(`Schedule item ${id} has a date that isn't YYYY-MM-DD.`)
  }
  for (const [id, g] of Object.entries((raw.grades || {}) as Record<string, any>)) {
    if (typeof g.c !== 'string' || typeof g.name !== 'string' || typeof g.wt !== 'number') throw new Error(`Grade row ${id} is missing its course, name or weight.`)
  }
  return migrate(structuredClone(raw))
}

export function summarize(s: AppState) {
  return { items: Object.keys(s.items).length, grades: Object.keys(s.grades).length, practice: Object.keys(s.practice).length, sessions: Object.keys(s.sessions).length, xp: Object.keys(s.xp).length }
}

/** Merge: imported documents win on matching ids; everything else is kept. Settings and a running timer stay as they are. */
export function mergeStates(cur: AppState, inc: AppState): AppState {
  const out = structuredClone(cur)
  for (const k of [...COLLECTION_KEYS, ...APP_KEYS]) (out as any)[k] = { ...(cur as any)[k], ...(inc as any)[k] }
  // A task ticked in either copy keeps exactly one XP entry
  const seen = new Set<string>()
  for (const [id, e] of Object.entries(out.xp)) { if (!e.ref) continue; if (seen.has(e.ref)) delete out.xp[id]; else seen.add(e.ref) }
  return out
}
