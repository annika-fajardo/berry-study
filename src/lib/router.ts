/* Hash routing, so the app works from any sub-path and from the single-file build opened off disk. */
import { useEffect, useState } from 'react'
export type Route = { tab: string; parts: string[] }
export const TABS = ['home', 'schedule', 'study', 'garden', 'grades', 'settings'] as const
/** Old v1 links keep working. */
const ALIAS: Record<string, string> = { today: 'home', courses: 'study', focus: 'garden', calendar: 'schedule' }
function read(): Route {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''))
  const parts = h.split('/').filter(Boolean)
  const first = ALIAS[parts[0]] || parts[0]
  const tab = (TABS as readonly string[]).includes(first) ? first : 'home'
  return { tab, parts: parts.slice(1) }
}
export function useRoute() {
  const [r, setR] = useState(read)
  useEffect(() => {
    const f = () => { setR(read()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return r
}
export function go(path: string) { location.hash = '#/' + path }
export const courseSlug = (c: string) => c.toLowerCase().replace(/\s+/g, '-')
