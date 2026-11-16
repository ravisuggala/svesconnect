import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Badge, Table, useToast } from '../../ui'
import { api } from '../../core/api'
import { STATUS } from './spec'

export default function LabDetail() {
  const { college, labId } = useParams()
  const toast = useToast()
  const [r, setR] = useState(null)
  useEffect(() => { api(`/c/${college}/labs/${labId}`).then(setR).catch((e) => toast(e.message, 'error')) }, [college, labId, toast])
  const columns = [
    { key: 'name', label: 'Equipment', render: (e) => <Link to={`/c/${college}/equipment/${e.id}`}><b>{e.name}</b></Link> },
    { key: 'type', label: 'Type', render: (e) => r.templates.find((t) => t.key === e.templateKey)?.label },
    { key: 'status', label: 'Status', render: (e) => <Badge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</Badge> },
    { key: 'updatedAt', label: 'Updated', render: (e) => new Date(e.updatedAt).toLocaleDateString() },
  ]
  return (
    <div className="fade-up">
      <Link to={`/c/${college}/lab-details`} className="row"><ArrowLeft size={14} /> All labs</Link>
      <h2 style={{ marginTop: 'var(--s-3)' }}>{r?.lab.name || 'Lab'}</h2>
      {r && <p className="muted">{r.lab.department}{r.lab.description ? ` · ${r.lab.description}` : ''}</p>}
      <Table columns={columns} rows={r?.equipment || []} loading={!r} />
    </div>
  )
}
