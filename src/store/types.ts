/* Data model. Collections and field names from the old Course Desk are kept exactly
   (items, grades, practice, mastery, study, decks, deckruns, deckmeta) so ids keep matching. */
export type Kind = 'test' | 'due' | 'class'
export type Item = { id: string; c: string; d?: string | null; k: Kind; t: string; w?: string | null; n?: string | null; done?: boolean }
export type Grade = { id: string; c: string; name: string; wt: number; score?: number | null; d?: string; o?: number }
export type Practice = { c: string; label: string; tries: number; correct: number; last?: string }
export type Mastery = { c: string; concept: string; seen: number; correct: number; last?: string }
export type StudyDay = Record<string, number> // course -> minutes
export type DeckQ = {
  id: string; type: 'mc' | 'written'; stem: string; topic: string; lvl?: string
  opts: string[]; a: number; explain?: string; key?: string[]; note?: string
}
export type Deck = { c: string; title: string; covers?: string; created?: string; n?: number; stage?: string; qs: DeckQ[] }
export type DeckResult = { v: 'correct' | 'partial' | 'missed'; fb?: string }
export type DeckRun = {
  deck: string; c: string; attempt: number; status: 'open' | 'grading' | 'submitted' | 'graded'
  started?: string; submittedAt?: string; submitted?: string
  answers?: Record<string, { pick?: number; text?: string }>
  perm?: Record<string, number[]>; results?: Record<string, DeckResult>
  pts?: number; max?: number; masteryDone?: boolean
}
export type DeckMeta = { c: string; title: string; topics: { id: string; lec: string; name: string }[] }

/* New in Berry Study */
export type XpEntry = { id: string; ts: string; date: string; amount: number; reason: string; ref?: string; c?: string }
export type PlantKind = 'flower' | 'strawberry' | 'matcha'
export type Session = {
  id: string; c: string; date: string; minutes: number; source: 'timer' | 'flora' | 'course-desk'
  status: 'grown' | 'wilted'; plant: PlantKind; ts: string
}
export type Timer = { c: string; start: number; planned: number } | null
export type Settings = { theme: 'auto' | 'light' | 'dark'; catName: string; onboarded: boolean; planOpen: boolean; ch5only: boolean }

export type Collections = {
  items: Record<string, Omit<Item, 'id'>>
  grades: Record<string, Omit<Grade, 'id'>>
  practice: Record<string, Practice>
  mastery: Record<string, Mastery>
  study: Record<string, StudyDay>
  decks: Record<string, Deck>
  deckruns: Record<string, DeckRun>
  deckmeta: Record<string, DeckMeta>
}
export type AppState = Collections & {
  schema: number
  xp: Record<string, XpEntry>
  sessions: Record<string, Session>
  written: Record<string, string>
  settings: Settings
  timer: Timer
  meta: { createdAt: string; seededFrom: string }
}
export const COLLECTION_KEYS = ['items', 'grades', 'practice', 'mastery', 'study', 'decks', 'deckruns', 'deckmeta'] as const
export const APP_KEYS = ['xp', 'sessions', 'written'] as const
