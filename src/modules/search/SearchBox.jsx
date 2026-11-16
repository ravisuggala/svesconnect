import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FlaskConical, Layers, Search, Wrench } from 'lucide-react'
import { Badge, Button, EmptyState, Loader } from '../../ui'
import { api } from '../../core/api'

const KIND = { equipment: { label: 'Equipment', icon: Wrench }, lab: { label: 'Lab', icon: FlaskConical }, department: { label: 'Department', icon: Layers } }

/** AI search over labs and equipment. `publicOnly` forces published records; otherwise the server scopes it to the signed-in person. */
export default function SearchBox({ publicOnly = false, placeholder = 'Search equipment, labs or departments… e.g. “3D printer” or “PCB lab”' }) {
  const [q, setQ] = useState('')
  const [state, setState] = useState(null) // { results, scope, searchMode, query }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (ev) => {
    ev.preventDefault()
    if (q.trim().length < 2) return
    setBusy(true); setError('')
    try { setState(await api(`/search?q=${encodeURIComponent(q.trim())}${publicOnly ? '&scope=public' : ''}`)) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div>
      <form onSubmit={run} className="row" style={{ flexWrap: 'nowrap' }} role="search">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label="Search" style={{ flex: 1 }} />
        <Button type="submit" disabled={busy || q.trim().length < 2}><Search size={16} /> Search</Button>
      </form>
      {error && <p role="alert" style={{ color: 'var(--c-error)' }}>{error}</p>}
      {busy && <div style={{ padding: 'var(--s-4)' }}><Loader label="Searching…" /></div>}
      {state && !busy && (
        <div style={{ marginTop: 'var(--s-4)' }}>
          <p className="muted" style={{ fontSize: 13 }}>Searching: <b>{state.scope.label}</b> · {state.searchMode === 'semantic' ? 'AI semantic search' : 'keyword search'}</p>
          {!state.results.length && <EmptyState title="No matches">Try different words, or a broader term such as the equipment type.</EmptyState>}
          <div className="grid">
            {state.results.map((r) => {
              const K = KIND[r.kind]
              return (
                <Link key={`${r.kind}-${r.id}`} to={r.url} className="card hover" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  <div className="row"><K.icon size={18} color="var(--c-primary)" /><b>{r.title}</b><Badge tone="primary">{K.label}</Badge>{r.status === 'submitted' && <Badge tone="warning">Awaiting HOD</Badge>}</div>
                  <div className="muted" style={{ fontSize: 13, margin: '4px 0' }}>{r.subtitle}</div>
                  {r.snippet && <div style={{ fontSize: 14 }}>{r.snippet}</div>}
                </Link>)
            })}
          </div>
        </div>)}
    </div>
  )
}
