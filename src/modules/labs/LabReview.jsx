import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, FileText, History, Pencil, X } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Modal, Skeleton, useDialog, useToast } from '../../ui'
import { api } from '../../core/api'
import EquipmentSections from './EquipmentSections'
import { STATUS } from './spec'
import { FlaskConical } from 'lucide-react'
import './labs.css'

const when = (t) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

/** HOD: review one lab. Every equipment with all its details, edit anything, send items back, then ONE final approval for the lab. */
export default function LabReview() {
  const { college, labId } = useParams()
  const toast = useToast()
  const dialog = useDialog()
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const [back, setBack] = useState(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => { api(`/c/${college}/labs/${labId}/record`).then(setD).catch((e) => setError(e.message)) }, [college, labId])
  useEffect(() => { load() }, [load])

  if (error) return <EmptyState title="Not available" icon={FlaskConical}>{error}</EmptyState>
  if (!d) return <Skeleton h={300} />
  const ready = d.equipment.filter((e) => e.status === 'submitted')
  const waitingInCharge = d.equipment.filter((e) => e.status === 'draft' || e.status === 'rejected')
  const approveLab = async () => {
    if (!(await dialog.confirm({ title: 'Approve this lab?', message: `${ready.length} equipment will be published. The changes become visible to the public now.`, confirmText: 'Approve and publish' }))) return
    setBusy(true)
    try { const r = await api(`/c/${college}/labs/${labId}/approve`, { method: 'POST' }); toast(`Approved. ${r.approved} equipment published.`); load() } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  const sendBack = async () => {
    try { await api(`/c/${college}/equipment/${back.id}/review`, { method: 'POST', body: { decision: 'reject', note: back.note } }); setBack(null); toast('Sent back to the in-charge'); load() } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div className="fade-up record">
      <div className="row no-print"><Link to={`/c/${college}/lab-details`} className="row"><ArrowLeft size={14} /> All labs</Link><span className="spacer" />
        <Link to={`/c/${college}/lab-details/${labId}/record`} className="btn btn-ghost"><FileText size={14} /> Lab record (PDF)</Link></div>
      <h1 style={{ fontSize: '1.8rem', margin: 'var(--s-3) 0 0' }}>{d.lab.name}</h1>
      <p className="muted">{d.lab.department} · {d.college.name}{d.lab.approved_at ? ` · last approved ${when(d.lab.approved_at)}` : ''}</p>

      <Card className="no-print" style={{ borderColor: ready.length ? 'var(--c-primary)' : undefined, margin: 'var(--s-4) 0' }}>
        <b>{ready.length ? `${ready.length} equipment waiting for your approval` : 'Nothing is waiting for your approval'}</b>
        <p className="muted" style={{ margin: 'var(--s-2) 0' }}>Check each equipment below. You can <b>edit</b> any detail yourself or <b>send it back</b> with a note. Then approve the lab once: everything sent by the in-charge goes live together.{waitingInCharge.length > 0 && ` ${waitingInCharge.length} more ${waitingInCharge.length === 1 ? 'is' : 'are'} still with the in-charge and will not be affected.`}</p>
        {d.can.approve && <Button onClick={approveLab} disabled={!ready.length || busy}><Check size={16} /> Approve lab and publish ({ready.length})</Button>}
      </Card>

      {!d.equipment.length && <p>No equipment has been added yet.</p>}
      {d.equipment.map((e) => (
        <section key={e.id} className="rec-eq">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>{e.name}{e.data?.variant ? ` · ${e.data.variant}` : ''}</h2><small className="muted">{e.type}</small>
            <Badge tone={STATUS[e.status]?.tone}>{STATUS[e.status]?.label}</Badge>
            {e.published && e.status !== 'approved' && <Badge>Published version live</Badge>}
            <span className="spacer" />
            <span className="row no-print">
              {d.can.edit && <Button as={Link} variant="ghost" size="sm" to={`/c/${college}/lab-details/equipment/${e.id}/edit`}><Pencil size={13} /> Edit</Button>}
              {d.can.approve && e.status === 'submitted' && <Button variant="ghost" size="sm" onClick={() => setBack({ id: e.id, name: e.name, note: '' })}><X size={13} /> Send back</Button>}
            </span>
          </div>
          {e.status === 'rejected' && e.reviewNote && <p className="helpbox">Sent back: {e.reviewNote}</p>}
          <EquipmentSections sections={e.sections} data={e.data} highValueLakhs={1.5} files={e.files} fileKinds={d.fileKinds} college={college} />
          {e.history.length > 0 && <p className="muted no-print" style={{ fontSize: 13 }}><History size={13} style={{ verticalAlign: '-2px' }} /> {e.history.map((h) => `${h.action}${h.detail ? ` (${h.detail.length > 80 ? `${h.detail.slice(0, 80)}…` : h.detail})` : ''} by ${h.who || h.role} on ${when(h.at)}`).slice(0, 3).join(' · ')}</p>}
        </section>))}

      <Modal size="sm" open={!!back} title={back ? `Send back: ${back.name}` : ''} onClose={() => setBack(null)}>
        {back && <><div className="field"><label>What should the in-charge fix?</label><textarea className="textarea" rows={4} value={back.note} onChange={(ev) => setBack({ ...back, note: ev.target.value })} /></div>
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button variant="ghost" onClick={() => setBack(null)}>Cancel</Button><Button disabled={back.note.trim().length < 3} onClick={sendBack}>Send back</Button></div></>}
      </Modal>
    </div>
  )
}
