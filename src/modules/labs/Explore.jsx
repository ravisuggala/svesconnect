import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Building2, FileText, FlaskConical } from 'lucide-react'
import { Badge, Card, EmptyState, Skeleton } from '../../ui'
import { api } from '../../core/api'
import EquipmentSections from './EquipmentSections'
import SearchBox from '../search/SearchBox'
import './labs.css'

// Public pages: College > Department > Lab > Equipment. Only approved equipment is ever shown, and each lab has its own page.
const useLoad = (path) => {
  const [s, setS] = useState({ data: null, error: '' })
  useEffect(() => { api(path).then((data) => setS({ data, error: '' })).catch((e) => setS({ data: null, error: e.message })) }, [path])
  return s
}
const Page = ({ children }) => <div className="container fade-up" style={{ paddingTop: 'var(--s-6)', minHeight: '60vh' }}>{children}</div>
const Crumb = ({ to, children }) => <Link to={to} className="row" style={{ marginBottom: 'var(--s-3)' }}><ArrowLeft size={14} /> {children}</Link>
const Err = ({ error }) => <EmptyState title="Not available" icon={FlaskConical}>{error}</EmptyState>
const Loading = () => <div className="grid cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} h={140} />)}</div>

export function ExploreColleges() {
  const { data, error } = useLoad('/public/explore')
  return (
    <Page>
      <h1 style={{ fontSize: '2.2rem' }}>Explore labs & equipment</h1>
      <p className="muted" style={{ maxWidth: '68ch' }}>Browse the laboratories and equipment of every SVES institution. Each lab has its own page, and only verified and approved equipment is published.</p>
      <Card style={{ margin: 'var(--s-4) 0', maxWidth: 820 }}><SearchBox publicOnly /></Card>
      {error ? <Err error={error} /> : !data ? <Loading /> : (
        <div className="grid cols-3" style={{ marginTop: 'var(--s-5)' }}>{data.colleges.map((c) => (
          <Card hover key={c.code}><Building2 className="ico" size={26} style={{ color: 'var(--c-primary)' }} /><h3>{c.name}</h3><p className="muted">{c.city}</p>
            <div className="counts"><Badge tone={c.equipment ? 'success' : ''}>{c.labs} labs</Badge><Badge>{c.equipment} equipment</Badge></div>
            <Link to={`/explore/c/${c.code.toLowerCase()}`} className="row">View <ArrowRight size={14} /></Link></Card>))}</div>)}
    </Page>
  )
}

export function ExploreCollege() {
  const { code } = useParams()
  const { data, error } = useLoad(`/public/colleges/${code}`)
  return (
    <Page>
      <Crumb to="/explore">All institutions</Crumb>
      {error ? <Err error={error} /> : !data ? <Loading /> : (
        <>
          <h1 style={{ fontSize: '2rem' }}>{data.college.name}</h1><p className="muted">{data.college.city}</p>
          {!data.departments.length && <EmptyState title="No published labs yet" icon={FlaskConical}>Equipment appears here after it is verified and approved.</EmptyState>}
          {data.departments.map((d) => (
            <section key={d.department} style={{ marginTop: 'var(--s-5)' }}><h3 style={{ color: 'var(--c-primary)' }}>{d.department} <Link to={`/explore/c/${code}/d/${encodeURIComponent(d.department)}`} style={{ fontSize: 14, fontWeight: 600 }}>Department page →</Link></h3>
              <div className="grid cols-3">{d.labs.map((l) => (
                <Card hover key={l.id}><FlaskConical size={22} style={{ color: 'var(--c-secondary-brand)' }} /><h3>{l.name}</h3>
                  <p className="muted">{l.description || [l.building, l.room].filter(Boolean).join(' · ') || ' '}</p><Badge tone="success">{l.equipment} equipment</Badge>
                  <p style={{ marginTop: 'var(--s-3)' }}><Link to={`/explore/lab/${l.id}`} className="row">Open lab <ArrowRight size={14} /></Link></p></Card>))}</div></section>))}
        </>)}
    </Page>
  )
}

export function ExploreLab() {
  const { id } = useParams()
  const { data, error } = useLoad(`/public/labs/${id}`)
  return (
    <Page>
      {data && <Crumb to={`/explore/c/${data.lab.collegeCode.toLowerCase()}`}>{data.lab.collegeName}</Crumb>}
      {error ? <Err error={error} /> : !data ? <Loading /> : (
        <>
          <Badge tone="primary">{data.lab.department}</Badge><h1 style={{ fontSize: '2rem', marginTop: 'var(--s-2)' }}>{data.lab.name}</h1>
          <p className="muted" style={{ maxWidth: '70ch' }}>{data.lab.description}{[data.lab.building, data.lab.floor && `Floor ${data.lab.floor}`, data.lab.room && `Room ${data.lab.room}`].filter(Boolean).length ? ` · ${[data.lab.building, data.lab.floor && `Floor ${data.lab.floor}`, data.lab.room && `Room ${data.lab.room}`].filter(Boolean).join(', ')}` : ''}{data.lab.accessibility ? ` · Access: ${data.lab.accessibility}` : ''}</p>
          <Card style={{ marginTop: 'var(--s-4)', maxWidth: '60ch' }}>
            <h3 style={{ fontSize: '1rem' }}>Lab coordinator</h3>
            <p style={{ margin: 'var(--s-2) 0 0' }}><b>{data.lab.coordinatorName || '—'}</b></p>
            {data.lab.coordinatorEmail && <p className="muted" style={{ margin: 0 }}>Email: <a href={`mailto:${data.lab.coordinatorEmail}`}>{data.lab.coordinatorEmail}</a></p>}
            {data.lab.coordinatorPhone && <p className="muted" style={{ margin: 0 }}>Mobile: <a href={`tel:${data.lab.coordinatorPhone}`}>{data.lab.coordinatorPhone}</a></p>}
            <p className="muted" style={{ margin: 0 }}>{data.lab.department} · {data.lab.collegeAddress}</p>
          </Card>
          <div className="grid cols-3" style={{ marginTop: 'var(--s-5)' }}>{data.equipment.map((e) => (
            <Card hover key={e.id}>
              {e.photoId ? <img className="thumb" src={`/api/public/files/${e.photoId}`} alt={e.name} loading="lazy" /> : <div className="thumb thumb-empty"><FlaskConical size={32} /></div>}
              <h3>{e.name}</h3><p className="muted">{[e.manufacturer, e.model].filter(Boolean).join(' ') || e.type}</p>
              {e.status && <Badge tone={e.status === 'Working' ? 'success' : 'warning'}>{e.status}</Badge>}
              <p style={{ marginTop: 'var(--s-3)' }}><Link to={`/explore/equipment/${e.id}`} className="row">Details <ArrowRight size={14} /></Link></p></Card>))}</div>
        </>)}
    </Page>
  )
}

export function ExploreEquipment() {
  const { id } = useParams()
  const { data, error } = useLoad(`/public/equipment/${id}`)
  return (
    <Page>
      {data && <Crumb to={`/explore/lab/${data.lab.id}`}>{data.lab.name}</Crumb>}
      {error ? <Err error={error} /> : !data ? <Loading /> : (
        <div style={{ maxWidth: 900 }}>
          <div className="row"><Badge tone="primary">{data.college.name}</Badge><Badge>{data.lab.department}</Badge><Badge>{data.lab.name}</Badge></div>
          <h1 style={{ fontSize: '2rem', margin: 'var(--s-3) 0 0' }}>{data.equipment.name}</h1><p className="muted">{data.equipment.type}</p>
          {data.files.filter((f) => f.kind === 'photos').length > 0 && <div className="gallery">{data.files.filter((f) => f.kind === 'photos').map((f) => <img key={f.id} className="thumb" src={`/api/public/files/${f.id}`} alt={f.name} loading="lazy" />)}</div>}
          <EquipmentSections sections={data.sections} data={data.equipment.data} />
          {data.files.filter((f) => f.kind !== 'photos').length > 0 && (
            <section className="eq-sec"><h3>Downloads</h3>{data.files.filter((f) => f.kind !== 'photos').map((f) => <div key={f.id}><FileText size={14} /> <a href={`/api/public/files/${f.id}`} target="_blank" rel="noopener noreferrer">{f.name}</a> <span className="muted">({data.fileKinds.find((k) => k.key === f.kind)?.label})</span></div>)}</section>)}
        </div>)}
    </Page>
  )
}

export function ExploreDepartment() {
  const { code, dept } = useParams()
  const { data, error } = useLoad(`/public/colleges/${code}/departments/${encodeURIComponent(dept)}`)
  return (
    <Page>
      <Crumb to={`/explore/c/${code}`}>{data ? data.college.name : 'Back'}</Crumb>
      {error ? <Err error={error} /> : !data ? <Loading /> : (
        <>
          <Badge tone="primary">{data.college.name}</Badge>
          <h1 style={{ fontSize: '2rem', marginTop: 'var(--s-2)' }}>{data.department} department</h1>
          <div className="counts"><Badge tone="success">{data.stats.labs} labs</Badge><Badge>{data.stats.equipment} equipment</Badge>{data.stats.working > 0 && <Badge tone="success">{data.stats.working} working</Badge>}</div>
          {data.labs.map((l) => (
            <section key={l.id} style={{ marginTop: 'var(--s-6)' }}>
              <div className="row"><FlaskConical size={22} style={{ color: 'var(--c-secondary-brand)' }} /><h2 style={{ fontSize: '1.4rem', margin: 0 }}>{l.name}</h2><span className="spacer" /><Link to={`/explore/lab/${l.id}`} className="row">Lab page <ArrowRight size={14} /></Link></div>
              <p className="muted">{l.description}{[l.building, l.floor && `Floor ${l.floor}`, l.room && `Room ${l.room}`].filter(Boolean).length ? ` · ${[l.building, l.floor && `Floor ${l.floor}`, l.room && `Room ${l.room}`].filter(Boolean).join(', ')}` : ''}</p>
              <div className="grid cols-3">{l.equipment.map((e) => (
                <Card hover key={e.id}>
                  {e.photoId ? <img className="thumb" src={`/api/public/files/${e.photoId}`} alt={e.name} loading="lazy" /> : <div className="thumb thumb-empty"><FlaskConical size={32} /></div>}
                  <h3>{e.name}</h3><p className="muted">{[e.manufacturer, e.model].filter(Boolean).join(' ') || e.type}</p>
                  {e.status && <Badge tone={e.status === 'Working' ? 'success' : 'warning'}>{e.status}</Badge>}
                  <p style={{ marginTop: 'var(--s-3)' }}><Link to={`/explore/equipment/${e.id}`} className="row">Details <ArrowRight size={14} /></Link></p></Card>))}</div>
            </section>))}
        </>)}
    </Page>
  )
}
