import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../store/store'
import { itemsOf, gradesOf } from '../store/actions'
import { todayStr } from './dates'

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

