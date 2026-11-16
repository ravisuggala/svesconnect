import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot } from 'lucide-react'
import { Button, Card } from '../../ui'
import { useAuth } from '../../core/auth'
import SearchBox from './SearchBox'

export default function SearchPage() {
  const { user } = useAuth()
  const internal = user && ['principal', 'hod', 'lab_incharge', 'admin'].includes(user.role)
  const [pubChoice, setPub] = useState(null) // null = default for this user
  const pub = pubChoice ?? !internal
  return (
    <div className="fade-up" style={{ maxWidth: 860 }}>
      <h2>Search labs & equipment</h2>
      <p className="muted">Find equipment, labs and departments across SVES. {internal ? 'As a signed-in user you can search your own college or department records (including items waiting for approval), or only what is published.' : 'Results are limited to published records.'}</p>
      {internal && <div className="row" style={{ margin: 'var(--s-3) 0' }}>
        <Button variant={!pub ? 'primary' : 'ghost'} size="sm" onClick={() => setPub(false)}>My {user.role === 'hod' ? 'department' : user.role === 'lab_incharge' ? 'lab' : 'college'}</Button>
        <Button variant={pub ? 'primary' : 'ghost'} size="sm" onClick={() => setPub(true)}>All published</Button></div>}
      <Card><SearchBox key={String(pub)} publicOnly={pub} /></Card>
      <p style={{ marginTop: 'var(--s-4)' }}><Link to="/assistant" className="row"><Bot size={16} /> Prefer to ask a question? Try the AI assistant</Link></p>
    </div>
  )
}
