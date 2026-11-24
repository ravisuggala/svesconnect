import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, FlaskConical } from 'lucide-react'
import { Badge, EmptyState, Skeleton, useToast } from '../../ui'
import { api, getToken } from '../../core/api'
import EquipmentSections from './EquipmentSections'
import { STATUS } from './spec'
import './labs.css'

// Photos need the sign-in token, so they are fetched as blobs.
function Photo({ college, file, alt }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let url = ''
    fetch(`/api/c/${college}/files/${file.id}`, { headers: { Authorization: `Bearer ${getToken()}` } }).then((r) => (r.ok ? r.blob() : null)).then((b) => { if (b) { url = URL.createObjectURL(b); setSrc(url) } }).catch(() => {})
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [college, file.id])
  return src ? <img className="thumb" src={src} alt={alt} /> : null
}

/** Internal lab record (everything entered, including purchase and service details) for the in-charge, HOD, Principal and administrator. Print or save as PDF. */
export default function LabRecord() {
  const { college, labId } = useParams()
  const toast = useToast()
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let on = true
    const load = labId ? Promise.resolve(labId) : api(`/c/${college}/labs`).then((r) => r.labs[0]?.id)
    load.then((id) => (id ? api(`/c/${college}/labs/${id}/record`) : Promise.reject(new Error('No lab is linked to your account.')))).then((d) => on && setData(d)).catch((e) => { if (on) { setError(e.message); toast(e.message, 'error') } })
    return () => { on = false }
  }, [college, labId, toast])
  return (
    <div className="fade-up record">
      <div className="row no-print"><button className="btn btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={14} /> Back</button><span className="spacer" /><button className="btn btn-primary" onClick={() => window.print()} disabled={!data}><Download size={16} /> Download PDF / Print</button></div>
      {error ? <EmptyState title="Not available" icon={FlaskConical}>{error}</EmptyState> : !data ? <Skeleton h={300} /> : (
        <>
          <p className="muted no-print">This copy includes everything entered for this lab, including purchase and service details, for your records. In the print window choose <b>Save as PDF</b>. The public version is on the public lab page.</p>
          <h1 style={{ fontSize: '1.8rem' }}>{data.lab.name}</h1>
          <p className="muted">{data.lab.department} · {data.college.name}<br />{data.college.address}</p>
          <p>{data.lab.description}</p>
          <p className="muted">{[data.lab.building, data.lab.floor && `Floor ${data.lab.floor}`, data.lab.room && `Room ${data.lab.room}`].filter(Boolean).join(' · ')}</p>
          {!data.equipment.length && <p>No equipment has been added yet.</p>}
          {data.equipment.map((e) => (
            <div key={e.id} className="rec-eq">
              <h2 style={{ fontSize: '1.2rem' }}>{e.name}{e.data?.variant ? ` · ${e.data.variant}` : ''} <small className="muted">{e.type}</small> <Badge tone={STATUS[e.status]?.tone}>{STATUS[e.status]?.label}</Badge></h2>
              <div className="rec-body">
                {e.files.filter((f) => f.kind === 'photos').slice(0, 1).map((f) => <Photo key={f.id} college={college} file={f} alt={e.name} />)}
                <div><EquipmentSections sections={e.sections} data={e.data} highValueLakhs={1.5} files={e.files.filter((f) => f.kind !== 'photos')} fileKinds={data.fileKinds} college={college} /></div>
              </div>
            </div>))}
          <p className="muted no-print"><Link to={`/c/${college}/lab-details`}>Back to labs</Link></p>
        </>)}
    </div>
  )
}
