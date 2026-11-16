import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarDays, Plus } from 'lucide-react'
import { Badge, Button, EmptyState, Input, Modal, Select, Table, useToast } from '../../ui'
import { useAuth } from '../../core/auth'
import { api } from '../../core/api'
import './events.css'

// HOD / Principal: create events (each with its own coordinator login) and publish them.
const thisYear = new Date().getFullYear()
const YEARS = Array.from({ length: 8 }, (_, i) => { const y = thisYear + 1 - i; return `${y - 1}-${String(y).slice(2)}` })
const EMPTY = { name: '', typeKey: '', department: '', academicYear: YEARS[1], eventDate: '', venue: '', description: '', coordinatorEmail: '', coordinatorName: '' }

export default function EventsManage() {
  const { college } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const [events, setEvents] = useState([])
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(null)

  const load = useCallback(() => { api(`/c/${college}/events`).then((r) => setEvents(r.events)).catch((e) => toast(e.message, 'error')).finally(() => setLoading(false)) }, [college, toast])
  useEffect(() => { load(); api('/public/event-types').then((r) => setTypes(r.types)).catch(() => {}) }, [load])
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const create = async (ev) => {
    ev.preventDefault(); setBusy(true); setErrors({})
    try {
      const r = await api(`/c/${college}/events`, { method: 'POST', body: form })
      setOpen(false); setForm(EMPTY); load()
      setCreated(r.coordinator ? { email: r.coordinator.email, password: r.coordinator.password } : { none: true, id: r.id })
    } catch (err) { setErrors(err.fields || { form: err.message }) } finally { setBusy(false) }
  }
  const columns = [
    { key: 'name', label: 'Event', render: (e) => <Link to={`/c/${college}/event/${e.id}`}><b>{e.name}</b></Link> },
    { key: 'type', label: 'Type' },
    { key: 'department', label: 'Department', render: (e) => e.department || 'College-wide' },
    { key: 'academic_year', label: 'Year' },
    { key: 'status', label: 'Status', render: (e) => <Badge tone={e.status === 'published' ? 'success' : 'warning'}>{e.status === 'published' ? 'Published' : 'Not published'}</Badge> },
    { key: 'files', label: 'Files', render: (e) => `${e.files} (${e.publicFiles} public)` },
    { key: 'coordinator', label: 'Coordinator', render: (e) => e.coordinator || '—' },
  ]
  return (
    <div className="fade-up">
      <div className="row"><h2 style={{ margin: 0 }}>Events & projects</h2><span className="spacer" />
        <Button onClick={() => setOpen(true)}><Plus size={16} /> New event</Button></div>
      <p className="muted" style={{ margin: 'var(--s-3) 0 var(--s-4)' }}>Create an event, assign its coordinator, and publish it when its record is ready. The coordinator signs in with the same login page and lands on this event&apos;s workspace.</p>
      <Table columns={columns} rows={events} loading={loading} empty={<EmptyState title="No events yet" icon={CalendarDays}>Use “New event” to create the first one (BAJA, a workshop, a fest, a project ...).</EmptyState>} />

      <Modal open={open} title="New event" onClose={() => setOpen(false)}>
        <form onSubmit={create} noValidate>
          <Input label="Event name" value={form.name} onChange={set('name')} error={errors.name} hint="For example: BAJA 2025" />
          <Select label="Type of event" value={form.typeKey} onChange={set('typeKey')} error={errors.typeKey} hint="Decides the starting folders; the coordinator can add any folder later."
            options={[{ value: '', label: 'Select…' }, ...types.map((t) => ({ value: t.key, label: t.label }))]} />
          {user.role !== 'hod' && <Input label="Department (optional)" value={form.department} onChange={set('department')} hint="Leave blank for a college-wide event. A department's HOD publishes that department's events." />}
          <div className="grid cols-2"><Select label="Academic year" value={form.academicYear} onChange={set('academicYear')} options={YEARS} /><Input label="When" value={form.eventDate} onChange={set('eventDate')} hint="For example: March 2025" /></div>
          <Input label="Venue" value={form.venue} onChange={set('venue')} />
          <div className="field"><label>Short description</label><textarea className="textarea" rows={3} value={form.description} onChange={set('description')} /></div>
          <p className="muted" style={{ margin: 'var(--s-3) 0 0' }}>Event coordinator login (optional now, can be added later)</p>
          <div className="grid cols-2"><Input label="Coordinator email" type="email" value={form.coordinatorEmail} onChange={set('coordinatorEmail')} error={errors.coordinatorEmail} /><Input label="Name" value={form.coordinatorName} onChange={set('coordinatorName')} /></div>
          {errors.form && <p role="alert" style={{ color: 'var(--c-error)' }}>{errors.form}</p>}
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create event'}</Button></div>
        </form>
      </Modal>
      <Modal open={!!created} title="Event created" onClose={() => setCreated(null)}>
        {created?.none ? <p>The event is ready. Open it and use <b>People</b> to add its coordinator.</p> : <>
          <p>Share these sign-in details with the coordinator. They choose <b>{college.toUpperCase()}</b> on the login page.</p>
          <p style={{ fontFamily: 'var(--f-mono)', background: 'var(--c-surface-2)', padding: 'var(--s-3)', borderRadius: 'var(--r-md)' }}>{created?.email}<br />{created?.password}</p>
          <p className="muted">They can change it any time from “Change password”.</p></>}
        <Button onClick={() => setCreated(null)}>Done</Button>
      </Modal>
    </div>
  )
}
