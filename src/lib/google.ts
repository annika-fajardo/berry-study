/* Google Calendar, entirely client-side: Google Identity Services token client + Calendar REST API via fetch.
   The access token lives in this browser only (localStorage, ~1 hour) and is never exported.
   The app only edits or deletes events it created (extendedProperties.private.berryStudy = "1"). */
import type { ExtEvent, GCal } from '../store/types'
import { toLocal } from './time'

const GIS = 'https://accounts.google.com/gsi/client'
const API = 'https://www.googleapis.com/calendar/v3'
export const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events'
const TK = 'berry-gtoken'

type TokenResp = { access_token?: string; expires_in?: number; error?: string; error_description?: string }
type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void; callback: (r: TokenResp) => void }
declare global { interface Window { google?: { accounts: { oauth2: { initTokenClient: (c: { client_id: string; scope: string; callback: (r: TokenResp) => void; error_callback?: (e: { type?: string; message?: string }) => void }) => TokenClient; revoke: (t: string, cb?: () => void) => void } } } } }

export class GoogleError extends Error { constructor(msg: string, public code = '') { super(msg) } }

let gisPromise: Promise<void> | null = null
export function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisPromise) return gisPromise
  gisPromise = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = GIS; s.async = true
    s.onload = () => (window.google?.accounts?.oauth2 ? res() : rej(new GoogleError("Google sign-in didn't load.")))
    s.onerror = () => { gisPromise = null; rej(new GoogleError("Couldn't reach Google. Check your connection and try again.", 'offline')) }
    document.head.append(s)
  })
  return gisPromise
}

export function savedToken(): string | null {
  try { const t = JSON.parse(localStorage.getItem(TK) || 'null'); if (t && t.exp > Date.now() + 30000) return t.token } catch { /* ignore */ }
  return null
}
export function clearToken() { try { localStorage.removeItem(TK) } catch { /* ignore */ } }
let client: TokenClient | null = null, clientFor = ''
/** Ask Google for a token. prompt '' re-uses an earlier grant silently where possible; 'consent' shows the full screen. */
export async function requestToken(clientId: string, prompt: '' | 'consent' = ''): Promise<string> {
  if (!clientId) throw new GoogleError('Add your Google OAuth Client ID first (see the setup steps below).', 'noclient')
  await loadGis()
  return new Promise((res, rej) => {
    const cb = (r: TokenResp) => {
      if (r.error || !r.access_token) { rej(new GoogleError(r.error === 'access_denied' ? 'Google access was declined.' : 'Google sign-in failed: ' + (r.error_description || r.error || 'unknown error'), r.error)); return }
      try { localStorage.setItem(TK, JSON.stringify({ token: r.access_token, exp: Date.now() + (r.expires_in || 3600) * 1000 })) } catch { /* ignore */ }
      res(r.access_token)
    }
    if (!client || clientFor !== clientId) {
      client = window.google!.accounts.oauth2.initTokenClient({ client_id: clientId, scope: SCOPES, callback: cb, error_callback: e => rej(new GoogleError(e.type === 'popup_closed' ? 'The Google window was closed before finishing.' : e.type === 'popup_failed_to_open' ? 'Your browser blocked the Google window. Allow pop-ups for this site and try again.' : 'Google sign-in failed.', e.type)) })
      clientFor = clientId
    } else client.callback = cb
    client.requestAccessToken({ prompt })
  })
}
export function revoke() { const t = savedToken(); clearToken(); try { if (t) window.google?.accounts.oauth2.revoke(t) } catch { /* ignore */ } }

async function api<T>(clientId: string, path: string, init: RequestInit = {}, retry = true): Promise<T> {
  let tok = savedToken()
  if (!tok) tok = await requestToken(clientId, '')
  const r = await fetch(API + path, { ...init, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  if (r.status === 401 && retry) { clearToken(); await requestToken(clientId, ''); return api<T>(clientId, path, init, false) }
  if (r.status === 204) return undefined as T
  if (!r.ok) {
    let msg = ''
    try { msg = (await r.json()).error?.message || '' } catch { /* ignore */ }
    throw new GoogleError(r.status === 403 ? 'Google refused that request. ' + msg : r.status === 404 ? 'That calendar or event no longer exists.' : 'Google Calendar error (' + r.status + '). ' + msg, String(r.status))
  }
  return r.json() as Promise<T>
}

type GCalItem = { id: string; summary: string; backgroundColor?: string; primary?: boolean; accessRole?: string }
export async function listCalendars(clientId: string): Promise<GCal[]> {
  const r = await api<{ items: GCalItem[] }>(clientId, '/users/me/calendarList?minAccessRole=reader&maxResults=250')
  return (r.items || []).map(c => ({ id: c.id, summary: c.summary, color: c.backgroundColor, primary: !!c.primary, selected: true, writable: c.accessRole === 'owner' || c.accessRole === 'writer' }))
}

type GEvent = {
  id: string; status?: string; summary?: string; description?: string; transparency?: string
  start: { date?: string; dateTime?: string }; end: { date?: string; dateTime?: string }
  attendees?: { self?: boolean; responseStatus?: string }[]
  extendedProperties?: { private?: Record<string, string> }
}
const localOf = (x: { date?: string; dateTime?: string }) => (x.dateTime ? toLocal(new Date(x.dateTime)) : x.date!)
export function mapEvent(e: GEvent, cal: string, color?: string): ExtEvent | null {
  if (e.status === 'cancelled') return null
  const declined = (e.attendees || []).some(a => a.self && a.responseStatus === 'declined')
  const allDay = !!e.start.date && !e.start.dateTime
  let end = localOf(e.end)
  if (allDay && e.end.date) { const d = new Date(e.end.date + 'T00:00'); d.setDate(d.getDate() - 1); end = toLocal(d).slice(0, 10) }
  return {
    id: 'g:' + cal + ':' + e.id, cal, source: 'google', title: e.summary || '(no title)', desc: e.description,
    allDay, start: localOf(e.start), end, color,
    busy: e.transparency !== 'transparent' && !declined && !allDay,
    berry: e.extendedProperties?.private?.berryStudy === '1',
  }
}
export async function listEvents(clientId: string, cal: GCal, timeMin: Date, timeMax: Date): Promise<ExtEvent[]> {
  const out: ExtEvent[] = []
  let page = ''
  for (let i = 0; i < 10; i++) {
    const q = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), maxResults: '250' })
    if (page) q.set('pageToken', page)
    const r = await api<{ items: GEvent[]; nextPageToken?: string }>(clientId, `/calendars/${encodeURIComponent(cal.id)}/events?` + q)
    for (const e of r.items || []) { const m = mapEvent(e, cal.id, cal.color); if (m) out.push(m) }
    if (!r.nextPageToken) break
    page = r.nextPageToken
  }
  return out
}

/** Google's event colours closest to each course colour. */
export const COURSE_COLOR_ID: Record<string, string> = { 'FNCE 477': '2', 'FNCE 445': '4', 'MGST 451': '10', 'SGMA 591': '1' }
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone
export type StudyBlock = { id: string; title: string; start: string; end: string; c?: string; note?: string }
function body(b: StudyBlock) {
  const iso = (s: string) => { const d = new Date(s); return d.toISOString() }
  return {
    summary: b.title.startsWith('Study:') ? b.title : 'Study: ' + b.title,
    description: (b.note ? b.note + '\n\n' : '') + 'Added by Berry Study.',
    start: { dateTime: iso(b.start), timeZone: tz() }, end: { dateTime: iso(b.end), timeZone: tz() },
    colorId: b.c ? COURSE_COLOR_ID[b.c] : undefined,
    extendedProperties: { private: { berryStudy: '1', berryId: b.id } },
  }
}
export async function createStudyEvent(clientId: string, calId: string, b: StudyBlock): Promise<string> {
  const r = await api<{ id: string }>(clientId, `/calendars/${encodeURIComponent(calId)}/events`, { method: 'POST', body: JSON.stringify(body(b)) })
  return r.id
}
/** Only touches events that carry our private marker. */
async function ours(clientId: string, calId: string, id: string) {
  const e = await api<GEvent>(clientId, `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(id)}`)
  if (e.extendedProperties?.private?.berryStudy !== '1') throw new GoogleError("That event wasn't created by Berry Study, so it was left alone.", 'notours')
}
export async function updateStudyEvent(clientId: string, calId: string, id: string, b: StudyBlock) {
  await ours(clientId, calId, id)
  await api(clientId, `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body(b)) })
}
export async function deleteStudyEvent(clientId: string, calId: string, id: string) {
  await ours(clientId, calId, id)
  await api(clientId, `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
