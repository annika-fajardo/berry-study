/* All state changes. Each one is a single update() so it is saved through the one save path. */
import { update, getState } from './store'
import type { AppState, Item, Kind, Session } from './types'
import { todayStr, uid } from '../lib/dates'
import { grantXp, revokeXp, itemXp, XP, plantFor, PLANT_LABEL } from '../lib/game'
import { celebrateXp, emit, toast } from '../lib/events'

export function itemsOf(s: AppState): Item[] { return Object.entries(s.items).map(([id, i]) => ({ id, ...i })) }
export function gradesOf(s: AppState) { return Object.entries(s.grades).map(([id, g]) => ({ id, ...g })) }

/* ---------- Schedule ---------- */
export function setItemDone(id: string, done: boolean) {
  let gained = 0
  update(d => {
    const i = d.items[id]; if (!i) return
    i.done = done
    if (done) gained = grantXp(d, itemXp(i), 'Ticked off: ' + i.c + ' ' + i.t, { ref: 'item:' + id, c: i.c })
    else revokeXp(d, 'item:' + id)
  })
  if (done) celebrateXp(gained, 'tick')
  return gained
}
export type ItemDraft = { c: string; k: Kind; t: string; d: string; w: string; n: string; effort?: string }
export function saveItem(id: string | null, x: ItemDraft) {
  update(d => {
    const base = id && d.items[id] ? d.items[id] : null
    const doc: Omit<Item, 'id'> = { c: x.c, t: x.t.trim(), k: x.k, done: !!(base && base.done) }
    if (x.d) doc.d = x.d; else if (base) doc.d = null
    if (x.w.trim()) doc.w = x.w.trim(); else if (base) doc.w = null
    if (x.n.trim()) doc.n = x.n.trim(); else if (base) doc.n = null
    const ef = x.effort != null && x.effort.trim() !== '' ? Number(x.effort) : NaN
    if (isFinite(ef) && ef >= 0) doc.effort = Math.round(ef * 100) / 100; else if (base && base.effort != null) doc.effort = null
    d.items[id || uid('it')] = doc
    if (id && base && base.done) { // keep the XP in step with the task's new weight
      revokeXp(d, 'item:' + id); grantXp(d, itemXp(doc), 'Ticked off: ' + doc.c + ' ' + doc.t, { ref: 'item:' + id, c: doc.c })
    }
  })
}
export function deleteItem(id: string) {
  let backup: Omit<Item, 'id'> | null = null, xp: AppState['xp'] = {}
  update(d => {
    backup = d.items[id]
    for (const [k, e] of Object.entries(d.xp)) if (e.ref === 'item:' + id) xp[k] = e
    delete d.items[id]; revokeXp(d, 'item:' + id)
  })
  toast('Deleted.', { actionLabel: 'Undo', action: () => update(d => { if (backup) { d.items[id] = backup; Object.assign(d.xp, xp) } }) })
}

/* ---------- Grades ---------- */
export function saveScore(id: string, v: string): string | null {
  const val = v === '' ? null : Math.max(0, Math.min(100, Number(v)))
  if (v !== '' && !isFinite(val as number)) return 'Enter the mark as a number from 0 to 100.'
  const g = getState().grades[id]
  update(d => { if (d.grades[id]) d.grades[id].score = val })
  return g ? 'Saved ' + g.c + ' ' + g.name + '.' : null
}

/* ---------- Practice records (same shape as the old record()) ---------- */
export function recordPractice(d: AppState, id: string, label: string, ok: boolean, course: string) {
  const cur = d.practice[id] || { c: course, label, tries: 0, correct: 0 }
  d.practice[id] = { c: cur.c || course, label, tries: (cur.tries || 0) + 1, correct: (cur.correct || 0) + (ok ? 1 : 0), last: todayStr() }
}
export function recordMastery(d: AppState, id: string, c: string, concept: string, seen: number, correct: number) {
  const cur = d.mastery[id] || { c, concept, seen: 0, correct: 0 }
  d.mastery[id] = { c, concept, seen: (cur.seen || 0) + seen, correct: (cur.correct || 0) + correct, last: todayStr() }
}

/** Award XP for an answer and make Berry react. Returns XP gained. */
export function answerXp(d: AppState, ok: boolean, reason: string, c: string, opts: { firstTry?: boolean; ref?: string } = {}) {
  if (!ok) return 0
  let g = grantXp(d, XP.correct, reason, { c, ref: opts.ref })
  if (g && opts.firstTry) g += grantXp(d, XP.firstTry, 'First-try bonus: ' + reason, { c, ref: opts.ref ? opts.ref + ':ft' : undefined })
  return g
}

/* ---------- Study time and the garden ---------- */
function addStudy(d: AppState, c: string, date: string, mins: number) {
  if (mins < 1) return
  const cur = d.study[date] || {}
  d.study[date] = { ...cur, [c]: Math.round((Number(cur[c] || 0) + mins) * 10) / 10 }
}
export function startTimer(c: string, planned: number) {
  update(d => { d.timer = { c, start: Date.now(), planned } })
}
/** Timer reached its planned length: the plant is grown, minutes and XP are logged. */
export function completeTimer() {
  const t = getState().timer; if (!t) return null
  const minutes = t.planned
  const sess = addSession({ c: t.c, minutes, date: todayStr(new Date(t.start)), source: 'timer', status: 'grown' }, true)
  emit('catblink', {})
  return sess
}
/** Stopped early: the plant wilts. Minutes spent still count as study time, but earn no XP. */
export function abandonTimer() {
  const t = getState().timer; if (!t) return
  const mins = Math.floor((Date.now() - t.start) / 60000)
  update(d => {
    d.timer = null
    const id = uid('s')
    d.sessions[id] = { id, c: t.c, date: todayStr(new Date(t.start)), minutes: mins, source: 'timer', status: 'wilted', plant: plantFor(t.planned), ts: new Date().toISOString() }
    addStudy(d, t.c, todayStr(new Date(t.start)), mins)
  })
  toast(mins >= 1 ? 'Plant wilted. ' + mins + ' min still counted as study time.' : 'Plant wilted. Try a shorter session next time.')
}
export function addSession(x: { c: string; minutes: number; date: string; source: Session['source']; status: Session['status'] }, clearTimer = false) {
  const id = uid('s'); let gained = 0
  const sess: Session = { id, c: x.c, date: x.date, minutes: Math.round(x.minutes), source: x.source, status: x.status, plant: plantFor(x.minutes), ts: new Date().toISOString() }
  update(d => {
    if (clearTimer) d.timer = null
    d.sessions[id] = sess
    addStudy(d, x.c, x.date, sess.minutes)
    if (x.status === 'grown') gained = grantXp(d, sess.minutes * XP.perMinute, (x.source === 'flora' ? 'Flora session: ' : 'Focus session: ') + x.c + ' ' + sess.minutes + ' min', { ref: 'session:' + id, c: x.c }, x.date)
  })
  celebrateXp(gained, x.source === 'timer' ? 'timerdone' : 'tick')
  toast(PLANT_LABEL[sess.plant] + ' planted for ' + x.c + ' · ' + sess.minutes + ' min · +' + gained + ' xp')
  return sess
}
export function logFlora(c: string, minutes: number, date: string) { return addSession({ c, minutes, date, source: 'flora', status: 'grown' }) }
export function deleteSession(id: string) {
  update(d => { const s = d.sessions[id]; if (!s) return; delete d.sessions[id]; revokeXp(d, 'session:' + id)
    if (s.status === 'grown' || s.source === 'timer') { const day = d.study[s.date]; if (day && day[s.c]) { day[s.c] = Math.max(0, Math.round((day[s.c] - s.minutes) * 10) / 10) } } })
}

/* ---------- Settings ---------- */
export function setSetting<K extends keyof AppState['settings']>(k: K, v: AppState['settings'][K]) {
  update(d => { d.settings[k] = v })
  if (k === 'theme') { try { localStorage.setItem('berry-theme', String(v)) } catch { /* private mode */ } }
}
export function setWritten(id: string, text: string) { update(d => { d.written[id] = text }) }
