import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FileText, FlaskConical, Info, Pencil, Plus } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Table, useDialog, useToast } from '../../ui'
import { useAuth } from '../../core/auth'
import { api } from '../../core/api'
import { STATUS } from './spec'
import NameSuggest from './NameSuggest'

/** The lab coordinator's home: their own lab only, its profile and its equipment. */
export default function LabHome() {
  const { college } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const dialog = useDialog()
  const nav = useNavigate()
  const [lab, setLab] = useState(null)
  const [equipment, setEquipment] = useState([])
  const [templates, setTemplates] = useState([])
  const [categories, setCategories] = useState([])
  const [known, setKnown] = useState(null) // catalogue entry already in the college list
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
      .then((r) => { if (alive && r) { setLab(r.lab); setEquipment(r.equipment); setTemplates(r.templates); setCategories(r.categories || []) } })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [college, toast, tick])

  const saveProfile = async (ev) => {
    ev.preventDefault()
    try { await api(`/c/${college}/labs/${lab.id}`, { method: 'PATCH', body: profile }); setProfile(null); toast('Lab profile saved'); setErrors({}); reload() } catch (e) { setErrors(e.fields || {}); toast(e.message, 'error') }
  }
  const create = async (ev) => {
    ev.preventDefault(); setErrors({})
    try { const r = await api(`/c/${college}/labs/${lab.id}/equipment`, { method: 'POST', body: add }); setAdd(null); toast('Added. Now add its details, one step at a time.'); nav(`/c/${college}/lab/equipment/${r.id}/fill`) }
    catch (e) { setErrors(e.fields || { form: e.message }); dialog.warning(e.message, 'Please check') }
  }

  const columns = [
    { key: 'name', label: 'Equipment', render: (e) => <Link to={`/c/${college}/equipment/${e.id}`}><b>{e.name}</b>{e.variant ? <small className="muted"> · {e.variant}</small> : null}</Link> },
    { key: 'templateKey', label: 'Type', render: (e) => templates.find((t) => t.key === e.templateKey)?.label || '' },
    { key: 'status', label: 'Status', render: (e) => <><Badge tone={STATUS[e.status].tone}>{e.published && e.status === 'draft' ? 'Editing' : STATUS[e.status].label}</Badge>{e.published && e.status !== 'approved' && <div className="muted" style={{ fontSize: 12 }}>Published version is still live</div>}</> },
    { key: 'go', label: '', render: (e) => <span className="row" style={{ gap: 12 }}><Link to={`/c/${college}/lab/equipment/${e.id}/fill`}>{e.status === 'draft' ? 'Continue' : e.status === 'rejected' ? 'Make changes' : 'Edit'}</Link><Link to={`/c/${college}/equipment/${e.id}`}>View</Link></span> },
  ]

  if (!loading && !lab) return <EmptyState title="No lab linked to your account" icon={FlaskConical}>Ask your HOD to re-create your coordinator account.</EmptyState>
  return (
    <div className="fade-up">
      <div className="row"><div><Badge tone="primary">{user.college.name} · {user.department}</Badge><h2 style={{ margin: 'var(--s-2) 0 0' }}>{lab?.name || user.labName}</h2></div><span className="spacer" />
        <Button variant="ghost" onClick={() => setProfile({ name: lab.name, description: lab.description || '', building: lab.building || '', floor: lab.floor || '', room: lab.room || '', accessibility: lab.accessibility || '', contact_name: lab.contact_name || '', contact_email: lab.contact_email || '', contact_phone: lab.contact_phone || '' })} disabled={!lab}><Pencil size={14} /> Lab profile</Button>
        <Button variant="ghost" as={Link} to={`/c/${college}/lab/record`}><FileText size={14} /> Lab record</Button>
        <Button onClick={() => { setErrors({}); setKnown(null); setAdd({ name: '', purpose: '', templateKey: '', variant: '' }) }} disabled={!lab}><Plus size={16} /> Add equipment</Button></div>
      {lab && <p className="muted" style={{ margin: 'var(--s-3) 0' }}>{lab.description || 'Add a short description of your lab in “Lab profile”.'}{(lab.building || lab.room) && ` · ${[lab.building, lab.floor && `Floor ${lab.floor}`, lab.room && `Room ${lab.room}`].filter(Boolean).join(', ')}`}</p>}
      <Card style={{ margin: 'var(--s-4) 0', background: 'var(--c-primary-soft)', borderColor: 'transparent' }}>
        <b>How it works:</b> add each equipment of your lab, then fill its details step by step. Everything is saved automatically, so you can stop and continue any time. When an equipment is ready, send it to your HOD. After the HOD approves, it appears on the public equipment pages.
      </Card>
      <Table columns={columns} rows={equipment} loading={loading} empty={<EmptyState title="No equipment yet" icon={FlaskConical}>Use “Add equipment”: type the name, pick it from the list (or add a new one) and say what it is used for.</EmptyState>} />

      <Modal open={!!add} title="Add equipment" onClose={() => setAdd(null)}>
        {add && <form onSubmit={create} noValidate>
          <NameSuggest college={college} value={add.name} error={errors.name}
            onChange={(name) => { setAdd({ ...add, name }); if (known && known.name.toLowerCase() !== name.trim().toLowerCase()) setKnown(null) }}
            onPick={(it) => { setKnown(it); setAdd({ ...add, name: it.name, purpose: it.purpose || add.purpose, templateKey: it.typeKey || add.templateKey }) }}
            onExact={(it) => { if (it && !known) { setKnown(it); setAdd((a) => ({ ...a, name: it.name, purpose: it.purpose || a.purpose, templateKey: it.typeKey || a.templateKey })) } }} />
          {known && <p className="helpbox"><Info size={15} /> This equipment is already in your college&apos;s list. Its type and purpose are filled in. You can use it for your department&apos;s information.</p>}
          <Select label="Type of equipment" value={add.templateKey} disabled={!!known?.typeKey} onChange={(e) => setAdd({ ...add, templateKey: e.target.value })} error={errors.templateKey}
            hint="Pick the closest match. This only groups similar equipment together."
            options={[{ value: '', label: 'Select…' }, ...categories.map((c) => ({ value: c.key, label: c.label }))]} />
          <Input label="Configuration (optional)" value={add.variant || ''} onChange={(e) => setAdd({ ...add, variant: e.target.value })} hint="Have the same equipment in different configurations? Add it again with its own configuration, e.g. “Intel i5, 8 GB RAM”." />
          <div className="field"><label htmlFor="eq-purpose">What is it used for?</label>
            <textarea id="eq-purpose" className="textarea" rows={2} value={add.purpose} disabled={!!known?.purpose} onChange={(e) => setAdd({ ...add, purpose: e.target.value })} placeholder="One or two lines, e.g. Measures voltage waveforms in electronic circuits" />
            {errors.purpose && <p role="alert" className="field-error">{errors.purpose}</p>}
            {!known && <p className="muted" style={{ margin: 'var(--s-1) 0 0' }}>New names are added to your college&apos;s list so every lab can pick them next time.</p>}</div>
          {errors.form && <p role="alert" style={{ color: 'var(--c-error)' }}>{errors.form}</p>}
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button type="button" variant="ghost" onClick={() => setAdd(null)}>Cancel</Button><Button type="submit">Add equipment</Button></div>
        </form>}
      </Modal>

      <Modal open={!!profile} title="Lab profile" onClose={() => setProfile(null)}>
        {profile && <form onSubmit={saveProfile}>
          <Input label="Lab name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} error={errors.name} hint="Correct it here if it was typed wrongly. It changes everywhere." />
          <Field2 label="Description"><textarea className="textarea" rows={3} value={profile.description} onChange={(e) => setProfile({ ...profile, description: e.target.value })} /></Field2>
          <Input label="Building" value={profile.building} onChange={(e) => setProfile({ ...profile, building: e.target.value })} />
          <div className="grid cols-2"><Input label="Floor" value={profile.floor} onChange={(e) => setProfile({ ...profile, floor: e.target.value })} /><Input label="Room" value={profile.room} onChange={(e) => setProfile({ ...profile, room: e.target.value })} /></div>
          <Select label="Accessibility" value={profile.accessibility} onChange={(e) => setProfile({ ...profile, accessibility: e.target.value })} options={['', '24x7', 'Restricted hours', 'Prior permission']} />
          <p className="muted" style={{ margin: 'var(--s-3) 0 0' }}>Contact shown publicly on your lab page (leave blank to use your login name and email).</p>
          <Input label="Coordinator name" value={profile.contact_name} onChange={(e) => setProfile({ ...profile, contact_name: e.target.value })} />
          <div className="grid cols-2"><Input label="Email" type="email" value={profile.contact_email} onChange={(e) => setProfile({ ...profile, contact_email: e.target.value })} /><Input label="Mobile" type="tel" value={profile.contact_phone} onChange={(e) => setProfile({ ...profile, contact_phone: e.target.value })} /></div>
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button type="button" variant="ghost" onClick={() => setProfile(null)}>Cancel</Button><Button type="submit">Save</Button></div>
        </form>}
      </Modal>
    </div>
  )
}
function Field2({ label, children }) { return <div className="field"><label>{label}</label>{children}</div> }
