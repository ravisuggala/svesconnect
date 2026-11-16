import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FlaskConical, LayoutGrid, List } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Skeleton, Table, useToast } from '../../ui'
import { useAuth } from '../../core/auth'
import { api } from '../../core/api'

const Counts = ({ l }) => (
  <div className="counts"><Badge tone="success">{l.approved} published</Badge>{l.submitted > 0 && <Badge tone="warning">{l.submitted} awaiting HOD</Badge>}{l.rejected > 0 && <Badge tone="error">{l.rejected} sent back</Badge>}{l.draft > 0 && <Badge>{l.draft} draft{l.draft > 1 ? 's' : ''}</Badge>}</div>
)

/** HOD / Principal / Admin: every lab of the college, organised department-wise or lab-wise. Labs are never merged together. */
export default function LabsOverview() {
  const { college } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const [labs, setLabs] = useState(null)
  const [view, setView] = useState('dept')
  const [dept, setDept] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => { api(`/c/${college}/labs`).then((r) => setLabs(r.labs)).catch((e) => toast(e.message, 'error')) }, [college, toast])

  const departments = useMemo(() => [...new Set((labs || []).map((l) => l.department))], [labs])
  const shown = useMemo(() => (labs || []).filter((l) => (!dept || l.department === dept) && (!q || `${l.name} ${l.department} ${l.coordinator || ''}`.toLowerCase().includes(q.toLowerCase()))), [labs, dept, q])
  const byDept = shown.reduce((m, l) => ((m[l.department] ||= []).push(l), m), {})
  const totals = shown.reduce((t, l) => ({ labs: t.labs + 1, approved: t.approved + l.approved, submitted: t.submitted + l.submitted }), { labs: 0, approved: 0, submitted: 0 })
  const isHod = user.role === 'hod'

  const columns = [
    { key: 'department', label: 'Department' },
    { key: 'name', label: 'Lab', render: (l) => <b>{l.name}</b> },
    { key: 'coordinator', label: 'Coordinator', render: (l) => (l.coordinator ? <>{l.coordinator}<br /><span className="muted" style={{ fontSize: 12 }}>{l.coordinatorEmail}</span></> : '') },
    { key: 'loc', label: 'Location', render: (l) => [l.building, l.room].filter(Boolean).join(' · ') || '—' },
    { key: 'counts', label: 'Equipment', render: (l) => <Counts l={l} /> },
    { key: 'go', label: '', render: (l) => <Link to={`/c/${college}/lab-details/${l.id}`}>Open</Link> },
  ]

  return (
    <div className="fade-up">
      <h2>Labs & equipment</h2>
      <p className="muted">{isHod ? <>Your department&apos;s labs. Records awaiting <b>your approval</b> are highlighted.</> : 'Every lab of the college, department-wise or lab-wise. Open a lab to see all its equipment and full details.'}</p>
      {labs && labs.length > 0 && (
        <div className="row" style={{ margin: 'var(--s-4) 0' }}>
          <Button variant={view === 'dept' ? 'primary' : 'ghost'} size="sm" onClick={() => setView('dept')}><LayoutGrid size={14} /> Department-wise</Button>
          <Button variant={view === 'labs' ? 'primary' : 'ghost'} size="sm" onClick={() => setView('labs')}><List size={14} /> Lab-wise</Button>
          {departments.length > 1 && <select className="select" style={{ width: 'auto', minHeight: 34 }} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department"><option value="">All departments</option>{departments.map((d) => <option key={d}>{d}</option>)}</select>}
          <input className="input" style={{ width: 220, minHeight: 34 }} placeholder="Search lab or coordinator" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
          <span className="spacer" /><span className="muted">{totals.labs} labs · {totals.approved} published{totals.submitted ? ` · ${totals.submitted} awaiting HOD` : ''}</span>
        </div>)}
      {!labs && <div className="grid cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} h={120} />)}</div>}
      {labs && !labs.length && <EmptyState title="No labs yet" icon={FlaskConical}>Labs appear here when lab coordinators are created.</EmptyState>}
      {labs && labs.length > 0 && !shown.length && <EmptyState title="No labs match" icon={FlaskConical}>Try another department or search.</EmptyState>}
      {view === 'labs' && shown.length > 0 && <Table columns={columns} rows={shown} pageSize={15} />}
      {view === 'dept' && Object.keys(byDept).map((d) => (
        <section key={d} style={{ marginTop: 'var(--s-5)' }}>
          <h3 style={{ color: 'var(--c-primary)' }}>{d} <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}>· {byDept[d].length} labs</span></h3>
          <div className="grid cols-3">{byDept[d].map((l) => (
            <Card hover key={l.id} className="labcard" style={isHod && l.submitted ? { borderColor: 'var(--c-secondary)' } : undefined}>
              <h3>{l.name}</h3><span className="muted">{[l.building, l.room].filter(Boolean).join(' · ') || 'Location not set'}</span>
              {l.coordinator && <div className="muted" style={{ fontSize: 13 }}>Coordinator: {l.coordinator}</div>}
              <Counts l={l} />
              {isHod && l.submitted > 0 && <p style={{ color: 'var(--c-secondary)', fontWeight: 700 }}>{l.submitted} waiting for your approval</p>}
              <Link to={`/c/${college}/lab-details/${l.id}`}>Open lab</Link>
            </Card>))}</div>
        </section>))}
    </div>
  )
}
