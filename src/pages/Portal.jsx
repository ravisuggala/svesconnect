import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Badge, Card } from '../ui'
import { useAuth } from '../core/auth'
import { MODULES } from '../core/modules'

const tone = { planned: '', partial: 'warning', live: 'success' }
const label = { planned: 'Planned', partial: 'In progress', live: 'Live' }

export default function Portal() {
  const { user } = useAuth()
  return (
    <div className="fade-up">
      <h2>Welcome{user ? `, ${user.name.split(' ')[0]}` : ''}</h2>
      <p className="muted">Pick a module to get started. Each module is developed and released separately.</p>
      <div className="grid cols-3" style={{ marginTop: 'var(--s-4)' }}>
        {MODULES.filter((m) => !m.roles || m.roles.includes(user?.role)).map((m) => (
          <Card hover key={m.key}>
            <div className="row"><m.icon color="var(--c-primary)" size={24} /><span className="spacer" /><Badge tone={tone[m.status]}>{label[m.status]}</Badge></div>
            <h3 style={{ marginTop: 'var(--s-3)' }}>{m.label}</h3>
            <p className="muted">{m.summary}</p>
            <Link to={m.path} className="row">Open <ArrowRight size={14} /></Link>
          </Card>
        ))}
      </div>
    </div>
  )
}
