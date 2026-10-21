/* conceptsFor() from course-desk.html: every formula/concept row becomes a concept with a stable id. */
import { COURSE_CONTENT } from '../data/content'
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
export type Concept = { id: string; name: string; section: string; text: string }
function textOf(html: string) {
  return html.replace(/<br\s*\/?>/g, ' ').replace(/<\/div>/g, ' ').replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim()
}
const cache: Record<string, Concept[]> = {}
export function conceptsFor(c: string): Concept[] {
  if (cache[c]) return cache[c]
  const cc = COURSE_CONTENT[c]; if (!cc) return []
  const out: Concept[] = []
  for (const sec of cc.formulas) for (const [t, h] of sec.items) out.push({ id: slug(c) + '--' + slug(t), name: t, section: sec.h, text: textOf(h) })
  return (cache[c] = out)
}
