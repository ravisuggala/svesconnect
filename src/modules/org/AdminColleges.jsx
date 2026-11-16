import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Table, useToast } from '../../ui'
import { api } from '../../core/api'

export default function AdminColleges() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()
  useEffect(() => { api('/admin/colleges').then((r) => setRows(r.colleges.map((c) => ({ ...c, id: c.code })))).catch((e) => toast(e.message, 'error')).finally(() => setLoading(false)) }, [toast])
  const columns = [
    { key: 'code', label: 'Code', render: (c) => <b>{c.code}</b> },
    { key: 'name', label: 'College' },
    { key: 'city', label: 'City' },
    { key: 'principalEmail', label: 'Principal login' },
    { key: 'principalStatus', label: 'Status', render: (c) => <Badge tone={c.principalStatus === 'active' ? 'success' : 'error'}>{c.principalStatus || 'none'}</Badge> },
    { key: 'hods', label: 'HODs' },
    { key: 'labs', label: 'Labs' },
    { key: 'go', label: '', render: (c) => <Link to={`/c/${c.code.toLowerCase()}/principal`}>Manage principal</Link> },
  ]
  return (
    <div className="fade-up">
      <h2>Administration</h2>
      <p className="muted">All colleges and their principal accounts. Each principal creates HODs, and each HOD creates lab coordinators.</p>
      <Table columns={columns} rows={rows} loading={loading} pageSize={12} />
    </div>
  )
}
