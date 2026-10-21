/* Ported from course-desk.html: COURSES (names, letter cutoffs), LET/PTS GPA scale, KIND.
   Colours now come from the matcha-strawberry palette via CSS variables. */
export type CourseInfo = { name: string; color: string; soft: string; cut: number[]; mascot: 'coin' | 'chart' | 'gavel' | 'compass' }
export const COURSES: Record<string, CourseInfo> = {
  'FNCE 477': { name: 'Personal Financial Mgmt', color: 'var(--c477)', soft: 'var(--c477-soft)', cut: [95, 90, 85, 80, 75, 70, 66, 62, 59.44, 56.44, 50.45], mascot: 'coin' },
  'FNCE 445': { name: 'Futures & Options', color: 'var(--c445)', soft: 'var(--c445-soft)', cut: [95, 90, 85, 80, 75, 70, 65, 60, 55, 52, 50], mascot: 'chart' },
  'MGST 451': { name: 'Corporate Governance', color: 'var(--c451)', soft: 'var(--c451-soft)', cut: [95, 90, 85, 80, 75, 70, 66, 62, 58, 56, 50], mascot: 'gavel' },
  'SGMA 591': { name: 'Strategic Management', color: 'var(--c591)', soft: 'var(--c591-soft)', cut: [98, 94, 90, 86, 82, 78, 74, 70, 66, 62, 58], mascot: 'compass' },
}
export const COURSE_KEYS = Object.keys(COURSES)
export const LET = ['A+', 'A', 'A−', 'B+', 'B', 'B−', 'C+', 'C', 'C−', 'D+', 'D']
export const PTS = [4, 4, 3.7, 3.3, 3, 2.7, 2.3, 2, 1.7, 1.3, 1]
export const KIND: Record<string, [string, string]> = { test: ['Test', 'k-test'], due: ['Due', 'k-due'], class: ['Prep', 'k-class'] }
export const courseColor = (c: string) => (COURSES[c] ? COURSES[c].color : 'var(--muted)')
export const courseSoft = (c: string) => (COURSES[c] ? COURSES[c].soft : 'var(--surface-2)')
