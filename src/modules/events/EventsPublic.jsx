import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Download, FileText, FolderOpen, ImageIcon, MapPin } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Skeleton } from '../../ui'
import { api } from '../../core/api'
import './events.css'

// Public pages (no sign-in): all published events grouped by college, and one page per event with an auto-made summary.
const useLoad = (path) => {
  const [s, setS] = useState({ data: null, error: '' })
  useEffect(() => { api(path).then((data) => setS({ data, error: '' })).catch((e) => setS({ data: null, error: e.message })) }, [path])
  return s
}
const Page = ({ children }) => <div className="container fade-up" style={{ paddingTop: 'var(--s-6)', minHeight: '60vh' }}>{children}</div>
const Loading = () => <div className="grid cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} h={180} />)}</div>
const size = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

export function EventsHome() {
  const { data, error } = useLoad('/public/events')
  const [pick, setPick] = useState('')
  const colleges = (data?.colleges || []).filter((c) => c.events.length)
  const shown = pick ? colleges.filter((c) => c.code === pick) : colleges
  return (
    <Page>
      <div className="ev-hero">
        <h1 style={{ fontSize: '2.2rem' }}>Events, projects & achievements</h1>
        <p className="muted" style={{ maxWidth: '68ch', margin: 0 }}>What the institutions of Sri Vishnu Educational Society have done: competitions such as BAJA, workshops, fests, consultancy and academic projects. Each page is summarised from the event&apos;s own reports and records.</p>
      </div>
      {error ? <EmptyState title="Not available" icon={CalendarDays}>{error}</EmptyState> : !data ? <Loading /> : !colleges.length ? (
        <EmptyState title="No events published yet" icon={CalendarDays}>Events appear here after the HOD publishes them.</EmptyState>
      ) : (
        <>
          <div className="ev-chips"><button className={`chip ${!pick ? 'on' : ''}`} onClick={() => setPick('')}>All colleges</button>
            {colleges.map((c) => <button key={c.code} className={`chip ${pick === c.code ? 'on' : ''}`} onClick={() => setPick(c.code)}>{c.code} · {c.events.length}</button>)}</div>
          {shown.map((c) => (
            <section key={c.code} style={{ marginBottom: 'var(--s-6)' }}>
              <h2 style={{ fontSize: '1.4rem', color: 'var(--c-primary)' }}>{c.name}</h2><p className="muted" style={{ marginTop: 0 }}>{c.address || c.city}</p>
              <div className="grid cols-3">{c.events.map((e) => (
                <Card hover key={e.id} className="ev-card">
                  {e.cover ? <img className="thumb" src={`/api/public/event-files/${e.cover}`} alt={e.name} loading="lazy" /> : <div className="thumb thumb-empty"><CalendarDays size={32} /></div>}
                  <div className="counts"><Badge tone="primary">{e.type}</Badge>{e.academicYear && <Badge>{e.academicYear}</Badge>}</div>
                  <h3>{e.name}</h3>
                  <p className="muted" style={{ margin: 0, fontSize: 14 }}>{[e.eventDate, e.venue].filter(Boolean).join(' · ')}</p>
                  {e.short && <p style={{ fontSize: 14 }}>{e.short}{e.short.length >= 220 ? '…' : ''}</p>}
                  <Link to={`/events/${e.id}`} className="row">Open event · {e.files} files</Link>
                </Card>))}</div>
            </section>))}
        </>
      )}
    </Page>
  )
}

export function EventPublic() {
  const { id } = useParams()
  const { data, error } = useLoad(`/public/events/${id}`)
  const [folder, setFolder] = useState('')
  const folders = data ? [...new Set(data.files.map((f) => f.folder))] : []
  const current = folder && folders.includes(folder) ? folder : ''
  const files = data ? data.files.filter((f) => !current || f.folder === current) : []
  const photos = files.filter((f) => f.mime?.startsWith('image/'))
  const rest = files.filter((f) => !f.mime?.startsWith('image/'))
  return (
    <Page>
      <Link to="/events" className="row" style={{ marginBottom: 'var(--s-3)' }}><ArrowLeft size={14} /> All events</Link>
      {error ? <EmptyState title="Not available" icon={CalendarDays}>{error}</EmptyState> : !data ? <Loading /> : (
        <>
          <div className="counts"><Badge tone="primary">{data.event.type}</Badge><Badge>{data.college.code}</Badge>{data.event.academicYear && <Badge>{data.event.academicYear}</Badge>}</div>
          <h1 style={{ fontSize: '2rem' }}>{data.event.name}</h1>
          <p className="muted row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <span>{data.college.name}</span>{data.event.eventDate && <span className="row"><CalendarDays size={14} /> {data.event.eventDate}</span>}{data.event.venue && <span className="row"><MapPin size={14} /> {data.event.venue}</span>}
          </p>
          <Card style={{ marginTop: 'var(--s-4)' }}><h3>About this event</h3><p style={{ maxWidth: '78ch' }}>{data.summary.overview}</p>
            {data.summary.credits.length > 0 && <p className="muted" style={{ marginBottom: 0 }}>Contributors: {data.summary.credits.join(', ')}</p>}</Card>
          <div className="ev-stats">
            <div className="ev-stat"><b>{data.summary.stats.files}</b>published files</div><div className="ev-stat"><b>{data.summary.stats.photos}</b>photos</div>
            <div className="ev-stat"><b>{data.summary.stats.folders}</b>folders</div><div className="ev-stat"><b>{data.summary.stats.contributors}</b>contributors</div>
          </div>
          {data.summary.highlights.length > 0 && (
            <section style={{ margin: 'var(--s-5) 0' }}><h3>Highlights from the documents</h3>
              {data.summary.highlights.map((h) => <div className="ev-hl" key={h.fileId}><div>{h.text}</div><small>{h.folder} · {h.source}</small></div>)}</section>)}

          <h3 style={{ marginTop: 'var(--s-5)' }}>Files by folder</h3>
          {!data.files.length ? <EmptyState title="No public files yet" icon={FolderOpen}>The team has not published files for this event.</EmptyState> : (
            <div className="ev-split">
              <nav className="ev-tree" aria-label="Folders">
                <button className={!current ? 'on' : ''} onClick={() => setFolder('')}><span>All files</span><small>{data.files.length}</small></button>
                {folders.map((f) => <button key={f} className={current === f ? 'on' : ''} onClick={() => setFolder(f)}><span>{f}</span><small>{data.files.filter((x) => x.folder === f).length}</small></button>)}
              </nav>
              <div>
                {photos.length > 0 && <div className="gallery" style={{ marginTop: 0 }}>{photos.map((p) => (
                  <a key={p.id} href={`/api/public/event-files/${p.id}`} target="_blank" rel="noreferrer"><img className="thumb" src={`/api/public/event-files/${p.id}`} alt={p.title} loading="lazy" /><small>{p.title}</small></a>))}</div>}
                {rest.map((f) => (
                  <div className="ev-file" key={f.id}><FileText size={22} style={{ color: 'var(--c-primary)', flexShrink: 0 }} />
                    <div className="body"><h4>{f.title}</h4>
                      <p className="muted">{[f.folder, f.subfolder, f.contributor && `Credit: ${f.contributor}`, f.fileDate, size(f.size)].filter(Boolean).join(' · ')}</p>
                      {f.description && <p>{f.description}</p>}</div>
                    <Button as="a" variant="ghost" size="sm" href={`/api/public/event-files/${f.id}?download=1`}><Download size={14} /> Download</Button></div>))}
                {!files.length && <EmptyState title="Nothing in this folder" icon={ImageIcon}>Choose another folder.</EmptyState>}
              </div>
            </div>)}
        </>)}
    </Page>
  )
}
