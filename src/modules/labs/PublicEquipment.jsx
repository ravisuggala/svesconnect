import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Download, FlaskConical, Search } from 'lucide-react'
import { Badge, Card, EmptyState, Skeleton } from '../../ui'
import { api } from '../../core/api'
import EquipmentSections from './EquipmentSections'
import './labs.css'

const useLoad = (path) => {
  const [s, setS] = useState({ data: null, error: '' })
  useEffect(() => { let on = true; api(path).then((data) => on && setS({ data, error: '' })).catch((e) => on && setS({ data: null, error: e.message })); return () => { on = false } }, [path])
  return s
}
const Page = ({ children, className = '' }) => <div className={`container fade-up ${className}`} style={{ paddingTop: 'var(--s-6)', minHeight: '60vh' }}>{children}</div>
const Back = ({ to, children }) => <Link to={to} className="row no-print" style={{ marginBottom: 'var(--s-3)' }}><ArrowLeft size={14} /> {children}</Link>
const Err = ({ error }) => <EmptyState title="Not available" icon={FlaskConical}>{error}</EmptyState>
const units = (n) => `${n} unit${n === 1 ? '' : 's'}`

/** Public: every published equipment of one college, one card per equipment (all departments and labs together). */
export function CollegeEquipment() {
  const { code } = useParams()
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 250); return () => clearTimeout(t) }, [q])
  const { data, error } = useLoad(`/public/colleges/${code}/equipment?q=${encodeURIComponent(debounced)}&type=${encodeURIComponent(type)}`)
  return (
    <Page>
      <Back to={`/explore/c/${code}`}>{data ? data.college.name : 'Back'}</Back>
      <h1 style={{ fontSize: '2rem' }}>Equipment</h1>
      <p className="muted" style={{ maxWidth: '70ch' }}>Every published equipment of the college, all departments and labs together. Open one to see where it is available and what it is used for.</p>
      <div className="row" style={{ margin: 'var(--s-4) 0', flexWrap: 'wrap' }}>
        <label className="searchbar"><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search equipment, e.g. lathe, oscilloscope" aria-label="Search equipment" /></label>
        {data && data.types.length > 1 && <select className="select" style={{ maxWidth: 280 }} value={type} onChange={(e) => setType(e.target.value)} aria-label="Type of equipment"><option value="">All types</option>{data.types.map((t) => <option key={t}>{t}</option>)}</select>}
        {data && <span className="muted">{data.totals.equipment} equipment · {units(data.totals.units)}</span>}
      </div>
      {error ? <Err error={error} /> : !data ? <div className="grid cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} h={180} />)}</div> : !data.items.length ? <EmptyState title="Nothing to show" icon={FlaskConical}>No published equipment matches. Try a different word.</EmptyState> : (
        <div className="grid cols-3">{data.items.map((e) => (
          <Card hover key={e.slug}>
            {e.photoId ? <img className="thumb" src={`/api/public/files/${e.photoId}`} alt={e.name} loading="lazy" /> : <div className="thumb thumb-empty"><FlaskConical size={32} /></div>}
            <Badge>{e.type}</Badge>
            <h3 style={{ margin: 'var(--s-2) 0' }}>{e.name}</h3>
            {e.purpose && <p className="muted clamp">{e.purpose}</p>}
            <div className="counts"><Badge tone="primary">{units(e.units)}</Badge>{e.working !== null && <Badge tone={e.working === e.units ? 'success' : 'warning'}>{e.working} working</Badge>}<Badge>{e.labs} lab{e.labs === 1 ? '' : 's'}</Badge></div>
            <p className="muted" style={{ fontSize: 13 }}>{e.departments.slice(0, 4).map((d) => `${d.department} ${d.units}`).join(' · ')}{e.departments.length > 4 ? ' · …' : ''}</p>
            <p style={{ marginTop: 'var(--s-3)' }}><Link to={`/explore/c/${code}/equipment/${e.slug}`} className="row">Details <ArrowRight size={14} /></Link></p>
          </Card>))}</div>)}
    </Page>
  )
}

/** Public: one equipment across the whole college: summary, counts per department, and the labs that have it. */
export function CollegeEquipmentDetail() {
  const { code, slug } = useParams()
  const { data, error } = useLoad(`/public/colleges/${code}/equipment/${slug}`)
  const g = data?.equipment
  return (
    <Page>
      <Back to={`/explore/c/${code}/equipment`}>All equipment</Back>
      {error ? <Err error={error} /> : !data ? <Skeleton h={300} /> : (
        <div style={{ maxWidth: 940 }}>
          <div className="row"><Badge tone="primary">{data.college.name}</Badge><Badge>{g.type}</Badge></div>
          <h1 style={{ fontSize: '2rem', margin: 'var(--s-3) 0' }}>{g.name}</h1>
          <div className="eqhead">
            {g.photoId && <img className="thumb" style={{ maxWidth: 320 }} src={`/api/public/files/${g.photoId}`} alt={g.name} />}
            <div>
              <div className="counts"><Badge tone="primary">{units(g.units)} in the college</Badge>{g.working !== null && <Badge tone={g.working === g.units ? 'success' : 'warning'}>{g.working} working</Badge>}<Badge>{g.labCount} lab{g.labCount === 1 ? '' : 's'}</Badge></div>
              <p style={{ fontSize: '1.05rem', maxWidth: '65ch' }}>{data.summary.text}</p>
            </div>
          </div>
          <section className="eq-sec"><h3>Units by department</h3>
            <table className="kv"><tbody>{g.departments.map((d) => <tr key={d.department}><th>{d.department}</th><td>{units(d.units)}</td></tr>)}</tbody></table></section>
          {g.specs.length > 0 && <section className="eq-sec"><h3>Main specifications</h3><ul className="vlist">{g.specs.map((x) => <li key={x}>{x}</li>)}</ul></section>}
          {g.courses.length > 0 && <section className="eq-sec"><h3>Used for</h3><ul className="vlist">{g.courses.map((x) => <li key={x}>{x}</li>)}</ul></section>}
          <section className="eq-sec"><h3>Where it is available</h3>
            <table className="kv"><thead><tr><th>Department</th><th>Lab</th><th>Units</th><th>Make / model</th></tr></thead><tbody>{g.labs.map((l) => (
              <tr key={l.equipmentId}><td>{l.department}</td><td><Link to={`/explore/lab/${l.labId}`}>{l.lab}</Link></td><td>{l.units}</td><td>{l.brand || '–'}</td></tr>))}</tbody></table></section>
        </div>)}
    </Page>
  )
}

/** Public lab record: lab information + every published equipment with its public details and photo. Print or save as PDF. */
export function PublicLabRecord() {
  const { id } = useParams()
  const { data, error } = useLoad(`/public/labs/${id}/record`)
  return (
    <Page className="record">
      <div className="row no-print"><Back to={`/explore/lab/${id}`}>Lab page</Back><span className="spacer" /><button className="btn btn-primary" onClick={() => window.print()}><Download size={16} /> Download PDF / Print</button></div>
      {error ? <Err error={error} /> : !data ? <Skeleton h={300} /> : (
        <>
          <p className="muted no-print">Tip: in the print window choose <b>Save as PDF</b> as the destination.</p>
          <h1 style={{ fontSize: '1.8rem' }}>{data.lab.name}</h1>
          <p className="muted">{data.lab.department} · {data.lab.collegeName}<br />{data.lab.collegeAddress}</p>
          <p>{data.lab.description}</p>
          <p className="muted">{[data.lab.building, data.lab.floor && `Floor ${data.lab.floor}`, data.lab.room && `Room ${data.lab.room}`, data.lab.accessibility].filter(Boolean).join(' · ')}</p>
          <p><b>Lab coordinator:</b> {[data.lab.coordinatorName, data.lab.coordinatorEmail, data.lab.coordinatorPhone].filter(Boolean).join(' · ')}</p>
          {data.equipment.map((e) => (
            <div key={e.id} className="rec-eq">
              <h2 style={{ fontSize: '1.2rem' }}>{e.name} <small className="muted">{e.type}</small></h2>
              <div className="rec-body">
                {e.photoId && <img className="thumb" src={`/api/public/files/${e.photoId}`} alt={e.name} />}
                <div><EquipmentSections sections={e.sections} data={e.data} /></div>
              </div>
            </div>))}
        </>)}
    </Page>
  )
}
