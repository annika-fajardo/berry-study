import seed from '../data/seed.json'
import { migrate } from './migrate'
import type { AppState } from './types'
/** The user's Course Desk export, imported as schema v1 and migrated forward. Used on first launch and for "Reset to seed". */
export function seedState(): AppState { return migrate(structuredClone(seed as Record<string, unknown>)) }
