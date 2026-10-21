import { describe, it, expect } from 'vitest'
import { parseIcs, toIcs } from '../lib/ics'
import { d2lUpdates, courseOf, kindOf, cleanTitle } from '../lib/d2l'
import type { AppState, Item } from '../store/types'

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:one@test
SUMMARY:Banquet shift
DTSTART:20261103T160000Z
DTEND:20261103T230000Z
END:VEVENT
BEGIN:VEVENT
UID:two@test
SUMMARY:FNCE 445 Lecture
DTSTART;TZID=America/Edmonton:20261103T093000
DTEND;TZID=America/Edmonton:20261103T104500
RRULE:FREQ=WEEKLY;BYDAY=TU,TH;COUNT=4
END:VEVENT
BEGIN:VEVENT
UID:three@test
SUMMARY:Reading week
DTSTART;VALUE=DATE:20261109
DTEND;VALUE=DATE:20261116
TRANSP:TRANSPARENT
END:VEVENT
BEGIN:VEVENT
UID:four@test
SUMMARY:Cancelled thing
STATUS:CANCELLED
DTSTART:20261104T120000Z
DTEND:20261104T130000Z
END:VEVENT
END:VCALENDAR`

describe('ics reading', () => {
  const evs = parseIcs(ICS, { cal: 'c1', from: new Date(2026, 9, 1), to: new Date(2026, 11, 31) })
  it('reads plain UTC events', () => { const e = evs.find(x => x.title === 'Banquet shift')!; expect(e.busy).toBe(true); expect(e.allDay).toBe(false) })
  it('expands a weekly repeat with a count', () => expect(evs.filter(x => x.title === 'FNCE 445 Lecture').length).toBe(4))
  it('reads an all-day event and its inclusive end', () => { const e = evs.find(x => x.title === 'Reading week')!; expect(e.allDay).toBe(true); expect(e.start).toBe('2026-11-09'); expect(e.end).toBe('2026-11-15'); expect(e.busy).toBe(false) })
  it('drops cancelled events', () => expect(evs.some(x => x.title === 'Cancelled thing')).toBe(false))
})

describe('ics writing', () => {
  const out = toIcs([{ uid: 'x1', title: 'Study: FNCE 445', start: '2026-11-03T16:00', end: '2026-11-03T16:50', desc: 'before Quiz 2' }])
  it('writes one event with CRLF lines', () => { expect(out).toContain('BEGIN:VEVENT'); expect(out).toContain('SUMMARY:Study: FNCE 445'); expect(out.split('\r\n').length).toBeGreaterThan(8) })
  it('round-trips through the reader', () => {
    const back = parseIcs(out, { cal: 'x', from: new Date(2026, 9, 1), to: new Date(2026, 11, 31) })
    expect(back.length).toBe(1); expect(back[0].start).toBe('2026-11-03T16:00'); expect(back[0].end).toBe('2026-11-03T16:50')
  })
})

const D2L = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:d1
SUMMARY:FNCE 445 - Assignment 3 is due
DTSTART;VALUE=DATE:20261116
DTEND;VALUE=DATE:20261117
END:VEVENT
BEGIN:VEVENT
UID:d2
SUMMARY:FNCE 477 - Quiz 6 - Availability Ends
DTSTART;VALUE=DATE:20261124
DTEND;VALUE=DATE:20261125
END:VEVENT
END:VCALENDAR`

describe('D2L matching', () => {
  const evs = parseIcs(D2L, { cal: 'd2l', from: new Date(2026, 9, 1), to: new Date(2026, 11, 31) })
  const s = { cal: { calendars: [] }, ics: { d2l: { d2l: true } }, d2lIgnore: {} } as unknown as AppState
  it('picks the course out of the title', () => expect(courseOf('FNCE 445 - Assignment 3 is due')).toBe('FNCE 445'))
  it('infers the type', () => { expect(kindOf('Quiz 6 - Availability Ends')).toBe('test'); expect(kindOf('Assignment 3 is due')).toBe('due') })
  it('cleans D2L noise out of the title', () => expect(cleanTitle('FNCE 445 - Assignment 3 is due')).toBe('Assignment 3'))
  it('lists an item she does not have yet', () => {
    const ups = d2lUpdates(evs.map(e => ({ ...e, source: 'ics' as const, cal: 'd2l' })), s, [])
    expect(ups.length).toBe(2); expect(ups[0].kind).toBe('new')
  })
  it('spots a date that moved', () => {
    const items: Item[] = [{ id: 'a3', c: 'FNCE 445', k: 'due', t: 'Assignment 3', d: '2026-11-13' }]
    const ups = d2lUpdates(evs.map(e => ({ ...e, source: 'ics' as const, cal: 'd2l' })), s, items)
    const moved = ups.find(u => u.kind === 'moved')!
    expect(moved).toBeTruthy(); expect(moved.it.d).toBe('2026-11-16')
  })
  it('stays quiet when the dates already match', () => {
    const items: Item[] = [{ id: 'a3', c: 'FNCE 445', k: 'due', t: 'Assignment 3', d: '2026-11-16' }]
    const ups = d2lUpdates(evs.map(e => ({ ...e, source: 'ics' as const, cal: 'd2l' })), s, items)
    expect(ups.some(u => u.it.c === 'FNCE 445')).toBe(false)
  })
  it('respects an ignore', () => {
    const s2 = { ...s, d2lIgnore: { [d2lUpdates(evs.map(e => ({ ...e, source: 'ics' as const, cal: 'd2l' })), s, [])[0].it.key]: true } } as AppState
    expect(d2lUpdates(evs.map(e => ({ ...e, source: 'ics' as const, cal: 'd2l' })), s2, []).length).toBe(1)
  })
})
