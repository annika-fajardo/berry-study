/* Work-shift detection: a title match, a calendar tagged "Work" in Settings, or a manual mark on the event. */
import type { AppState, ExtEvent } from '../store/types'
export const WORK_RE = /shift|banquet|hotel arts|mejuri|work/i
export function isWork(e: ExtEvent, s: Pick<AppState, 'workMarks' | 'cal' | 'ics'>) {
  const mark = s.workMarks[e.id]
  if (mark != null) return mark
  if (e.source === 'google' && s.cal.calendars.some(c => c.id === e.cal && c.work)) return true
  if (e.source === 'ics' && s.ics[e.cal]?.work) return true
  return WORK_RE.test(e.title)
}
