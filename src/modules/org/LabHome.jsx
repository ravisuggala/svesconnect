import { FlaskConical } from 'lucide-react'
import { Badge, Card } from '../../ui'
import { useAuth } from '../../core/auth'

export default function LabHome() {
  const { user } = useAuth()
  return (
    <div className="fade-up">
      <Badge tone="primary">{user.college.name}</Badge>
      <h2 style={{ margin: 'var(--s-2) 0 var(--s-4)' }}>My lab</h2>
      <Card>
        <div className="row"><FlaskConical color="var(--c-primary)" size={28} /><div><h3 style={{ margin: 0 }}>{user.labName}</h3><span className="muted">{user.department} · {user.name}</span></div></div>
        <p className="muted" style={{ marginTop: 'var(--s-4)' }}>You can sign in and manage your lab here. The form for entering the lab and equipment configuration is the next step of the build.</p>
      </Card>
    </div>
  )
}
