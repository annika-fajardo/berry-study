/* Tab icons: chunky rounded strokes to match the sticker style. `.fillme` gets the accent when active. */
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
export function TabIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === 'today' && <><circle className="fillme" cx="12" cy="12" r="4.2" {...P} /><path {...P} d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5" /></>}
      {name === 'schedule' && <><rect className="fillme" x="3.5" y="5" width="17" height="15.5" rx="4" {...P} /><path {...P} d="M8 3v4M16 3v4M3.5 10h17M8 14h2M14 14h2M8 17h2" /></>}
      {name === 'courses' && <><path className="fillme" {...P} d="M4 5.5c2.8-1.2 5.5-1.2 8 .5v14c-2.5-1.7-5.2-1.7-8-.5z" /><path {...P} d="M20 5.5c-2.8-1.2-5.5-1.2-8 .5v14c2.5-1.7 5.2-1.7 8-.5z" /></>}
      {name === 'focus' && <><path className="fillme" {...P} d="M12 21c0-5 0-7 0-9M12 12c-4 0-6.5-2.5-6.5-6.5C9.5 5.5 12 8 12 12zM12 14c3.5 0 6-2 6-6-3.5 0-6 2.5-6 6z" /><path {...P} d="M7 21h10" /></>}
      {name === 'grades' && <path className="fillme" {...P} d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.5l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />}
      {name === 'settings' && <><circle className="fillme" cx="12" cy="12" r="3" {...P} /><path {...P} d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5" /><circle {...P} cx="12" cy="12" r="6.5" /></>}
    </svg>
  )
}
export const TAB_LABEL: Record<string, string> = { today: 'Today', schedule: 'Schedule', courses: 'Courses', focus: 'Focus', grades: 'Grades', settings: 'Settings' }
