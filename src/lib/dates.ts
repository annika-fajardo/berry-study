/* Date helpers from course-desk.html. "Today" is always the device's local date (Calgary/Vancouver). */
export function todayStr(now = new Date()) {
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
}
export function dateStr(d: Date) { return todayStr(d) }
export function parse(s: string) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export function fmt(d: Date, o: Intl.DateTimeFormatOptions) { return d.toLocaleDateString('en-CA', o) }
export function monday(d: Date) { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x }
export function daysBetween(a: string, b: string) { return Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5) }
export function addDays(s: string, n: number) { const d = parse(s); d.setDate(d.getDate() + n); return todayStr(d) }
export function hm(m: number) { m = Math.round(m); return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm' }
export function uid(prefix = 'u') { return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
