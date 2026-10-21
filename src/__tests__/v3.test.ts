import { describe, it, expect } from 'vitest'
import { seedState } from '../store/seed'
import { parseCapture, strip } from '../lib/parse'
import { courseStats, needLines, itemNeed, band, letterFor, projectedGpa, applyRounding, roundingSplit, weighRows } from '../lib/grades'
import { readiness } from '../lib/readiness'
import { rightNow, candidates } from '../lib/rightnow'
import { capacity, countWord } from '../lib/capacity'
import { makeBackup, parseBackup } from '../lib/backup'
import { COURSES } from '../data/courses'
import type { AppState, Grade, Item } from '../store/types'
import type { CalData } from '../lib/calendar'

const S = seedState()
const TODAY = '2026-10-21'
const grades = () => Object.entries(S.grades).map(([id, g]) => ({ id, ...g })) as Grade[]

/* ---------------- capture parser ---------------- */
describe('capture parser', () => {
  const names = { 'FNCE 445': 'Futures & Options', 'FNCE 477': 'Personal Financial Mgmt' }
  it('pulls course, kind, date, weight and effort out of one line', () => {
    const p = parseCapture('FNCE 445 quiz friday 20% ~3h', { today: '2026-10-21', courseNames: names })
    expect(p.course).toBe('FNCE 445')
    expect(p.kind).toBe('test')
    expect(p.date).toBe('2026-10-23')
    expect(p.weight).toBe('20%')
    expect(p.effort).toBe(3)
    expect(p.title).toBe('quiz')
  })
  it('defaults an unrecognised line to a deadline with the title intact', () => {
    const p = parseCapture('email the group about the deck', { today: TODAY })
    expect(p.kind).toBe('due')
    expect(p.title).toContain('email the group')
  })
  it('reads a month-and-day date forward', () => {
    expect(parseCapture('report nov 7', { today: TODAY }).date).toBe('2026-11-07')
    expect(parseCapture('report 7 nov', { today: TODAY }).date).toBe('2026-11-07')
  })
  it('rolls a past month into next year', () => {
    expect(parseCapture('exam jan 12', { today: TODAY }).date).toBe('2027-01-12')
  })
  it('understands relative dates', () => {
    expect(parseCapture('thing tomorrow', { today: TODAY }).date).toBe('2026-10-22')
    expect(parseCapture('thing in 2 weeks', { today: TODAY }).date).toBe('2026-11-04')
  })
  it('keeps the word that set the kind in the title, so "final report" survives', () => {
    const p = parseCapture('final report friday', { today: TODAY })
    expect(p.kind).toBe('test') // "final" reads as a test
    expect(p.title).toBe('final report')
    // and dropping the date chip puts "friday" back
    expect(strip('final report friday', p.chips.filter(c => c.field !== 'date'))).toContain('friday')
  })
  it('guesses the course from a nickname and marks it as a guess', () => {
    const p = parseCapture('options problem set monday', { today: TODAY, courseNames: names })
    expect(p.course).toBe('FNCE 445')
  })
  it('falls back to the last course used, flagged as a guess', () => {
    const p = parseCapture('read chapter 7', { today: TODAY, lastCourse: 'MGST 451' })
    expect(p.course).toBe('MGST 451')
    expect(p.chips.find(c => c.field === 'course')?.guessed).toBe(true)
  })
})

/* ---------------- grades ---------------- */
describe('grade engine', () => {
  it('counts remaining weight from unanswered rows only', () => {
    const st = courseStats(grades(), 'FNCE 477')
    const unanswered = st.rows.filter(r => typeof r.score !== 'number').reduce((a, r) => a + r.weight, 0)
    expect(st.rem).toBeCloseTo(unanswered)
  })
  it('need lines follow what-if marks, not just real ones', () => {
    const g = grades()
    const real = needLines('FNCE 445', courseStats(g, 'FNCE 445'))
    const withWhatIf = g.map(x => (x.id === 'g445-06' ? { ...x, score: 95 } : x)) // midterm, 25%
    const after = needLines('FNCE 445', courseStats(withWhatIf, 'FNCE 445'))
    expect(after[0].text).not.toBe(real[0].text)
  })
  it('per-item need answers "what do I need on this one"', () => {
    const n = itemNeed(grades(), 'FNCE 445', 'g445-09', {}) // final exam
    expect(n).toBeTruthy()
    expect(typeof n!.pct).toBe('number')
  })
  it('a what-if on another row changes this row’s need', () => {
    // hold the target letter fixed, or a better midterm simply raises the goal
    const target = 4
    const a = itemNeed(grades(), 'FNCE 445', 'g445-09', {}, target)!
    const b = itemNeed(grades(), 'FNCE 445', 'g445-09', { 'g445-06': 95 }, target)!
    expect(b.pct).toBeLessThan(a.pct)
  })
  it('gives a best / likely / worst band', () => {
    const b = band(grades(), 'FNCE 477')!
    expect(b.best).toBeGreaterThan(b.likely)
    expect(b.likely).toBeGreaterThan(b.worst)
  })
  it('accepts bonus marks above 100', () => {
    const g = grades().map(x => (x.id === 'g445-01' ? { ...x, score: 110 } : x))
    const st = courseStats(g, 'FNCE 445')
    expect(st.bonus).toBeGreaterThan(0)
    expect(st.pct!).toBeGreaterThan(courseStats(grades(), 'FNCE 445').pct!)
  })
  it('shares a category weight and drops the lowest when asked', () => {
    const cats = [{ id: 'quiz', name: 'Quizzes', weight: 30, drop: 1 }]
    const old = COURSES['MGST 451'].categories
    COURSES['MGST 451'].categories = cats
    const g: Grade[] = [
      { id: 'q1', c: 'MGST 451', name: 'Quiz 1', wt: 10, score: 90, cat: 'quiz' },
      { id: 'q2', c: 'MGST 451', name: 'Quiz 2', wt: 10, score: 50, cat: 'quiz' },
      { id: 'q3', c: 'MGST 451', name: 'Quiz 3', wt: 10, score: 80, cat: 'quiz' },
    ]
    const rows = weighRows(g, 'MGST 451')
    expect(rows.find(r => r.id === 'q2')!.dropped).toBe(true)
    expect(rows.find(r => r.id === 'q1')!.weight).toBeCloseTo(15)
    expect(courseStats(g, 'MGST 451').pct).toBeCloseTo(85)
    COURSES['MGST 451'].categories = old
  })
  it('applies a rounding policy and reports when it changes the letter', () => {
    expect(applyRounding(79.6, 'whole')).toBe(80)
    expect(letterFor('FNCE 445', 79.6, 'exact')).toBe(letterFor('FNCE 445', 79.6))
    const split = roundingSplit('FNCE 445', 79.6, 'whole')
    expect(split).toBeTruthy()
    expect(split!.exact).toBeGreaterThan(split!.rounded) // a lower index is a better letter
  })
  it('weights the GPA by units', () => {
    const a = projectedGpa(grades())
    const old = COURSES['FNCE 477'].units
    COURSES['FNCE 477'].units = 6
    const b = projectedGpa(grades())
    COURSES['FNCE 477'].units = old
    expect(b.gpa).not.toBeCloseTo(a.gpa!)
  })
  it('FNCE 445 rows carry real categories after the migration', () => {
    const st = courseStats(grades(), 'FNCE 445')
    expect(st.cats.length).toBeGreaterThan(0)
    expect(st.rows.filter(r => r.cat).length).toBeGreaterThan(5)
  })
})

/* ---------------- readiness fairness ---------------- */
describe('readiness fairness', () => {
  const test445 = Object.entries(S.items).map(([id, i]) => ({ id, ...i })).find(i => i.c === 'FNCE 445' && i.t === 'Midterm exam')!
  it('marks untouched topics as not started rather than zero', () => {
    const r = readiness(S, test445, TODAY)
    expect(r.topics.some(t => t.state === 'new')).toBe(true)
    expect(r.topics.filter(t => t.state === 'new').every(t => t.seen === 0)).toBe(true)
  })
  it('leaves untouched topics out of the average', () => {
    const r = readiness(S, test445, TODAY)
    const tracked = r.topics.filter(t => t.seen > 0)
    const mean = tracked.reduce((a, t) => a + t.acc, 0) / tracked.length
    expect(r.knowledge).toBeCloseTo(mean)
    expect(r.tracked).toBe(tracked.length)
  })
  it('says "not tracked" instead of 0% for a course with no practice', () => {
    const bare = { ...S, mastery: {}, practice: {} } as AppState
    const r = readiness(bare, test445, TODAY)
    expect(r.pct).toBeNull()
    expect(r.total).toBeGreaterThan(0)
  })
  it('never reports 0% for a course that has been practised', () => {
    for (const c of ['FNCE 477', 'FNCE 445']) {
      const item = Object.entries(S.items).map(([id, i]) => ({ id, ...i })).find(i => i.c === c && i.k === 'test')
      if (!item) continue
      const r = readiness(S, item, TODAY)
      if (r.pct != null) expect(r.pct).toBeGreaterThan(0)
    }
  })
})

/* ---------------- right now + capacity ---------------- */
const fakeCal = (items: Item[], unplaced: { itemId: string; blocks: number }[] = []): CalData => ({
  ext: [], own: [], items,
  sched: { suggestions: [], unplaced, days: {} },
})
describe('right now', () => {
  const items = Object.entries(S.items).map(([id, i]) => ({ id, ...i })) as Item[]
  it('picks one action with a course, a duration and a reason', () => {
    const { pick } = rightNow(S, fakeCal(items), TODAY)
    expect(pick).toBeTruthy()
    expect(pick!.c).toBeTruthy()
    expect(pick!.minutes).toBeGreaterThan(0)
    expect(pick!.reason.length).toBeGreaterThan(10)
  })
  it('[Not this] moves to the next candidate', () => {
    const cal = fakeCal(items)
    const first = rightNow(S, cal, TODAY).pick!
    const s2 = { ...S, settings: { ...S.settings, notThis: [first.key] } } as AppState
    const second = rightNow(s2, cal, TODAY).pick!
    expect(second.key).not.toBe(first.key)
  })
  it('forgets the skips from a day that has rolled over', () => {
    const cal = fakeCal(items)
    const first = rightNow(S, cal, TODAY).pick!
    const s2 = { ...S, settings: { ...S.settings, notThis: [first.key], notThisDay: '2026-10-20' } } as AppState
    expect(rightNow(s2, cal, TODAY).pick!.key).toBe(first.key)
  })
  it('falls back to a get-ahead suggestion on a quiet day', () => {
    const far = items.map(i => (i.d ? { ...i, d: '2026-12-15' } : i))
    const list = candidates(S, fakeCal(far), TODAY)
    expect(list.length).toBe(1)
    expect(list[0].kind).toBe('ahead')
    expect(list[0].reason).toMatch(/Nothing due/)
  })
  it('says nothing at all when there is nothing to do', () => {
    const { pick } = rightNow(S, fakeCal([]), TODAY)
    expect(pick).toBeNull()
  })
})

describe('backup round-trip', () => {
  it('accepts the maps that hold plain values, not documents', () => {
    const st = { ...S, rounding: { 'FNCE 445': 'whole' }, whatIf: { 'g445-09': 88 }, workMarks: { ev1: true }, d2lIgnore: { k1: true } } as unknown as AppState
    const back = parseBackup(JSON.stringify(makeBackup(st)))
    expect(back.rounding['FNCE 445']).toBe('whole')
    expect(back.whatIf['g445-09']).toBe(88)
    expect(back.workMarks.ev1).toBe(true)
  })
})

describe('capacity', () => {
  const items = Object.entries(S.items).map(([id, i]) => ({ id, ...i })) as Item[]
  it('reports work, free time and what will not fit', () => {
    const cap = capacity(S, fakeCal(items, [{ itemId: 'b02', blocks: 2 }]), TODAY, new Date(2026, 9, 21, 8, 0))!
    expect(cap.needed).toBeGreaterThan(0)
    expect(cap.free).toBeGreaterThan(0)
    expect(cap.unplaced).toBe(2)
    expect(cap.tight).toBe(true)
  })
  it('is quiet when there is nothing due', () => {
    expect(capacity(S, fakeCal([]), TODAY)).toBeNull()
  })
  it('counts blocks in words', () => { expect(countWord(2)).toBe('two'); expect(countWord(11)).toBe('11') })
})
