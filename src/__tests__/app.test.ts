import { describe, it, expect } from 'vitest'
import { seedState } from '../store/seed'
import { readiness, decayed, topicsFor } from '../lib/readiness'
import { courseStats, projectedGpa, letterFor } from '../lib/grades'
import { isWork } from '../lib/work'
import { itemXp, levelInfo, threshold, streak, xpTotal } from '../lib/game'
import { parseBackup, makeBackup, mergeStates } from '../lib/backup'
import type { AppState, ExtEvent, Grade } from '../store/types'

const S = seedState()
const TODAY = '2026-10-21'

describe('seed and migration', () => {
  it('loads the Course Desk export', () => {
    expect(Object.keys(S.items).length).toBe(64)
    expect(Object.keys(S.grades).length).toBe(36)
    expect(Object.keys(S.practice).length).toBe(28)
    expect(S.schema).toBe(3)
  })
  it('keeps the old document ids', () => { expect(S.items.a01).toBeTruthy(); expect(S.grades['g445-01']).toBeTruthy(); expect(S.deckruns['fnce477-d1--1']).toBeTruthy() })
  it('turns history into xp', () => expect(xpTotal(S)).toBeGreaterThan(1000))
  it('defaults to light with the cat called Emi', () => { expect(S.settings.theme).toBe('light'); expect(S.settings.catName).toBe('Emi'); expect(S.settings.companion).toBe('emi') })
})

describe('xp and levels', () => {
  it('scales a tick with type and weight', () => { expect(itemXp({ k: 'class', w: null })).toBe(5); expect(itemXp({ k: 'test', w: '25%' })).toBe(50); expect(itemXp({ k: 'due', w: '5%' })).toBe(20) })
  it('caps the weight bonus', () => expect(itemXp({ k: 'test', w: '90%' })).toBe(55))
  it('rises through the level curve', () => { expect(threshold(1)).toBe(0); expect(levelInfo(0).level).toBe(1); expect(levelInfo(threshold(5)).level).toBe(5) })
  it('counts a streak back from today', () => expect(streak(S, TODAY).count).toBeGreaterThanOrEqual(1))
})

describe('grades', () => {
  const g = Object.entries(S.grades).map(([id, x]) => ({ id, ...x })) as Grade[]
  it('projects each course from what is graded', () => { const s = courseStats(g, 'FNCE 477'); expect(s.gw).toBeCloseTo(30); expect(Math.round(s.pct!)).toBe(90) })
  it('uses that course cutoffs', () => { expect(letterFor('FNCE 445', 73)).toBe(5); expect(letterFor('SGMA 591', 73)).toBe(7) })
  it('gives a term GPA', () => { const { gpa, n } = projectedGpa(g); expect(n).toBe(3); expect(gpa).toBeGreaterThan(3) })
  it('what-if never touches real marks', () => {
    const withWhatIf = g.map(x => (x.id === 'g445-05' ? { ...x, score: 90 } : x))
    expect(courseStats(withWhatIf, 'FNCE 445').pct).not.toBe(courseStats(g, 'FNCE 445').pct)
    expect(S.grades['g445-05'].score).toBeNull()
  })
})

describe('readiness', () => {
  const test445 = Object.entries(S.items).map(([id, i]) => ({ id, ...i })).find(i => i.c === 'FNCE 445' && i.k === 'test' && i.t === 'Midterm exam')!
  it('scores between 0 and 100', () => { const r = readiness(S, test445, TODAY); expect(r.pct).toBeGreaterThanOrEqual(0); expect(r.pct).toBeLessThanOrEqual(100) })
  it('lists the weakest topics first', () => { const r = readiness(S, test445, TODAY); expect(r.weak.length).toBe(3); expect(r.weak[0].acc).toBeLessThanOrEqual(r.weak[2].acc) })
  it('counts never-practised topics as zero', () => { const r = readiness(S, test445, TODAY); expect(r.topics.some(t => t.seen === 0 && t.acc === 0)).toBe(true) })
  it('decays accuracy older than two weeks', () => { expect(decayed(1, '2026-10-20', TODAY)).toBe(1); expect(decayed(1, '2026-09-01', TODAY)).toBeLessThan(0.5) })
  it('maps FNCE 445 topics to its question types', () => expect(topicsFor(S, 'FNCE 445').some(t => t.id.startsWith('fnce-445--qt-'))).toBe(true))
})

describe('work detection', () => {
  const ev = (title: string, cal = 'x'): ExtEvent => ({ id: 'e' + title, title, start: '2026-10-24T16:00', end: '2026-10-24T23:00', allDay: false, busy: true, source: 'google', cal })
  const s = { workMarks: {}, cal: { calendars: [{ id: 'w', summary: 'Work', selected: true, work: true }] }, ics: {} } as unknown as AppState
  it('spots a shift by its title', () => { expect(isWork(ev('Banquet shift'), s)).toBe(true); expect(isWork(ev('Hotel Arts'), s)).toBe(true); expect(isWork(ev('Coffee with Mom'), s)).toBe(false) })
  it('treats a Work calendar as work', () => expect(isWork(ev('Anything', 'w'), s)).toBe(true))
  it('lets a manual mark win', () => { const e = ev('Banquet shift'); expect(isWork(e, { ...s, workMarks: { [e.id]: false } } as unknown as AppState)).toBe(false) })
})

describe('backups', () => {
  it('round-trips losslessly', () => {
    const b = makeBackup(S)
    const back = parseBackup(JSON.stringify(b))
    expect(JSON.stringify(back)).toBe(JSON.stringify(S))
  })
  it('rejects a file that is not a backup', () => expect(() => parseBackup('{"hello":1}')).toThrow())
  it('merges without duplicating xp for the same action', () => {
    const merged = mergeStates(S, JSON.parse(JSON.stringify(S)))
    expect(Object.keys(merged.xp).length).toBe(Object.keys(S.xp).length)
  })
})
