import { useEffect, useRef, useState } from 'react'
import { api } from '../../core/api'

/** Equipment name box with an instant list of matching names already used in this college. Picking one fills in its purpose too; anything else is a new name. */
export default function NameSuggest({ college, value, onChange, onPick, onExact, error }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(-1)
  const seq = useRef(0)
  const box = useRef(null)

  useEffect(() => {
    const q = value.trim()
    const n = ++seq.current
    if (!q) return undefined
    const t = setTimeout(() => {
      api(`/c/${college}/catalog?q=${encodeURIComponent(q)}`).then((r) => { if (n !== seq.current) return; setItems(r.items); const ex = r.items.find((i) => i.name.toLowerCase() === q.toLowerCase()); onExact?.(ex || null) }).catch(() => {})
    }, 120)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, college])

  useEffect(() => {
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])

  const shown = value.trim() ? items : []
  const pick = (it) => { onPick(it); setOpen(false); setHi(-1) }
  const exact = shown.some((i) => i.name.toLowerCase() === value.trim().toLowerCase())
  const key = (e) => {
    if (!open || !shown.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, shown.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter' && hi >= 0) { e.preventDefault(); pick(shown[hi]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div className="field suggest" ref={box}>
      <label htmlFor="eq-name">Equipment name</label>
      <input id="eq-name" className="input" autoComplete="off" value={value} placeholder="Start typing, e.g. lathe, oscilloscope, autoclave"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(-1) }} onFocus={() => setOpen(true)} onKeyDown={key}
        aria-invalid={!!error} aria-expanded={open} aria-autocomplete="list" />
      {error && <p role="alert" className="field-error">{error}</p>}
      {open && value.trim() && (
        <ul className="suggest-list" role="listbox">
          {shown.map((it, i) => (
            <li key={it.id} role="option" aria-selected={i === hi} className={i === hi ? 'on' : ''} onMouseDown={(e) => { e.preventDefault(); pick(it) }}>
              <b>{it.name}</b>
              {it.purpose && <span className="muted">{it.purpose.length > 90 ? `${it.purpose.slice(0, 90)}…` : it.purpose}</span>}
              {it.labs > 0 && <small className="muted">in {it.labs} lab{it.labs > 1 ? 's' : ''} here</small>}
            </li>
          ))}
          {!exact && <li className="new" role="option" onMouseDown={(e) => { e.preventDefault(); setOpen(false) }}>➕ Use “{value.trim()}” as a <b>new</b> equipment name</li>}
        </ul>
      )}
    </div>
  )
}
