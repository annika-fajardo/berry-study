/* Local wall-clock helpers. Calendar times are stored as 'YYYY-MM-DDTHH:mm' in the device's time zone. */
import { todayStr } from './dates'
export const pad = (n: number) => String(n).padStart(2, '0')
export function toLocal(d: Date) { return todayStr(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) }
export function fromLocal(s: string) { const [d, t = '00:00'] = s.split('T'); const [y, m, dd] = d.split('-').map(Number); const [hh, mm] = t.split(':').map(Number); return new Date(y, m - 1, dd, hh || 0, mm || 0) }
export const ms = (s: string) => fromLocal(s).getTime()
export const minOfDay = (s: string) => { const d = fromLocal(s); return d.getHours() * 60 + d.getMinutes() }
export const atMin = (day: string, min: number) => day + 'T' + pad(Math.floor(min / 60)) + ':' + pad(min % 60)
export const snap = (min: number, step = 15) => Math.round(min / step) * step
export function hhmm(min: number) { const h = Math.floor(min / 60), m = min % 60, ap = h >= 12 ? 'pm' : 'am', h12 = ((h + 11) % 12) + 1; return h12 + (m ? ':' + pad(m) : '') + ap }
export function timeRange(start: string, end: string) {
  const a = minOfDay(start), b = minOfDay(end)
  const sameAp = (a >= 720) === (b >= 720)
  return (sameAp ? hhmm(a).replace(/am|pm/, '') : hhmm(a)) + '–' + hhmm(b)
}
export const durMin = (start: string, end: string) => Math.round((ms(end) - ms(start)) / 60000)
