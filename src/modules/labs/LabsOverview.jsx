import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'
import { Badge, Card, EmptyState, Skeleton, useToast } from '../../ui'
import { useAuth } from '../../core/auth'
import { api } from '../../core/api'

/** HOD / Principal view: labs organised by department. Labs are never merged together. */
export default function LabsOverview() {
  const { college } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const [labs, setLabs] = useState(null)
  useEffect(() => { api(`/c/${college}/labs`).then((r) => setLabs(r.labs)).catch((e) => toast(e.message, 'error')) }, [college, toast])
  const turn = user.role === 'hod' ? 'submitted' : user.role === 'principal' ? 'verified' : null
  const byDept = (labs || []).reduce((m, l) => ((m[l.department] ||= []).push(l), m), {})
  const depts = Object.keys(byDept)

  return (
    <div className="fade-up">
      <h2>Labs & equipment</h2>
      <p className="muted">Organised by department and lab. {turn && <>Labs with records waiting for <b>your {user.role === 'hod' ? 'verification' : 'approval'}</b> are highlighted.</>}</p>
      {!labs && <div className="grid cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} h={120} />)}</div>}
      {labs && !depts.length && <EmptyState title="No labs yet" icon={FlaskConical}>Labs appear here when lab coordinators are created.</EmptyState>}
      {depts.map((d) => (
        <section key={d} style={{ marginTop: 'var(--s-5)' }}>
          <h3 style={{ color: 'var(--c-primary)' }}>{d}</h3>
          <div className="grid cols-3">{byDept[d].map((l) => (
            <Card hover key={l.id} className="labcard" style={turn && l[turn] ? { borderColor: 'var(--c-secondary)' } : undefined}>
              <h3>{l.name}</h3><span className="muted">{[l.building, l.room].filter(Boolean).join(' · ') || 'Location not set'}</span>
              <div className="counts"><Badge tone="success">{l.approved} published</Badge>{l.submitted > 0 && <Badge tone="warning">{l.submitted} awaiting HOD</Badge>}{l.verified > 0 && <Badge tone="primary">{l.verified} awaiting Principal</Badge>}{l.rejected > 0 && <Badge tone="error">{l.rejected} sent back</Badge>}{l.draft > 0 && <Badge>{l.draft} drafts</Badge>}</div>
              {turn && l[turn] > 0 && <p style={{ color: 'var(--c-secondary)', fontWeight: 700 }}>{l[turn]} waiting for you</p>}
              <Link to={`/c/${college}/lab-details/${l.id}`}>Open lab</Link>
            </Card>))}</div>
        </section>))}
    </div>
  )
}
