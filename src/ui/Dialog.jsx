import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, CircleHelp, Info, TriangleAlert } from 'lucide-react'
import './dialog.css'

/** Our own dialog boxes (information, success, warning, error, question). Used instead of the browser's alert / confirm. */
export const DialogCtx = createContext(null)
export const useDialog = () => useContext(DialogCtx)

const ICON = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert, question: CircleHelp, danger: TriangleAlert }
const TITLE = { info: 'Please note', success: 'Done', warning: 'Please check', error: 'Something needs your attention', question: 'Please confirm', danger: 'Please confirm' }

export function DialogProvider({ children }) {
  const [queue, setQueue] = useState([])
  const show = useCallback((opts) => new Promise((resolve) => setQueue((q) => [...q, { ...opts, resolve }])), [])
  const api = useMemo(() => ({
    show,
    /** confirm({ title, message, confirmText, cancelText, tone: 'question' | 'danger' | 'warning' }) -> true / false */
    confirm: (o) => show({ tone: 'question', cancelText: 'Cancel', confirmText: 'Yes, continue', ...o, kind: 'confirm' }),
    info: (message, title) => show({ tone: 'info', title, message }),
    success: (message, title) => show({ tone: 'success', title, message }),
    warning: (message, title) => show({ tone: 'warning', title, message }),
    error: (message, title) => show({ tone: 'error', title, message }),
  }), [show])
  const cur = queue[0]
  const close = (value) => { cur.resolve(value); setQueue((q) => q.slice(1)) }
  return (
    <DialogCtx.Provider value={api}>
      {children}
      {cur && <DialogBox key={queue.length + (cur.title || '')} d={cur} onClose={close} />}
    </DialogCtx.Provider>
  )
}

function DialogBox({ d, onClose }) {
  const tone = d.tone || 'info'
  const Icon = ICON[tone] || Info
  const isConfirm = d.kind === 'confirm'
  const ref = useRef(null)
  const buttons = d.buttons || (isConfirm
    ? [{ label: d.cancelText, value: false, variant: 'ghost' }, { label: d.confirmText, value: true, variant: tone === 'danger' ? 'danger' : 'primary', primary: true }]
    : [{ label: d.okText || 'OK', value: true, variant: 'primary', primary: true }])
  useEffect(() => {
    const prev = document.activeElement
    ref.current?.querySelector('[data-primary]')?.focus()
    const key = (e) => { if (e.key === 'Escape') onClose(isConfirm ? false : true) }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); prev?.focus?.() }
  }, [onClose, isConfirm])
  const lines = Array.isArray(d.message) ? d.message : String(d.message ?? '').split('\n')
  return (
    <div className="dlg-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !isConfirm) onClose(true) }}>
      <div className={`dlg ${tone}`} role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" ref={ref}>
        <div className="dlg-icon"><Icon size={26} /></div>
        <h2 id="dlg-title">{d.title || TITLE[tone]}</h2>
        <div className="dlg-msg">{lines.map((l, i) => <p key={i}>{l}</p>)}</div>
        {d.details && <ul className="dlg-list">{d.details.map((x) => <li key={x}>{x}</li>)}</ul>}
        <div className="dlg-actions">{buttons.map((b) => (
          <button key={b.label} type="button" data-primary={b.primary ? '' : undefined} className={`btn ${b.variant === 'ghost' ? 'btn-ghost' : b.variant === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={() => onClose(b.value)}>{b.label}</button>))}</div>
      </div>
    </div>
  )
}
