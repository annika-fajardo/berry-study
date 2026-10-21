/* Hash routing so the app works from any sub-path and from a file:// single-file build. */
import { useEffect, useState } from 'react'
export type Route = { tab: string; parts: string[] }
export const TABS = ['today', 'schedule', 'courses', 'focus', 'grades', 'settings'] as const
function read(): Route {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''))
  const parts = h.split('/').filter(Boolean)
  const tab = (TABS as readonly string[]).includes(parts[0]) ? parts[0] : 'today'
  return { tab, parts: parts.slice(1) }
}
export function useRoute() {
  const [r, setR] = useState(read)
  useEffect(() => { const f = () => { setR(read()); window.scrollTo(0, 0) }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, [])
  return r
}
export function go(path: string) { location.hash = '#/' + path }
export const courseSlug = (c: string) => c.toLowerCase().replace(/\s+/g, '-')
