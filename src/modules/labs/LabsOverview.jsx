import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ExternalLink, FlaskConical, LayoutGrid, List } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Skeleton, Table, useToast } from '../../ui'
import { useAuth } from '../../core/auth'
import { api } from '../../core/api'
import SearchBox from '../search/SearchBox'

const Counts = ({ l }) => (
  <div className="counts"><Badge tone="success">{l.approved} published</Badge>{l.submitted > 0 && <Badge tone="warning">{l.submitted} awaiting HOD</Badge>}{l.rejected > 0 && <Badge tone="error">{l.rejected} sent back</Badge>}{l.draft > 0 && <Badge>{l.draft} draft{l.draft > 1 ? 's' : ''}</Badge>}</div>
)
const Stat = ({ label, value }) => <Card style={{ padding: 'var(--s-4)' }}><div className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div><div style={{ font: '800 1.8rem var(--f-head)', color: 'var(--c-primary)' }}>{value}</div></Card>

/** HOD / Principal / Admin: common information + every lab, department-wise or lab-wise, with links to the published pages and AI search. */
export default function LabsOverview() {
  const { college } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const [params] = useSearchParams()
  const [labs, setLabs] = useState(null)
  const [overview, setOverview] = useState(null)
  const [view, setView] = useState('dept')
  const [dept, setDept] = useState(params.get('dept') || '')
  const [q, setQ] = useState('')
  useEffect(() => {
    api(`/c/${college}/labs`).then((r) => setLabs(r.labs)).catch((e) => toast(e.message, 'error'))
    api(`/c/${college}/overview`).then(setOverview).catch(() => {})
  }, [college, toast])

  const departments = useMemo(() => [...new Set((labs || []).map((l) => l.department))], [labs])
  const shown = useMemo(() => (labs || []).filter((l) => (!dept || l.department === dept) && (!q || `${l.name} ${l.department} ${l.coordinator || ''}`.toLowerCase().includes(q.toLowerCase()))), [labs, dept, q])
  const byDept = shown.reduce((m, l) => ((m[l.department] ||= []).push(l), m), {})
  const isHod = user.role === 'hod'
  const pubDept = (d) => `/explore/c/${college}/d/${encodeURIComponent(d)}`
  const ov = overview?.totals

  const columns = [
    { key: 'department', label: 'Department' },
    { key: 'name', label: 'Lab', render: (l) => <b>{l.name}</b> },
    { key: 'coordinator', label: 'Coordinator', render: (l) => (l.coordinator ? <>{l.coordinator}<br /><span className="muted" style={{ fontSize: 12 }}>{l.coordinatorEmail}</span></> : '') },
    { key: 'loc', label: 'Location', render: (l) => [l.building, l.room].filter(Boolean).join(' · ') || '—' },
    { key: 'counts', label: 'Equipment', render: (l) => <Counts l={l} /> },
    { key: 'go', label: '', render: (l) => <span className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><Link to={`/c/${college}/lab-details/${l.id}`}>Open</Link>{l.approved > 0 && <Link to={`/explore/lab/${l.id}`} title="Published page"><ExternalLink size={14} /></Link>}</span> },
  ]

  return (
    <div className="fade-up">
      <h2>Labs & equipment</h2>
      <p className="muted">{isHod ? <>Your department&apos;s labs. Records awaiting <b>your approval</b> are highlighted.</> : 'Every lab of the college, department-wise or lab-wise. Open a lab for all its equipment and full details.'}</p>

      {ov && (
        <section style={{ margin: 'var(--s-4) 0' }}>
          <div className="grid cols-4">
            <Stat label="Departments" value={ov.departments} /><Stat label="Labs" value={ov.labs} /><Stat label="Published equipment" value={ov.published} /><Stat label="Awaiting HOD" value={ov.awaiting} />
            <Stat label="Working" value={ov.working} /><Stat label="Not working" value={ov.notWorking} /><Stat label="Investment (₹ lakhs)" value={ov.investmentLakhs} />
          </div>
          {overview.departments.length > 0 && (
            <div style={{ marginTop: 'var(--s-4)' }}>
              <Table pageSize={10} rows={overview.departments.map((d) => ({ ...d, id: d.department }))} columns={[
                { key: 'department', label: 'Department', render: (d) => <b>{d.department}</b> },
                { key: 'labs', label: 'Labs' }, { key: 'published', label: 'Published' }, { key: 'awaiting', label: 'Awaiting HOD' },
                { key: 'working', label: 'Working' }, { key: 'notWorking', label: 'Not working' }, { key: 'highValue', label: 'High-value' }, { key: 'investmentLakhs', label: '₹ lakhs' },
                { key: 'pub', label: '', render: (d) => d.published > 0 && <Link to={pubDept(d.department)} className="row"><ExternalLink size={14} /> Public page</Link> },
              ]} />
            </div>)}
          {overview.types.length > 0 && <div className="counts" style={{ marginTop: 'var(--s-3)' }}>{overview.types.slice(0, 8).map((t) => <Badge key={t.label} tone="primary">{t.label}: {t.count}</Badge>)}</div>}
        </section>)}

      <Card style={{ margin: 'var(--s-4) 0' }}>
        <h3 style={{ marginBottom: 'var(--s-3)' }}>AI search in your {user.role === 'hod' ? 'department' : 'college'}</h3>
        <SearchBox placeholder="Ask about any lab or equipment… e.g. “which labs have oscilloscopes?”" />
      </Card>

      {labs && labs.length > 0 && (
        <div className="row" style={{ margin: 'var(--s-4) 0' }}>
          <Button variant={view === 'dept' ? 'primary' : 'ghost'} size="sm" onClick={() => setView('dept')}><LayoutGrid size={14} /> Department-wise</Button>
          <Button variant={view === 'labs' ? 'primary' : 'ghost'} size="sm" onClick={() => setView('labs')}><List size={14} /> Lab-wise</Button>
          {departments.length > 1 && <select className="select" style={{ width: 'auto', minHeight: 34 }} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department"><option value="">All departments</option>{departments.map((d) => <option key={d}>{d}</option>)}</select>}
          <input className="input" style={{ width: 220, minHeight: 34 }} placeholder="Filter labs / coordinators" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter" />
        </div>)}
      {!labs && <div className="grid cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} h={120} />)}</div>}
      {labs && !labs.length && <EmptyState title="No labs yet" icon={FlaskConical}>Labs appear here when lab coordinators are created.</EmptyState>}
      {labs && labs.length > 0 && !shown.length && <EmptyState title="No labs match" icon={FlaskConical}>Try another department or filter.</EmptyState>}
      {view === 'labs' && shown.length > 0 && <Table columns={columns} rows={shown} pageSize={15} />}
      {view === 'dept' && Object.keys(byDept).map((d) => (
        <section key={d} style={{ marginTop: 'var(--s-5)' }}>
          <h3 style={{ color: 'var(--c-primary)' }}>{d} <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}>· {byDept[d].length} labs</span>
            {byDept[d].some((l) => l.approved > 0) && <Link to={pubDept(d)} style={{ fontSize: 14, fontWeight: 600, marginLeft: 12 }}>Department page <ExternalLink size={12} /></Link>}</h3>
          <div className="grid cols-3">{byDept[d].map((l) => (
            <Card hover key={l.id} className="labcard" style={isHod && l.submitted ? { borderColor: 'var(--c-secondary)' } : undefined}>
              <h3>{l.name}</h3><span className="muted">{[l.building, l.room].filter(Boolean).join(' · ') || 'Location not set'}</span>
              {l.coordinator && <div className="muted" style={{ fontSize: 13 }}>Coordinator: {l.coordinator}</div>}
              <Counts l={l} />
              {isHod && l.submitted > 0 && <p style={{ color: 'var(--c-secondary)', fontWeight: 700 }}>{l.submitted} waiting for your approval</p>}
              <span className="row" style={{ gap: 14 }}><Link to={`/c/${college}/lab-details/${l.id}`}>Open lab</Link>{l.approved > 0 && <Link to={`/explore/lab/${l.id}`} className="row"><ExternalLink size={13} /> Published page</Link>}</span>
            </Card>))}</div>
        </section>))}
    </div>
  )
}
