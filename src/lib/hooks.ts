import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../store/store'
import { itemsOf, gradesOf } from '../store/actions'
import { on, type Mood } from './events'
import { stripStats } from './schedule'
import { lastActive } from './game'
import { daysBetween, todayStr } from './dates'

export function useNow(ms = 1000) {
  const [n, setN] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return n
}
/** Re-renders when the local date rolls over, so "today" is always right. */
export function useToday() { const n = useNow(30000); return todayStr(new Date(n)) }

export function useData() {
  const s = useAppState()
  const items = useMemo(() => itemsOf(s), [s.items])
  const grades = useMemo(() => gradesOf(s), [s.grades])
  return { s, items, grades }
}

/** Berry's resting mood from the state of things, briefly overridden by reactions (cheering/proud). */
export function useBerryMood(): Mood {
  const { s, items } = useData()
  const t = useToday()
  const [flash, setFlash] = useState<Mood | null>(null)
  useEffect(() => {
    let tm: ReturnType<typeof setTimeout>
    const off = on('berry', e => { setFlash(e.mood); clearTimeout(tm); tm = setTimeout(() => setFlash(null), 2600) })
    return () => { off(); clearTimeout(tm) }
  }, [])
  if (flash) return flash
  if (s.timer) return 'studying'
  if (stripStats(items, t).late.length) return 'worried'
  const la = lastActive(s)
  if (!la || daysBetween(la, t) >= 2) return 'sleepy'
  return 'happy'
}
