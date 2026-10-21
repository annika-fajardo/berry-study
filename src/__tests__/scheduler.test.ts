import { describe, it, expect } from 'vitest'
import { schedule, effortHours, type SchedInput } from '../lib/scheduler'
import { DEFAULT_PREFS } from '../store/migrate'
import type { Item } from '../store/types'

/* Fixture week: "now" is Monday 3 Nov 2026, 08:00 local. */
const NOW = new Date(2026, 10, 2, 8, 0)
const day = (n: number) => { const d = new Date(NOW); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
const item = (x: Partial<Item> & { id: string }): Item => ({ c: 'FNCE 445', k: 'due', t: 'Thing', d: day(5), ...x })
const base = (over: Partial<SchedInput> = {}): SchedInput => ({ now: NOW, items: [], prefs: { ...DEFAULT_PREFS, window: DEFAULT_PREFS.window.map(w => [...w] as [number, number]) }, busy: [], accepted: [], skips: [], ...over })
const mins = (s: { start: string; end: string }) => (new Date(s.end).getTime() - new Date(s.start).getTime()) / 60000

describe('effort estimate', () => {
  it('scales a test with its weight', () => expect(effortHours({ k: 'test', w: '25%' })).toBeCloseTo(6.5))
  it('scales a deadline with its weight', () => expect(effortHours({ k: 'due', w: '20%' })).toBeCloseTo(4))
  it('gives class prep three quarters of an hour', () => expect(effortHours({ k: 'class', w: null })).toBe(0.75))
  it('caps small quizzes at two hours', () => expect(effortHours({ k: 'test', w: '5%' })).toBe(2))
  it('uses a per-item override', () => expect(effortHours({ k: 'test', w: '25%', effort: 1 })).toBe(1))
})

describe('placement', () => {
  it('books blocks before the deadline and spreads them over days', () => {
    const r = schedule(base({ items: [item({ id: 'a', k: 'test', w: '25%', d: day(7) })] }))
    expect(r.suggestions.length).toBeGreaterThan(3)
    for (const s of r.suggestions) expect(s.start.slice(0, 10) < day(7)).toBe(true)
    const perDay: Record<string, number> = {}
    for (const s of r.suggestions) perDay[s.start.slice(0, 10)] = (perDay[s.start.slice(0, 10)] || 0) + 1
    expect(Math.max(...Object.values(perDay))).toBeLessThanOrEqual(2)
  })
  it('leaves the last block before a test as review', () => {
    const r = schedule(base({ items: [item({ id: 'a', k: 'test', w: '25%', d: day(7) })] }))
    const last = r.suggestions.filter(s => s.itemId === 'a').sort((x, y) => x.start.localeCompare(y.start)).pop()!
    expect(last.kind).toBe('review')
    expect(last.start.slice(0, 10)).toBe(day(6))
  })
  it('never books over a busy event', () => {
    const busy = [{ start: day(1) + 'T09:00', end: day(1) + 'T21:00' }]
    const r = schedule(base({ items: [item({ id: 'a', k: 'test', w: '25%', d: day(3) })], busy }))
    expect(r.suggestions.some(s => s.start.slice(0, 10) === day(1))).toBe(false)
  })
  it('puts the weakest topic in the description', () => {
    const r = schedule(base({ items: [item({ id: 'a', k: 'test', w: '25%', d: day(7) })], weakByItem: { a: ['Put-call parity'] } }))
    expect(r.suggestions.find(s => s.kind === 'study')!.title).toContain('Put-call parity')
  })
  it('respects a day marked as no-study', () => {
    const prefs = { ...DEFAULT_PREFS, noStudy: [new Date(day(1) + 'T12:00').getDay()] }
    const r = schedule(base({ items: [item({ id: 'a', k: 'test', w: '25%', d: day(5) })], prefs }))
    expect(r.suggestions.some(s => s.start.slice(0, 10) === day(1))).toBe(false)
  })
  it('keeps within the daily cap', () => {
    const r = schedule(base({ items: [item({ id: 'a', k: 'test', w: '35%', d: day(3) }), item({ id: 'b', k: 'due', w: '20%', d: day(3) })] }))
    const perDay: Record<string, number> = {}
    for (const s of r.suggestions) perDay[s.start.slice(0, 10)] = (perDay[s.start.slice(0, 10)] || 0) + mins(s)
    for (const m of Object.values(perDay)) expect(m).toBeLessThanOrEqual(DEFAULT_PREFS.maxHours * 60)
  })
  it('skips a slot the user skipped', () => {
    const first = schedule(base({ items: [item({ id: 'a', k: 'test', w: '25%', d: day(7) })] })).suggestions[0]
    const r = schedule(base({ items: [item({ id: 'a', k: 'test', w: '25%', d: day(7) })], skips: [{ itemId: 'a', start: first.start }] }))
    expect(r.suggestions.some(s => s.start === first.start && s.itemId === 'a')).toBe(false)
  })
})

describe('work shifts', () => {
  const shift = (d: number, from: string, to: string) => ({ start: day(d) + 'T' + from, end: day(d) + 'T' + to, work: true, title: 'Banquet shift' })
  it('counts shift time as busy and rests afterwards', () => {
    const r = schedule(base({ items: [item({ id: 'a', k: 'test', w: '25%', d: day(5) })], busy: [shift(1, '12:00', '17:00')] }))
    const onDay = r.suggestions.filter(s => s.start.slice(0, 10) === day(1))
    for (const s of onDay) expect(new Date(s.start).getHours() >= 18 || new Date(s.end).getHours() <= 12).toBe(true)
  })
  it('allows only one short light block after a long shift', () => {
    const r = schedule(base({ items: [item({ id: 'a', k: 'test', w: '35%', d: day(5) })], busy: [shift(1, '10:00', '16:00')] }))
    const after = r.suggestions.filter(s => s.start.slice(0, 10) === day(1) && new Date(s.start).getHours() >= 17)
    expect(after.length).toBeLessThanOrEqual(1)
    for (const s of after) { expect(s.kind).toBe('light'); expect(mins(s)).toBeLessThanOrEqual(DEFAULT_PREFS.lightMin) }
  })
  it('keeps a double-shift day to light review within the cap', () => {
    const r = schedule(base({ items: [item({ id: 'a', k: 'test', w: '35%', d: day(5) })], busy: [shift(1, '07:00', '12:00'), shift(1, '16:00', '20:00')] }))
    const onDay = r.suggestions.filter(s => s.start.slice(0, 10) === day(1))
    const total = onDay.reduce((a, s) => a + mins(s), 0)
    expect(total).toBeLessThanOrEqual(DEFAULT_PREFS.lightMin)
    for (const s of onDay) expect(s.kind).toBe('light')
    expect(r.days[day(1)].heavy).toBe(true)
  })
})

describe('classes', () => {
  const wd = (n: number) => new Date(day(n) + 'T12:00').getDay()
  it('offers a self-study block at the class time and frees that hour', () => {
    const classes = { c1: { c: 'FNCE 445', weekday: wd(1), start: 9 * 60 + 30, end: 10 * 60 + 45, selfStudy: true } }
    const r = schedule(base({ items: [item({ id: 'p', k: 'class', t: 'Ch 5 pricing forwards', n: 'Read Ch 5', d: day(1) })], classes }))
    const self = r.suggestions.find(s => s.kind === 'selfstudy')!
    expect(self).toBeTruthy()
    expect(self.start).toBe(day(1) + 'T09:30')
    expect(self.title).toContain('FNCE 445 self-study')
    expect(self.title).toContain('Read Ch 5')
  })
  it('treats an attended class as busy and offers a pre-read', () => {
    const classes = { c1: { c: 'FNCE 477', weekday: wd(1), start: 14 * 60, end: 15 * 60 + 15, selfStudy: false } }
    const r = schedule(base({ items: [item({ id: 'p', c: 'FNCE 477', k: 'class', t: 'Lecture 14', d: day(1) })], classes }))
    const pre = r.suggestions.find(s => s.kind === 'preread')
    expect(pre).toBeTruthy()
    expect(new Date(pre!.end).getTime()).toBeLessThanOrEqual(new Date(day(1) + 'T14:00').getTime())
    expect(r.suggestions.some(s => s.start > day(1) + 'T14:00' && s.start < day(1) + 'T15:15')).toBe(false)
  })
})
