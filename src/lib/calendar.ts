/* Calendar data: merges the app's own events, Google and .ics events, deadlines and suggestions,
   and runs the scheduler whenever its inputs change. */
import { useMemo, useSyncExternalStore } from 'react'
import type { AppState, CalEvent, ExtEvent, Item } from '../store/types'
import { useAppState, update, getState } from '../store/store'
import { itemsOf } from '../store/actions'
import { schedule, type Suggestion, type SchedResult } from './scheduler'
import { readiness } from './readiness'
import { isWork, WORK_RE } from './work'
import { isD2l, D2L_NAME_RE } from './d2l'
import { todayStr } from './dates'
import { uid } from './dates'
import { toast, catSays } from './events'
import * as G from './google'

/* ---------------- sync status (for the syncing cat) ---------------- */
let syncing = false, syncErr = ''
const subs = new Set<() => void>()
const tell = () => subs.forEach(f => f())
export function useSync() {
  return useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => (syncing ? 'syncing' : syncErr ? 'error:' + syncErr : 'idle'))
}

export function allExternal(s: AppState): ExtEvent[] {
  const ics = Object.values(s.ics).flatMap(x => x.events)
  const selected = new Set(s.cal.calendars.filter(c => c.selected).map(c => c.id))
  const g = s.cal.connected ? s.gcache.events.filter(e => selected.has(e.cal)) : []
  return [...g, ...ics]
}
export type CalData = {
  ext: (ExtEvent & { work: boolean; d2l: boolean })[]
  own: (CalEvent & { id: string })[]
  items: Item[]
  sched: SchedResult
}
export function computeCal(s: AppState, now: Date): CalData {
  const items = itemsOf(s)
  const ext = allExternal(s).map(e => ({ ...e, work: isWork(e, s), d2l: isD2l(e, s) }))
  const own = Object.entries(s.events).map(([id, e]) => ({ id, ...e }))
  const today = todayStr(now)
  const busy = ext.filter(e => !e.allDay && e.busy && !e.d2l && !e.berry).map(e => ({ start: e.start, end: e.end, title: e.title, work: e.work }))
  const weakByItem: Record<string, string[]> = {}
  for (const i of items) if (i.k === 'test' && !i.done && i.d && i.d >= today) weakByItem[i.id] = readiness(s, i, today, now.getTime()).weak.map(t => t.name)
  const weakByCourse: Record<string, string> = {}
  for (const m of Object.values(s.mastery)) {
    if (!m.seen) continue
    const cur = weakByCourse[m.c], acc = m.correct / m.seen
    const curM = cur ? Object.values(s.mastery).find(x => x.c === m.c && x.concept === cur) : null
    if (!cur || (curM && acc < curM.correct / curM.seen)) weakByCourse[m.c] = m.concept
  }
  const sched = schedule({ now, items, prefs: s.prefs, busy, accepted: own.map(e => ({ id: e.id, start: e.start, end: e.end, itemId: e.itemId, kind: e.kind })), skips: Object.values(s.skips), classes: s.classes, weakByItem, weakByCourse })
  return { ext, own, items, sched }
}
/** Recomputes when calendar inputs change (or every 5 minutes as time moves on). */
export function useCal(): CalData {
  const s = useAppState()
  const tick = Math.floor(Date.now() / 300000)
  return useMemo(() => computeCal(s, new Date()), [s.items, s.events, s.skips, s.ics, s.gcache, s.cal, s.prefs, s.classes, s.mastery, s.practice, s.workMarks, tick])
}

/* ---------------- actions ---------------- */
export async function acceptSuggestion(sg: Suggestion) {
  const id = uid('ev')
  const ev: CalEvent = { title: sg.title, start: sg.start, end: sg.end, c: sg.c, kind: 'study', itemId: sg.itemId, note: sg.note + (sg.topic ? ' · ' + sg.topic : ''), created: new Date().toISOString() }
  update(d => { d.events[id] = ev })
  toast('Added to your calendar: ' + sg.title)
  const s = getState()
  if (s.cal.connected && s.cal.addToGoogle) {
    try {
      const gid = await G.createStudyEvent(s.cal.clientId, s.cal.writeCal || 'primary', { id, title: sg.title, start: sg.start, end: sg.end, c: sg.c, note: ev.note })
      update(d => { if (d.events[id]) { d.events[id].gcalId = gid; d.events[id].gcalCal = s.cal.writeCal || 'primary' } })
    } catch (e) { toast("Saved here, but couldn't add it to Google: " + (e as Error).message) }
  }
}
export function skipSuggestion(sg: Suggestion) {
  update(d => { d.skips[uid('sk')] = { itemId: sg.itemId ?? (sg.classId ? 'self:' + sg.classId : sg.key), start: sg.start } })
}
export async function saveEvent(id: string | null, ev: CalEvent) {
  const key = id || uid('ev')
  const prev = id ? getState().events[id] : null
  update(d => { d.events[key] = { ...(prev || {}), ...ev } })
  const s = getState(), cur = s.events[key]
  if (cur?.gcalId && s.cal.connected) {
    try { await G.updateStudyEvent(s.cal.clientId, cur.gcalCal || 'primary', cur.gcalId, { id: key, title: cur.title, start: cur.start, end: cur.end, c: cur.c, note: cur.note }) }
    catch (e) { toast("Changed here, but couldn't update Google: " + (e as Error).message) }
  }
  return key
}
export async function deleteEvent(id: string) {
  const ev = getState().events[id]; if (!ev) return
  update(d => { delete d.events[id] })
  const s = getState()
  if (ev.gcalId && s.cal.connected) {
    try { await G.deleteStudyEvent(s.cal.clientId, ev.gcalCal || 'primary', ev.gcalId) } catch (e) { toast("Removed here, but couldn't remove it from Google: " + (e as Error).message) }
  }
  toast('Removed from your calendar.', { actionLabel: 'Undo', action: () => update(d => { d.events[id] = { ...ev, gcalId: undefined } }) })
}

/* ---------------- Google sync ---------------- */
export async function connectGoogle() {
  const s = getState()
  syncErr = ''; syncing = true; tell()
  try {
    await G.requestToken(s.cal.clientId, 'consent')
    const cals = await G.listCalendars(s.cal.clientId)
    update(d => {
      const prev = new Map(d.cal.calendars.map(c => [c.id, c]))
      d.cal.calendars = cals.map(c => ({ ...c, selected: prev.get(c.id)?.selected ?? true, work: prev.get(c.id)?.work ?? WORK_RE.test(c.summary), d2l: prev.get(c.id)?.d2l ?? D2L_NAME_RE.test(c.summary) }))
      d.cal.connected = true
      if (!d.cal.writeCal || !cals.some(c => c.id === d.cal.writeCal)) d.cal.writeCal = cals.find(c => c.primary)?.id || 'primary'
    })
    syncing = false; tell()
    await syncGoogle(true)
    toast('Google Calendar connected.')
  } catch (e) { syncing = false; syncErr = (e as Error).message; tell(); throw e }
}
export async function syncGoogle(interactive = false) {
  const s = getState()
  if (!s.cal.connected || syncing) return
  if (!interactive && !G.savedToken()) { syncErr = 'Your Google session ended. Tap Refresh to reconnect.'; tell(); return }
  syncing = true; syncErr = ''; tell()
  try {
    const from = new Date(); from.setDate(from.getDate() - 35)
    const to = new Date(); to.setDate(to.getDate() + 49)
    const out: ExtEvent[] = []
    for (const c of s.cal.calendars.filter(c => c.selected)) out.push(...await G.listEvents(s.cal.clientId, c, from, to))
    update(d => { d.gcache = { events: out, fetchedAt: new Date().toISOString() }; d.cal.lastSync = new Date().toISOString() })
  } catch (e) { syncErr = (e as Error).message; catSays('wrong') }
  finally { syncing = false; tell() }
}
export function disconnectGoogle() {
  G.revoke()
  update(d => { d.cal.connected = false; d.gcache = { events: [] } })
  toast('Google Calendar disconnected. Your events in this app stay.')
}
let timer: ReturnType<typeof setInterval> | null = null
export function startAutoSync() {
  if (timer) return
  void syncGoogle(false)
  timer = setInterval(() => { void syncGoogle(false) }, 15 * 60000)
}
