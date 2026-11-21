import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, FlaskConical, Search } from 'lucide-react'
import { Badge, EmptyState, Skeleton } from '../../ui'
import { api } from '../../core/api'
import { STATUS } from './spec'
import './labs.css'

const rupees = (v) => (v ? `₹ ${Number(v).toLocaleString('en-IN')}` : '–')
const Head = ({ college, title, children }) => (
  <div className="no-print">
    <div className="row"><Link to={`/c/${college}/lab-details`} className="row"><ArrowLeft size={14} /> Labs & equipment</Link><span className="spacer" /><button className="btn btn-primary" onClick={() => window.print()}><Download size={16} /> Download PDF / Print</button></div>
    <h2 style={{ marginTop: 'var(--s-3)' }}>{title}</h2>{children}
  </div>
)

/** Lab configuration report: every lab with its details and equipment list. Internal (includes cost). */
export function LabsReport() {
  const { college } = useParams()
  const [dept, setDept] = useState('')
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api(`/c/${college}/report/labs?department=${encodeURIComponent(dept)}`).then(setD).catch((e) => setError(e.message)) }, [college, dept])
  return (
    <div className="fade-up record">
      <Head college={college} title="Lab configuration report">
        <p className="muted">All labs with their details and equipment. This copy includes cost and is for college records only. In the print window choose <b>Save as PDF</b>.</p>
        {d && d.departments.length > 1 && <select className="select" style={{ maxWidth: 280 }} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department"><option value="">All departments</option>{d.departments.map((x) => <option key={x}>{x}</option>)}</select>}
      </Head>
      {error ? <EmptyState title="Not available" icon={FlaskConical}>{error}</EmptyState> : !d ? <Skeleton h={300} /> : (
        <>
          <h1 className="only-print" style={{ fontSize: '1.6rem' }}>Lab configuration report · {d.college.name}{dept ? ` · ${dept}` : ''}</h1>
          {d.labs.map((l) => (
            <section key={l.id} className="rec-eq">
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>{l.name} <small className="muted">{l.department}</small></h2>
              <p className="muted" style={{ margin: '4px 0' }}>{[l.building, l.floor && `Floor ${l.floor}`, l.room && `Room ${l.room}`, l.accessibility].filter(Boolean).join(' · ') || 'Location not set'}{l.coordinator ? ` · In-charge: ${l.coordinator} (${l.coordinatorEmail})` : ''}</p>
              {l.description && <p>{l.description}</p>}
              {!l.equipment.length ? <p className="muted">No equipment added yet.</p> : (
                <table className="kv rt"><thead><tr><th>Equipment</th><th>Type</th><th>Units</th><th>Working</th><th>Make / model</th><th>Year</th><th>Cost</th><th>Status</th></tr></thead>
                  <tbody>{l.equipment.map((e) => <tr key={e.id}><td>{e.name}</td><td>{e.type}</td><td>{e.quantity}</td><td>{e.working ?? '–'}</td><td>{e.brand || '–'}</td><td>{e.year || '–'}</td><td>{rupees(e.cost)}</td><td>{e.published && e.status !== 'approved' ? 'Published, edit pending' : STATUS[e.status]?.label}</td></tr>)}</tbody></table>)}
            </section>))}
        </>)}
    </div>
  )
}

/** Equipment-wise report: pick an equipment or type (e.g. "Server") and see every one in the college, where it is and its details. */
export function EquipmentReport() {
  const { college } = useParams()
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const t = setTimeout(() => { api(`/c/${college}/report/equipment?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}`).then(setD).catch((e) => setError(e.message)) }, 250)
    return () => clearTimeout(t)
  }, [college, q, type])
  return (
    <div className="fade-up record">
      <Head college={college} title="Equipment-wise report">
        <p className="muted">Search an equipment or choose a type, for example “server”, to see every one in your college or department with its lab, location and details. Includes cost; for college records only.</p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <label className="searchbar"><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type an equipment name, e.g. server" aria-label="Search" /></label>
          {d && d.types.length > 1 && <select className="select" style={{ maxWidth: 300 }} value={type} onChange={(e) => setType(e.target.value)} aria-label="Type"><option value="">All types</option>{d.types.map((t) => <option key={t}>{t}</option>)}</select>}
        </div>
      </Head>
      {error ? <EmptyState title="Not available" icon={FlaskConical}>{error}</EmptyState> : !d ? <Skeleton h={300} /> : !d.groups.length ? <EmptyState title="Nothing found" icon={FlaskConical}>No equipment matches.</EmptyState> : (
        <>
          <h1 className="only-print" style={{ fontSize: '1.6rem' }}>Equipment report · {d.college.name}{q ? ` · “${q}”` : ''}{type ? ` · ${type}` : ''}</h1>
          {d.groups.map((g) => (
            <section key={g.name} className="rec-eq">
              <div className="row" style={{ flexWrap: 'wrap' }}><h2 style={{ fontSize: '1.2rem', margin: 0 }}>{g.name}</h2><small className="muted">{g.type}</small>
                <Badge tone="primary">{g.units} unit{g.units === 1 ? '' : 's'}</Badge>{g.working !== null && <Badge tone="success">{g.working} working</Badge>}<Badge>{g.rows.length} lab{g.rows.length === 1 ? '' : 's'}</Badge>{g.cost > 0 && <Badge>{rupees(g.cost)}</Badge>}</div>
              <table className="kv rt"><thead><tr><th>Department</th><th>Lab</th><th>Location</th><th>Units</th><th>Working</th><th>Make / model</th><th>Year</th><th>Cost</th></tr></thead>
                <tbody>{g.rows.map((r) => <tr key={r.id}><td>{r.department}</td><td>{r.lab}</td><td>{r.location || '–'}</td><td>{r.quantity}</td><td>{r.working ?? '–'}</td><td>{r.brand || '–'}</td><td>{r.year || '–'}</td><td>{rupees(r.cost)}</td></tr>)}</tbody></table>
            </section>))}
        </>)}
    </div>
  )
}
