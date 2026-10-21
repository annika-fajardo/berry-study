/* Shared page furniture: lucide icons, panels with Notion-style view tabs, page headers, empty states. */
import type { ComponentType, ReactNode } from 'react'
import type { LucideProps } from 'lucide-react'
import { Cat, type CatStatus } from './Cat'
import { readinessTone } from '../lib/readiness'

export type Icon = ComponentType<LucideProps>
export function I({ as: C, size = 17, className = 'ico', ...rest }: { as: Icon; size?: number; className?: string } & LucideProps) {
  return <C size={size} strokeWidth={1.5} className={className} aria-hidden="true" {...rest} />
}

export function Panel({ icon, title, tabs, right, children, className, id, ...rest }: { icon?: Icon; title: ReactNode; tabs?: ReactNode; right?: ReactNode; children?: ReactNode; className?: string; id?: string; [k: `data-${string}`]: string | undefined }) {
  const hid = id ? id + '-h' : undefined
  return (
    <section className={'panel ' + (className || '')} aria-labelledby={hid} id={id} {...rest}>
      <div className="panel-h">
        <h2 id={hid}>{icon && <I as={icon} />}{title}</h2>
        {right && <div className="right">{right}</div>}
      </div>
      {tabs}
      {children}
    </section>
  )
}

export function ViewTabs<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { v: T; label: string; icon?: Icon }[]; label: string }) {
  return (
    <div className="vtabs" role="tablist" aria-label={label}>
      {options.map(o => <button key={o.v} type="button" role="tab" aria-selected={value === o.v} aria-pressed={value === o.v} onClick={() => onChange(o.v)}>{o.icon && <I as={o.icon} size={15} />}{o.label}</button>)}
    </div>
  )
}

export function PageHead({ title, desc, crumb, right }: { title: string; desc?: ReactNode; crumb?: { href: string; label: string }; right?: ReactNode }) {
  return (
    <header className="page-head">
      <div style={{ minWidth: 0 }}>
        {crumb && <a className="crumb" href={crumb.href}>← {crumb.label}</a>}
        <h1 className="ptitle">{title}</h1>
        {desc && <p className="pdesc">{desc}</p>}
      </div>
      {right}
    </header>
  )
}

/** Empty or status message with a small Emi. */
export function Empty({ children, status = 'question', size = 64 }: { children: ReactNode; status?: CatStatus; size?: number }) {
  return <div className="empty-state"><Cat status={status} size={size} /><div>{children}</div></div>
}

export function ReadyBar({ pct, compact }: { pct: number; compact?: boolean }) {
  const tone = readinessTone(pct)
  return (
    <span className={'ready ready-' + tone + (compact ? ' compact' : '')} title={pct + '% ready'}>
      <span className="ready-bar" aria-hidden="true"><span style={{ width: pct + '%' }} /></span>
      <span className="ready-num">{pct}% ready</span>
    </span>
  )
}
