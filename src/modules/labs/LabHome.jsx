import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FlaskConical, Pencil, Plus } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Table, useToast } from '../../ui'
import { useAuth } from '../../core/auth'
import { api } from '../../core/api'
import { STATUS } from './spec'

/** The lab coordinator's home: their own lab only, its profile and its equipment. */
export default function LabHome() {
  const { college } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [lab, setLab] = useState(null)
  const [equipment, setEquipment] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [add, setAdd] = useState(null)
  const [errors, setErrors] = useState({})

  const [tick, setTick] = useState(0)
  const reload = () => setTick((t) => t + 1)
  useEffect(() => {
    let alive = true
    api(`/c/${college}/labs`)
      .then(({ labs }) => (labs.length ? api(`/c/${college}/labs/${labs[0].id}`) : null))
      .then((r) => { if (alive && r) { setLab(r.lab); setEquipment(r.equipment); setTemplates(r.templates) } })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [college, toast, tick])

  const saveProfile = async (ev) => {
    ev.preventDefault()
    try { await api(`/c/${college}/labs/${lab.id}`, { method: 'PATCH', body: profile }); setProfile(null); toast('Lab profile saved'); reload() } catch (e) { toast(e.message, 'error') }
  }
  const create = async (ev) => {
    ev.preventDefault(); setErrors({})
    try { const r = await api(`/c/${college}/labs/${lab.id}/equipment`, { method: 'POST', body: add }); nav(`/c/${college}/lab/equipment/${r.id}/fill`) }
    catch (e) { setErrors(e.fields || { form: e.message }) }
  }

  const columns = [
    { key: 'name', label: 'Equipment', render: (e) => <Link to={`/c/${college}/equipment/${e.id}`}><b>{e.name}</b></Link> },
    { key: 'templateKey', label: 'Type', render: (e) => templates.find((t) => t.key === e.templateKey)?.label || '' },
    { key: 'status', label: 'Status', render: (e) => <Badge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</Badge> },
    { key: 'go', label: '', render: (e) => (['draft', 'rejected'].includes(e.status) ? <Link to={`/c/${college}/lab/equipment/${e.id}/fill`}>{e.status === 'draft' ? 'Continue' : 'Fix & resubmit'}</Link> : <Link to={`/c/${college}/equipment/${e.id}`}>View</Link>) },
  ]

  if (!loading && !lab) return <EmptyState title="No lab linked to your account" icon={FlaskConical}>Ask your HOD to re-create your coordinator account.</EmptyState>
  return (
    <div className="fade-up">
      <div className="row"><div><Badge tone="primary">{user.college.name} · {user.department}</Badge><h2 style={{ margin: 'var(--s-2) 0 0' }}>{lab?.name || user.labName}</h2></div><span className="spacer" />
        <Button variant="ghost" onClick={() => setProfile({ description: lab.description || '', building: lab.building || '', floor: lab.floor || '', room: lab.room || '', accessibility: lab.accessibility || '' })} disabled={!lab}><Pencil size={14} /> Lab profile</Button>
        <Button onClick={() => { setErrors({}); setAdd({ templateKey: '', name: '' }) }} disabled={!lab}><Plus size={16} /> Add equipment</Button></div>
      {lab && <p className="muted" style={{ margin: 'var(--s-3) 0' }}>{lab.description || 'Add a short description of your lab in “Lab profile”.'}{(lab.building || lab.room) && ` · ${[lab.building, lab.floor && `Floor ${lab.floor}`, lab.room && `Room ${lab.room}`].filter(Boolean).join(', ')}`}</p>}
      <Card style={{ margin: 'var(--s-4) 0', background: 'var(--c-primary-soft)', borderColor: 'transparent' }}>
        <b>How publishing works:</b> you fill the form → your HOD verifies → your Principal approves → the equipment appears on the public lab page. Only this lab&apos;s equipment is shown on this lab&apos;s page.
      </Card>
      <Table columns={columns} rows={equipment} loading={loading} empty={<EmptyState title="No equipment yet" icon={FlaskConical}>Use “Add equipment”. The form asks one question at a time and adapts to the type of equipment.</EmptyState>} />

      <Modal open={!!add} title="Add equipment" onClose={() => setAdd(null)}>
        {add && <form onSubmit={create} noValidate>
          <Input label="Equipment name" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} error={errors.name} />
          <Select label="Type of equipment" value={add.templateKey} onChange={(e) => setAdd({ ...add, templateKey: e.target.value })} error={errors.templateKey}
            hint="This decides the extra department-specific questions. Pharmacy, dental and other labs can use “Other equipment”."
            options={[{ value: '', label: 'Select…' }, ...templates.map((t) => ({ value: t.key, label: `${t.dept} · ${t.label}` }))]} />
          {errors.form && <p role="alert" style={{ color: 'var(--c-error)' }}>{errors.form}</p>}
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button type="button" variant="ghost" onClick={() => setAdd(null)}>Cancel</Button><Button type="submit">Start</Button></div>
        </form>}
      </Modal>

      <Modal open={!!profile} title="Lab profile" onClose={() => setProfile(null)}>
        {profile && <form onSubmit={saveProfile}>
          <Field2 label="Description"><textarea className="textarea" rows={3} value={profile.description} onChange={(e) => setProfile({ ...profile, description: e.target.value })} /></Field2>
          <Input label="Building" value={profile.building} onChange={(e) => setProfile({ ...profile, building: e.target.value })} />
          <div className="grid cols-2"><Input label="Floor" value={profile.floor} onChange={(e) => setProfile({ ...profile, floor: e.target.value })} /><Input label="Room" value={profile.room} onChange={(e) => setProfile({ ...profile, room: e.target.value })} /></div>
          <Select label="Accessibility" value={profile.accessibility} onChange={(e) => setProfile({ ...profile, accessibility: e.target.value })} options={['', '24x7', 'Restricted hours', 'Prior permission']} />
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button type="button" variant="ghost" onClick={() => setProfile(null)}>Cancel</Button><Button type="submit">Save</Button></div>
        </form>}
      </Modal>
    </div>
  )
}
function Field2({ label, children }) { return <div className="field"><label>{label}</label>{children}</div> }
