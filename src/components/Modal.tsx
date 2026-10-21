import { useEffect, useRef, type ReactNode } from 'react'

/** Accessible modal dialog: focus moves in, Escape closes, focus returns to the opener. */
export function Modal({ title, onClose, children, labelledBy }: { title?: string; onClose: () => void; children: ReactNode; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose); close.current = onClose
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const el = ref.current
    const first = el?.querySelector<HTMLElement>('[autofocus], input, select, textarea, button')
    first?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current() }
      if (e.key === 'Tab' && el) {
        const f = Array.from(el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(x => !x.hasAttribute('disabled'))
        if (!f.length) return
        const a = f[0], b = f[f.length - 1]
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus() } else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus() }
      }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); opener?.focus?.() }
  }, [])
  return (
    <div className="backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy || 'modal-title'} ref={ref}>
        {title && <h2 id="modal-title">{title}</h2>}
        {children}
      </div>
    </div>
  )
}

/** Styled replacement for confirm(). */
export function Confirm({ title, body, confirmLabel, danger, onConfirm, onCancel }: { title: string; body: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div>{body}</div>
      <div className="wrap" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn ghost" onClick={onCancel} autoFocus>Cancel</button>
        <button type="button" className={'btn ' + (danger ? 'danger' : 'berry')} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  )
}
