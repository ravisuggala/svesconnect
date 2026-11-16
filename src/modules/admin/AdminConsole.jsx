import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, Plus, Search, Trash2, Unlock, UserCheck, UserX } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Table, useToast } from '../../ui'
import { ROLE_LABEL } from '../../core/roles'
import { api } from '../../core/api'
import './admin.css'

// Administrator console: every college, user, lab, event and document in one place.
const ROLE_OPTIONS = ['principal', 'hod', 'lab_incharge', 'event_coordinator', 'event_member', 'admin']
const low = (c) => String(c).toLowerCase()
const EMPTY = { college: '', role: 'hod', email: '', name: '', department: '', labName: '', eventId: '', password: '' }

function Overview({ data }) {
  const t = data.totals
  const stats = [['Colleges', t.colleges], ['Accounts', t.users], ['Labs', t.labs], ['Equipment', t.equipment], ['Awaiting HOD', t.awaiting], ['Published equipment', t.approved], ['Events', t.events], ['Published events', t.publishedEvents], ['Event files', t.files]]
  const columns = [
    { key: 'code', label: 'College', render: (c) => <span><b>{c.code}</b><br /><small className="muted">{c.name}</small></span> },
    { key: 'users', label: 'Accounts', render: (c) => <span>{c.users}{c.disabled ? <small className="muted"> ({c.disabled} disabled)</small> : ''}</span> },
    { key: 'labs', label: 'Labs' },
    { key: 'equipment', label: 'Equipment', render: (c) => `${c.approved} published · ${c.awaiting} awaiting · ${c.equipment} total` },
    { key: 'events', label: 'Events', render: (c) => `${c.publishedEvents} published · ${c.events} total` },
    { key: 'files', label: 'Files' },
    { key: 'go', label: 'Open', render: (c) => <span className="adm-links"><Link to={`/c/${low(c.code)}/lab-details`}>Labs</Link><Link to={`/c/${low(c.code)}/events`}>Events</Link><Link to={`/c/${low(c.code)}/principal`}>Principal</Link><Link to={`/explore/c/${low(c.code)}`}>Public labs</Link></span> },
  ]
  return (
    <>
      <div className="adm-stats">{stats.map(([l, v]) => <div className="adm-stat" key={l}><b>{v}</b>{l}</div>)}</div>
      <Table columns={columns} rows={data.colleges} pageSize={12} />
    </>
  )
}

function Users({ colleges }) {
  const toast = useToast()
  const [filter, setFilter] = useState({ college: '', role: '', status: '', q: '' })
  const [q, setQ] = useState('')
  const [users, setUsers] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [creds, setCreds] = useState(null)
  const [edit, setEdit] = useState(null)
  const [pw, setPw] = useState(null)

  const load = useCallback(() => {
    const p = new URLSearchParams(Object.entries(filter).filter(([, v]) => v))
    api(`/admin/users?${p}`).then((r) => setUsers(r.users)).catch((e) => toast(e.message, 'error')).finally(() => setLoading(false))
  }, [filter, toast])
  useEffect(() => { load() }, [load])
  useEffect(() => { api('/admin/events').then((r) => setEvents(r.events)).catch(() => {}) }, [])
  useEffect(() => { const h = setTimeout(() => setFilter((f) => (f.q === q ? f : { ...f, q })), 300); return () => clearTimeout(h) }, [q])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const collegeOpts = (central) => [{ value: '', label: 'Select…' }, ...colleges.filter((c) => (central ? c.code === 'CENTRAL' : true)).map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }))]
  const eventOpts = useMemo(() => [{ value: '', label: 'Select…' }, ...events.filter((e) => e.college === form.college).map((e) => ({ value: e.id, label: `${e.name} (${e.academicYear || 'no year'})` }))], [events, form.college])

  const create = async (ev) => {
    ev.preventDefault(); setBusy(true); setErrors({})
    try {
      const body = { ...form, college: form.role === 'admin' ? 'CENTRAL' : form.college }
      const r = await api('/admin/users', { method: 'POST', body })
      setOpen(false); setForm(EMPTY); setCreds({ email: r.user.email, password: r.initialPassword, college: r.user.collegeName }); load()
    } catch (err) { setErrors(err.fields || { form: err.message }) } finally { setBusy(false) }
  }
  const act = async (u, action, extra = {}) => {
    if (action === 'delete') { if (!window.confirm(`Delete the account ${u.email}? This cannot be undone.`)) return
      try { await api(`/admin/users/${u.id}`, { method: 'DELETE' }); toast('Account deleted'); load() } catch (e) { toast(e.message, 'error') }; return }
    try {
      const r = await api(`/admin/users/${u.id}`, { method: 'PATCH', body: { action, ...extra } })
      if (action === 'reset' || action === 'unlock' || action === 'setPassword') setCreds({ email: u.email, password: r.initialPassword, college: u.collegeName, reset: true })
      else toast(action === 'update' ? 'Saved' : action === 'disable' ? 'Account disabled' : 'Account enabled')
      setEdit(null); setPw(null); load()
    } catch (e) { toast(e.message, 'error') }
  }

  const where = (u) => [u.department, u.labName && `Lab: ${u.labName}`, u.eventName && `Event: ${u.eventName}`].filter(Boolean).join(' · ') || '—'
  const columns = [
    { key: 'email', label: 'Account', render: (u) => <span><b>{u.name}</b><br /><small className="muted">{u.email}</small></span> },
    { key: 'college', label: 'College', render: (u) => u.college || '—' },
    { key: 'role', label: 'Role', render: (u) => <Badge tone={u.role === 'admin' ? 'primary' : ''}>{ROLE_LABEL[u.role] || u.role}</Badge> },
    { key: 'where', label: 'Department / lab / event', render: where },
    { key: 'status', label: 'Status', render: (u) => <Badge tone={u.status === 'active' ? 'success' : 'error'}>{u.status === 'active' ? (u.mustChangePassword ? 'Active · default password' : 'Active') : 'Disabled'}</Badge> },
    { key: 'act', label: 'Actions', render: (u) => (
      <span className="row adm-act">
        <Button variant="ghost" size="sm" title="Unlock: enable and reset to the default password" onClick={() => window.confirm(`Unlock ${u.email}? The password goes back to the default.`) && act(u, 'unlock')}><Unlock size={14} /></Button>
        <Button variant="ghost" size="sm" title="Set a password" onClick={() => setPw({ u, password: '' })}><KeyRound size={14} /></Button>
        <Button variant="ghost" size="sm" title={u.status === 'active' ? 'Disable' : 'Enable'} onClick={() => act(u, u.status === 'active' ? 'disable' : 'enable')}>{u.status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}</Button>
        <Button variant="ghost" size="sm" onClick={() => setEdit({ u, name: u.name, email: u.email })}>Edit</Button>
        <Button variant="ghost" size="sm" title="Delete" onClick={() => act(u, 'delete')}><Trash2 size={14} /></Button>
      </span>) },
  ]
  return (
    <>
      <div className="adm-filters">
        <Select label="College" value={filter.college} onChange={(e) => setFilter({ ...filter, college: e.target.value })} options={[{ value: '', label: 'All colleges' }, ...colleges.map((c) => ({ value: c.code, label: c.code }))]} />
        <Select label="Role" value={filter.role} onChange={(e) => setFilter({ ...filter, role: e.target.value })} options={[{ value: '', label: 'All roles' }, ...ROLE_OPTIONS.map((r) => ({ value: r, label: ROLE_LABEL[r] }))]} />
        <Select label="Status" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} options={[{ value: '', label: 'Any' }, { value: 'active', label: 'Active' }, { value: 'disabled', label: 'Disabled' }]} />
        <Input label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or department" />
        <Button onClick={() => setOpen(true)}><Plus size={16} /> New account</Button>
      </div>
      <Table columns={columns} rows={users} loading={loading} pageSize={15} empty={<EmptyState title="No accounts match" icon={Search}>Change the filters.</EmptyState>} />

      <Modal open={open} title="New account" onClose={() => setOpen(false)}>
        <form onSubmit={create} noValidate>
          <Select label="Type of user" value={form.role} onChange={(e) => setForm({ ...EMPTY, role: e.target.value, college: e.target.value === 'admin' ? 'CENTRAL' : form.college })} options={ROLE_OPTIONS.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} error={errors.role} />
          {form.role !== 'admin' && <Select label="College" value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value, eventId: '' })} options={collegeOpts(false)} error={errors.college} />}
          <Input label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} />
          <Input label="Name (optional)" value={form.name} onChange={set('name')} />
          {['hod', 'lab_incharge'].includes(form.role) && <Input label="Department" value={form.department} onChange={set('department')} error={errors.department} />}
          {form.role === 'lab_incharge' && <Input label="Lab name" value={form.labName} onChange={set('labName')} error={errors.labName} />}
          {['event_coordinator', 'event_member'].includes(form.role) && <Select label="Event" value={form.eventId} onChange={set('eventId')} options={eventOpts} error={errors.eventId} hint="Create events from the college's Events page." />}
          <Input label="Password (optional)" value={form.password} onChange={set('password')} error={errors.password} hint="Leave blank for the default password. They must change it at first sign-in." />
          {errors.form && <p role="alert" style={{ color: 'var(--c-error)' }}>{errors.form}</p>}
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button></div>
        </form>
      </Modal>

      <Modal open={!!edit} title="Edit account" onClose={() => setEdit(null)}>
        {edit && <form onSubmit={(e) => { e.preventDefault(); act(edit.u, 'update', { name: edit.name, email: edit.email }) }}>
          <Input label="Name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <Input label="Email" type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button type="button" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit">Save</Button></div>
        </form>}
      </Modal>

      <Modal open={!!pw} title={`Set password for ${pw?.u.email}`} onClose={() => setPw(null)}>
        {pw && <form onSubmit={(e) => { e.preventDefault(); act(pw.u, 'setPassword', { password: pw.password }) }}>
          <Input label="New password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} hint="At least 8 characters. They are asked to change it at next sign-in." />
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button type="button" variant="ghost" onClick={() => setPw(null)}>Cancel</Button><Button type="submit" disabled={pw.password.length < 8}>Set password</Button></div>
        </form>}
      </Modal>

      <Modal open={!!creds} title={creds?.reset ? 'Sign-in details updated' : 'Account created'} onClose={() => setCreds(null)}>
        <p>Share these sign-in details. On the login page choose <b>{creds?.college}</b>.</p>
        <p className="adm-cred">{creds?.email}<br />{creds?.password}</p>
        <p className="muted">They will be asked to set their own password at first sign-in.</p><Button onClick={() => setCreds(null)}>Done</Button>
      </Modal>
    </>
  )
}

function Events() {
  const toast = useToast()
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true)
  const load = useCallback(() => { api('/admin/events').then((r) => setRows(r.events)).catch((e) => toast(e.message, 'error')).finally(() => setLoading(false)) }, [toast])
  useEffect(() => { load() }, [load])
  const publish = async (e) => { try { await api(`/c/${low(e.college)}/events/${e.id}/publish`, { method: 'POST', body: { published: e.status !== 'published' } }); load() } catch (er) { toast(er.message, 'error') } }
  const columns = [
    { key: 'college', label: 'College', render: (e) => <b>{e.college}</b> },
    { key: 'name', label: 'Event', render: (e) => <Link to={`/c/${low(e.college)}/event/${e.id}`}><b>{e.name}</b></Link> },
    { key: 'academicYear', label: 'Year' },
    { key: 'status', label: 'Status', render: (e) => <Badge tone={e.status === 'published' ? 'success' : 'warning'}>{e.status === 'published' ? 'Published' : 'Not published'}</Badge> },
    { key: 'files', label: 'Files', render: (e) => `${e.files} (${e.publicFiles} public)` },
    { key: 'coordinator', label: 'Coordinator', render: (e) => e.coordinator || '—' },
    { key: 'act', label: '', render: (e) => <span className="row adm-act"><Button variant="ghost" size="sm" onClick={() => publish(e)}>{e.status === 'published' ? 'Unpublish' : 'Publish'}</Button>{e.status === 'published' && <Link to={`/events/${e.id}`}>Public page</Link>}</span> },
  ]
  return <Table columns={columns} rows={rows} loading={loading} pageSize={15} empty={<EmptyState title="No events yet">Create events from a college's Events page.</EmptyState>} />
}

function Labs() {
  const toast = useToast()
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true)
  useEffect(() => { api('/admin/labs').then((r) => setRows(r.labs)).catch((e) => toast(e.message, 'error')).finally(() => setLoading(false)) }, [toast])
  const columns = [
    { key: 'college', label: 'College', render: (l) => <b>{l.college}</b> },
    { key: 'department', label: 'Department' },
    { key: 'name', label: 'Lab', render: (l) => <Link to={`/c/${low(l.college)}/lab-details/${l.id}`}><b>{l.name}</b></Link> },
    { key: 'coordinator', label: 'Coordinator', render: (l) => l.coordinator || '—' },
    { key: 'total', label: 'Equipment', render: (l) => `${l.approved} published · ${l.awaiting} awaiting · ${l.total} total` },
  ]
  return <Table columns={columns} rows={rows} loading={loading} pageSize={15} empty={<EmptyState title="No labs yet">Labs appear when HODs create lab coordinators.</EmptyState>} />
}

export default function AdminConsole() {
  const toast = useToast()
  const [tab, setTab] = useState('overview')
  const [summary, setSummary] = useState(null)
  useEffect(() => { api('/admin/summary').then(setSummary).catch((e) => toast(e.message, 'error')) }, [toast])
  const [central, setCentral] = useState([])
  useEffect(() => { api('/colleges').then((r) => setCentral(r.colleges)).catch(() => {}) }, [])
  const tabs = [['overview', 'Overview'], ['users', 'Accounts'], ['labs', 'Labs & equipment'], ['events', 'Events & documents']]
  return (
    <div className="fade-up">
      <h2 style={{ marginBottom: 4 }}>Administrator console</h2>
      <p className="muted" style={{ marginTop: 0 }}>Everything across all SVES colleges: accounts and credentials, labs and equipment, events and their documents. Open any college to work inside it exactly as its Principal would; you can approve equipment and publish events anywhere.</p>
      <div className="ev-tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'overview' && (summary ? <Overview data={summary} /> : <Card>Loading…</Card>)}
      {tab === 'users' && <Users colleges={central} />}
      {tab === 'labs' && <Labs />}
      {tab === 'events' && <Events />}
    </div>
  )
}
