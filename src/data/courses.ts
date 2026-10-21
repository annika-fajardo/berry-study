/* Ported from course-desk.html: COURSES (names, letter cutoffs), LET/PTS GPA scale, KIND.
   Colours now come from the matcha-strawberry palette via CSS variables. */
export type CourseInfo = {
  name: string; color: string; soft: string; cut: number[]
  /** Credit units, so the GPA is weighted properly the moment a course isn't 3 units. */
  units: number
  /** How this prof rounds before applying the cutoffs. */
  rounding?: Rounding
  /** Weighted categories, for schemes like "assignments 5% each, best 8 of 10 quizzes". */
  categories?: GradeCategory[]
}
/* Course colour slots are numbered, not named after course codes, so next term's courses can take them over. */
export const COURSES: Record<string, CourseInfo> = {
  'FNCE 477': { name: 'Personal Financial Mgmt', color: 'var(--c1)', soft: 'var(--c1-soft)', cut: [95, 90, 85, 80, 75, 70, 66, 62, 59.44, 56.44, 50.45], units: 3 },
  'FNCE 445': {
    name: 'Futures & Options', color: 'var(--c2)', soft: 'var(--c2-soft)', cut: [95, 90, 85, 80, 75, 70, 65, 60, 55, 52, 50], units: 3,
    categories: [
      { id: 'assign', name: 'Assignments', weight: 20 },
      { id: 'quiz', name: 'Quizzes', weight: 15 },
      { id: 'mid', name: 'Midterm', weight: 25 },
      { id: 'part', name: 'Participation', weight: 5 },
      { id: 'final', name: 'Final exam', weight: 35 },
    ],
  },
  'MGST 451': { name: 'Corporate Governance', color: 'var(--c3)', soft: 'var(--c3-soft)', cut: [95, 90, 85, 80, 75, 70, 66, 62, 58, 56, 50], units: 3 },
  'SGMA 591': { name: 'Strategic Management', color: 'var(--c4)', soft: 'var(--c4-soft)', cut: [98, 94, 90, 86, 82, 78, 74, 70, 66, 62, 58], units: 3 },
}
import type { GradeCategory, Rounding } from '../store/types'

export const COURSE_KEYS = Object.keys(COURSES)
export const LET = ['A+', 'A', 'A−', 'B+', 'B', 'B−', 'C+', 'C', 'C−', 'D+', 'D']
export const PTS = [4, 4, 3.7, 3.3, 3, 2.7, 2.3, 2, 1.7, 1.3, 1]
export const KIND: Record<string, [string, string]> = { test: ['Test', 'k-test'], due: ['Due', 'k-due'], class: ['Prep', 'k-class'] }
export const courseColor = (c: string) => (COURSES[c] ? COURSES[c].color : 'var(--muted)')
export const courseSoft = (c: string) => (COURSES[c] ? COURSES[c].soft : 'var(--surface-2)')
