/* In-session UI state for the course tools (like the old app's globals): survives tab switches, not reloads.
   Anything that matters long-term (practice, mastery, deck runs, XP) is written to the store. */
import type { BuiltQ } from '../data/drills'
import type { DrillQ } from '../data/drills'
export type PracState = { tries: number; done: boolean; picked: number[] }
export type ConceptQ = { stem: string; options: string[]; answer: number; whys: (string | null)[]; explain: string; cid: string; cname: string; picked: number | null; steps?: undefined }
export type AQ = { c: string; state: 'quiz' | 'done'; qs: (BuiltQ | ConceptQ)[]; round: number; focusWeak: boolean; results?: Record<string, { name: string; seen: number; correct: number }> }
export const ui = {
  prac: {} as Record<string, PracState>,
  drill: null as null | { k: string; p: DrillQ; done: boolean; ok?: boolean; val?: string },
  aq: null as AQ | null,
  fc: null as null | { c: string; deck: string[]; flipped: boolean; known: number; total: number },
  openDeck: null as null | { deck: string; run: string },
  checkTries: {} as Record<string, number>,
}
