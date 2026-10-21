/* Data model. Collections and field names from the old Course Desk are kept exactly
   (items, grades, practice, mastery, study, decks, deckruns, deckmeta) so ids keep matching. */
export type Kind = 'test' | 'due' | 'class'
export type Item = { id: string; c: string; d?: string | null; k: Kind; t: string; w?: string | null; n?: string | null; done?: boolean; effort?: number | null }
export type Grade = { id: string; c: string; name: string; wt: number; score?: number | null; d?: string; o?: number; cat?: string }
export type Rounding = 'exact' | 'whole' | 'half'
/** "Assignments 20%, best 8 of 10 quizzes" — rows inside a category share its weight. */
export type GradeCategory = { id: string; name: string; weight: number; drop?: number }
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
export type CatAnim = 'auto' | 'full' | 'calm' | 'off'
export type Settings = { theme: 'auto' | 'light' | 'dark'; catName: string; onboarded: boolean; planOpen: boolean; ch5only: boolean; catAnim: CatAnim; companion: string
  /** Right Now candidates she pushed past, newest last, cleared each day. */
  notThis?: string[]
  /** The day those skips belong to; a new day starts clean. */
  notThisDay?: string
  /** The day of her last visit, for the "since you were last here" line. */
  lastSeen?: string
  capture?: { lastCourse?: string }
}

/* Calendar (v3). Times are local wall-clock strings 'YYYY-MM-DDTHH:mm'; all-day events use 'YYYY-MM-DD'. */
export type CalEvent = { title: string; start: string; end: string; c?: string; kind: 'study' | 'custom'; itemId?: string; note?: string; gcalId?: string; gcalCal?: string; created?: string }
export type ExtEvent = { id: string; title: string; start: string; end: string; allDay: boolean; busy: boolean; source: 'google' | 'ics'; cal: string; color?: string; berry?: boolean; desc?: string }
export type IcsSource = { name: string; importedAt: string; events: ExtEvent[]; work?: boolean; d2l?: boolean }
export type Skip = { itemId: string; start: string }
/** window[weekday] = [startMin, endMin], weekday 0 = Sunday */
export type StudyPrefs = {
  window: [number, number][]; maxHours: number; blockMin: number; breakMin: number; gapMin: number; noStudy: number[]
  /* shift protection */
  shiftRestMin: number; longShiftH: number; heavyDayH: number; lightMin: number
}
/** A weekly class meeting. selfStudy = she studies on her own instead of attending. */
export type ClassMeet = { c: string; weekday: number; start: number; end: number; selfStudy: boolean }
export type GCal = { id: string; summary: string; color?: string; selected: boolean; primary?: boolean; writable?: boolean; work?: boolean; d2l?: boolean }
export type CalSettings = { clientId: string; connected: boolean; email?: string; calendars: GCal[]; writeCal: string; addToGoogle: boolean; lastSync?: string }

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
  events: Record<string, CalEvent>
  skips: Record<string, Skip>
  ics: Record<string, IcsSource>
  gcache: { events: ExtEvent[]; fetchedAt?: string }
  cal: CalSettings
  prefs: StudyPrefs
  classes: Record<string, ClassMeet>
  /** event ids the user marked as work (true) or explicitly not work (false) */
  workMarks: Record<string, boolean>
  /** what-if marks per grade row; never written into grades */
  whatIf: Record<string, number>
  /** Per-course rounding policy, set on the Grades card. */
  rounding: Record<string, Rounding>
  /** D2L updates the user chose to ignore, by key */
  d2lIgnore: Record<string, boolean>
}
export const COLLECTION_KEYS = ['items', 'grades', 'practice', 'mastery', 'study', 'decks', 'deckruns', 'deckmeta'] as const
export const APP_KEYS = ['xp', 'sessions', 'written', 'events', 'skips', 'ics', 'classes', 'workMarks', 'whatIf', 'd2lIgnore', 'rounding'] as const
