import { createContext, useCallback, useContext, useEffect, useId, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Inbox, Menu, X } from 'lucide-react'
import './ui.css'

export const cx = (...a) => a.filter(Boolean).join(' ')

export function Button({ variant = 'primary', size, as: As = 'button', className, children, ...p }) {
  return <As className={cx('btn', `btn-${variant}`, size && `btn-${size}`, className)} {...p}>{children}</As>
}
export function Card({ hover, className, children, ...p }) {
  return <div className={cx('card', hover && 'hover', className)} {...p}>{children}</div>
}
export function Badge({ tone = '', children }) {
  return <span className={cx('badge', tone)}>{children}</span>
}
export function Loader({ label }) {
  return <span role="status" className="row"><span className="loader" />{label && <span className="muted">{label}</span>}<span className="sr-only">Loading</span></span>
}
export function Skeleton({ h = 16, w = '100%', style }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} />
}

export function Field({ label, error, hint, children }) {
  const id = useId()
  return (
    <div className={cx('field', error && 'invalid')}>
      {label && <label htmlFor={id}>{label}</label>}
      {typeof children === 'function' ? children({ id, 'aria-invalid': !!error }) : children}
      {error ? <span className="err" role="alert">{error}</span> : hint && <span className="hint">{hint}</span>}
    </div>
  )
}
export function Input({ label, error, hint, ...p }) {
  return <Field label={label} error={error} hint={hint}>{(a) => <input className="input" {...a} {...p} />}</Field>
}
export function Select({ label, error, hint, options = [], ...p }) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(a) => <select className="select" {...a} {...p}>{options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}</select>}
    </Field>
  )
}

export function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head row"><h3 style={{ margin: 0 }}>{title}</h3><span className="spacer" />
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X size={16} /></Button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function EmptyState({ title = 'Nothing here yet', children, icon: Icon = Inbox }) {
  return <div className="empty"><Icon size={40} /><h3>{title}</h3><p>{children}</p></div>
}

/** columns: [{key,label,render?}], rows: array, pageSize for client-side pagination */
export function Table({ columns, rows, pageSize = 10, loading, empty }) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const cur = Math.min(page, pages - 1)
  const slice = rows.slice(cur * pageSize, cur * pageSize + pageSize)
  if (loading) return <div className="grid">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={38} />)}</div>
  if (!rows.length) return <div className="table-wrap">{empty || <EmptyState />}</div>
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
        <tbody>{slice.map((r, i) => <tr key={r.id ?? i}>{columns.map((c) => <td key={c.key}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>)}</tbody>
      </table>
      <div className="pager"><span>Page {cur + 1} of {pages} · {rows.length} records</span>
        <span className="row"><Button variant="ghost" size="sm" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Previous</Button>
          <Button variant="ghost" size="sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</Button></span></div>
    </div>
  )
}

import { DialogCtx } from './Dialog'
export { DialogProvider, useDialog } from './Dialog'
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }) {
  const [list, setList] = useState([])
  const dlg = useContext(DialogCtx)
  const push = useCallback((message, kind = 'success') => {
    if (kind === 'error' && dlg) { dlg.error(message); return } // errors and warnings are shown in our own dialog, not a fading notice
    if (kind === 'warning' && dlg) { dlg.warning(message); return }
    const id = Math.random()
    setList((l) => [...l, { id, message, kind }])
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 4000)
  }, [dlg])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">{list.map((t) => <div key={t.id} className={cx('toast', t.kind)}>{t.message}</div>)}</div>
    </ToastCtx.Provider>
  )
}

export function Navbar({ links = [], right, onMenu }) {
  const [open, setOpen] = useState(false)
  return (
    <header className="navbar">
      <div className="container">
        {onMenu && <Button variant="ghost" size="sm" className="side-toggle" onClick={onMenu} aria-label="Toggle sidebar"><Menu size={18} /></Button>}
        <Link to="/" className="brand"><img src="/logo.jpg" alt="Vishnu Universal Learning logo" /><span><b>SVES Connect</b><small>Sri Vishnu Educational Society</small></span></Link>
        <nav className={cx('nav-links', open && 'open')} onClick={() => setOpen(false)}>
          {links.map((l) => (l.plain ? <Link key={l.to} to={l.to}>{l.label}</Link> : <NavLink key={l.to} to={l.to} end={l.to === '/'}>{l.label}</NavLink>))}
          {right}
        </nav>
        <button className="nav-toggle" aria-label="Menu" onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
    </header>
  )
}

export function Sidebar({ groups, open, onNavigate }) {
  return (
    <aside className={cx('sidebar', open && 'open')} onClick={onNavigate}>
      {groups.map((g) => (
        <div key={g.title}><h4>{g.title}</h4>
          {g.items.map((i) => <NavLink key={i.to} to={i.to}><i.icon size={18} />{i.label}</NavLink>)}</div>
      ))}
    </aside>
  )
}
