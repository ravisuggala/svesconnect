import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { KeyRound, Pencil, Plus, UserCheck, UserX } from 'lucide-react'
import { Badge, Button, EmptyState, Input, Modal, Table, useDialog, useToast } from '../../ui'
import { useAuth } from '../../core/auth'
import { api } from '../../core/api'

// One screen for every level of the hierarchy; /c/:college/... routes give each college its own independent space.
const KINDS = {
  hod: { title: 'Heads of Department', noun: 'HOD', blurb: 'Create sign-ins for the HODs of your college. Each HOD then creates the lab coordinators of their department.', canCreate: true },
  lab_incharge: { title: 'Lab Coordinators', noun: 'Lab Coordinator', blurb: 'Create sign-ins for the coordinators of the labs in your department. Each coordinator enters the details of their lab.', canCreate: true },
  principal: { title: 'Principal account', noun: 'Principal', blurb: 'Principal accounts are created automatically for every college. You can reset the password or disable the account.', canCreate: false },
}
const EMPTY = { email: '', department: '', labName: '', name: '', password: '' }

export default function Accounts({ kind }) {
  const { college } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const dialog = useDialog()
  const k = KINDS[kind]
  const [data, setData] = useState({ users: [], college: null })
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(null)
  const [edit, setEdit] = useState(null)

  const load = useCallback(() => {
    api(`/c/${college}/users`).then(setData).catch((e) => toast(e.message, 'error')).finally(() => setLoading(false))
  }, [college, toast])
  useEffect(() => { load() }, [load])

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const create = async (ev) => {
    ev.preventDefault()
    setBusy(true); setErrors({})
    try {
      const r = await api(`/c/${college}/users`, { method: 'POST', body: form })
      setOpen(false); setCreated({ email: r.user.email, password: r.initialPassword })
      setForm(EMPTY)
      load()
    } catch (err) { setErrors(err.fields || { form: err.message }) } finally { setBusy(false) }
  }
  const saveEdit = async (ev) => {
    ev.preventDefault(); setBusy(true); setErrors({})
    try {
      await api(`/c/${college}/users/${edit.id}`, { method: 'PATCH', body: { action: 'update', email: edit.email, name: edit.name, labName: edit.labName, department: edit.department } })
      setEdit(null); toast('Saved'); load()
    } catch (err) { setErrors(err.fields || { form: err.message }) } finally { setBusy(false) }
  }
  const act = async (u, action) => {
    if (action === 'reset' && !(await dialog.confirm({ title: 'Reset password?', message: `The password of ${u.email} will go back to the default password.`, confirmText: 'Reset password', tone: 'warning' }))) return
    try {
      const r = await api(`/c/${college}/users/${u.id}`, { method: 'PATCH', body: { action } })
      if (action === 'reset') setCreated({ email: u.email, password: r.initialPassword, reset: true })
      else toast(action === 'disable' ? 'Account disabled' : 'Account enabled')
      load()
    } catch (err) { toast(err.message, 'error') }
  }

  const columns = [
    { key: 'email', label: 'Email' },
    ...(kind === 'hod' ? [{ key: 'department', label: 'Department' }] : []),
    ...(kind === 'lab_incharge' ? [{ key: 'labName', label: 'Lab' }, { key: 'department', label: 'Department' }] : []),
    { key: 'status', label: 'Status', render: (u) => <Badge tone={u.status === 'active' ? 'success' : 'error'}>{u.status === 'active' ? 'Active' : 'Disabled'}</Badge> },
    { key: 'actions', label: '', render: (u) => (
      <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
        {k.canCreate && <Button variant="ghost" size="sm" onClick={() => { setErrors({}); setEdit({ id: u.id, email: u.email, name: u.name || '', labName: u.labName || '', department: u.department || '' }) }}><Pencil size={14} /> Edit</Button>}
        <Button variant="ghost" size="sm" onClick={() => act(u, 'reset')}><KeyRound size={14} /> Reset</Button>
        {u.status === 'active'
          ? <Button variant="ghost" size="sm" onClick={() => act(u, 'disable')}><UserX size={14} /> Disable</Button>
          : <Button variant="ghost" size="sm" onClick={() => act(u, 'enable')}><UserCheck size={14} /> Enable</Button>}
      </span>) },
  ]

  return (
    <div className="fade-up">
      <div className="row">
        <div>
          <Badge tone="primary">{data.college?.name || college.toUpperCase()}</Badge>
          <h2 style={{ margin: 'var(--s-2) 0 0' }}>{k.title}</h2>
        </div>
        <span className="spacer" />
        {k.canCreate && <Button onClick={() => { setErrors({}); setOpen(true) }}><Plus size={16} /> Add {k.noun}</Button>}
      </div>
      <p className="muted" style={{ margin: 'var(--s-3) 0 var(--s-4)' }}>{k.blurb}</p>
      <Table columns={columns} rows={data.users} loading={loading}
        empty={<EmptyState title={`No ${k.title.toLowerCase()} yet`}>{k.canCreate ? `Use “Add ${k.noun}” to create the first sign-in.` : 'Nothing to show.'}</EmptyState>} />

      <Modal open={open} title={`Add ${k.noun}`} onClose={() => setOpen(false)}>
        <form onSubmit={create} noValidate>
          <Input label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} />
          {kind === 'hod' && <Input label="Department" value={form.department} onChange={set('department')} error={errors.department} hint="For example: CSE, ECE, Mechanical." />}
          {kind === 'lab_incharge' && <>
            <Input label="Department" value={user?.department || ''} readOnly hint="Coordinators belong to your department." />
            <Input label="Lab name" value={form.labName} onChange={set('labName')} error={errors.labName} />
          </>}
          <Input label="Name (optional)" value={form.name} onChange={set('name')} />
          <Input label="Password (optional)" type="text" value={form.password} onChange={set('password')} error={errors.password} hint="Leave blank to use the default password." />
          {errors.form && <p role="alert" style={{ color: 'var(--c-error)' }}>{errors.form}</p>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!edit} title={`Edit ${k.noun}`} onClose={() => setEdit(null)}>
        {edit && <form onSubmit={saveEdit} noValidate>
          <Input label="Email" type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} error={errors.email} hint="Used to sign in. Change it if it was typed wrongly." />
          <Input label="Name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          {kind === 'hod' && <Input label="Department" value={edit.department} onChange={(e) => setEdit({ ...edit, department: e.target.value })} error={errors.department} hint="Changing it moves this department's labs, coordinators and events to the new name." />}
          {kind === 'lab_incharge' && <Input label="Lab name" value={edit.labName} onChange={(e) => setEdit({ ...edit, labName: e.target.value })} error={errors.labName} />}
          {errors.form && <p role="alert" style={{ color: 'var(--c-error)' }}>{errors.form}</p>}
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button type="button" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></div>
        </form>}
      </Modal>

      <Modal open={!!created} title={created?.reset ? 'Password reset' : 'Account ready'} onClose={() => setCreated(null)}>
        <p>Share these sign-in details. Choose <b>{data.college?.name || college.toUpperCase()}</b> on the login page.</p>
        <p style={{ fontFamily: 'var(--f-mono)', background: 'var(--c-surface-2)', padding: 'var(--s-3)', borderRadius: 'var(--r-md)' }}>{created?.email}<br />{created?.password}</p>
        <p className="muted">They can change it any time from “Change password”.</p>
        <Button onClick={() => setCreated(null)}>Done</Button>
      </Modal>
    </div>
  )
}
