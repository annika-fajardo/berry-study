/* Gamification: XP ledger, levels, streaks, plants. Totals are always recomputed from the ledger. */
import type { AppState, Item, PlantKind, XpEntry } from '../store/types'
import { todayStr, addDays, uid } from './dates'

export const XP = { correct: 10, firstTry: 5, cleanRound: 30, perMinute: 1 } as const
const KIND_BASE: Record<string, number> = { class: 5, due: 15, test: 25 }
const WEIGHT_BONUS_CAP = 30

/** Ticking a task: class prep 5, deadline 15, test 25, plus 1 XP per weight-% point (bonus capped at 30). */
export function itemXp(i: Pick<Item, 'k' | 'w'>) {
  const base = KIND_BASE[i.k] ?? 5
  const n = i.w && !/^of/.test(i.w) ? parseFloat(i.w) : 0
  return base + Math.min(WEIGHT_BONUS_CAP, isFinite(n) ? Math.round(n) : 0)
}

export function xpTotal(s: AppState) { let t = 0; for (const e of Object.values(s.xp)) t += e.amount; return Math.max(0, t) }

export const LEVEL_NAMES = ['Seed', 'Sprout', 'Bud', 'Blossom', 'Berry', 'Ripe Berry', 'Matcha Master', 'Jam Jar', 'Berry Patch', 'Strawberry Moon', 'Orchard Keeper', 'Matcha Sage', 'Grand Gardener']
/** XP needed to reach level L (1-based). Rising curve: steps of 100, 160, 220, 280 … */
export function threshold(L: number) { let t = 0; for (let k = 1; k < L; k++) t += 100 + 60 * (k - 1); return t }
export function levelName(L: number) { return L <= LEVEL_NAMES.length ? LEVEL_NAMES[L - 1] : 'Matcha Legend ' + (L - LEVEL_NAMES.length + 1) }
export function levelInfo(total: number) {
  let L = 1; while (threshold(L + 1) <= total) L++
  const cur = threshold(L), next = threshold(L + 1)
  return { level: L, name: levelName(L), cur, next, total, pct: Math.min(1, (total - cur) / (next - cur)) }
}

export function activeDates(s: AppState) { const set = new Set<string>(); for (const e of Object.values(s.xp)) if (e.amount > 0) set.add(e.date); return set }
/** Consecutive days with at least one XP action, counting back from today (or yesterday if today is still empty). */
export function streak(s: AppState, t = todayStr()) {
  const days = activeDates(s); let d = days.has(t) ? t : addDays(t, -1), n = 0
  while (days.has(d)) { n++; d = addDays(d, -1) }
  return { count: n, today: days.has(t) }
}
export function lastActive(s: AppState) { let best = ''; for (const d of activeDates(s)) if (d > best) best = d; return best || null }

export function makeXp(amount: number, reason: string, extra: Partial<XpEntry> = {}, date = todayStr()): XpEntry {
  return { id: uid('xp'), ts: new Date().toISOString(), date, amount, reason, ...extra }
}
/** Adds an entry; when `ref` is given and already present, nothing is added (no double-dipping). */
export function grantXp(d: AppState, amount: number, reason: string, extra: Partial<XpEntry> = {}, date?: string) {
  if (extra.ref && Object.values(d.xp).some(e => e.ref === extra.ref)) return 0
  const e = makeXp(amount, reason, extra, date); d.xp[e.id] = e; return amount
}
export function revokeXp(d: AppState, ref: string) { let n = 0; for (const [k, e] of Object.entries(d.xp)) if (e.ref === ref) { n += e.amount; delete d.xp[k] } return n }

export function plantFor(minutes: number): PlantKind { return minutes >= 50 ? 'matcha' : minutes >= 25 ? 'strawberry' : 'flower' }
export const PLANT_LABEL: Record<PlantKind, string> = { flower: 'Little flower', strawberry: 'Strawberry plant', matcha: 'Matcha bush' }
