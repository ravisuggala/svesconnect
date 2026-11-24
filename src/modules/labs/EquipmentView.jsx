import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { Badge, Button, Card, Loader, Modal, useDialog, useToast } from '../../ui'
import { api } from '../../core/api'
import { useAuth } from '../../core/auth'
import EquipmentSections from './EquipmentSections'
import { STATUS } from './spec'

const FLOW = [['draft', 'Filled by coordinator'], ['submitted', 'Reviewed by HOD'], ['approved', 'Approved & published']]

/** Internal view of one equipment record with the approval actions for the person whose turn it is. */
export default function EquipmentView() {
  const { college, id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const dialog = useDialog()
  const { user } = useAuth()
  const [r, setR] = useState(null)
  const [reject, setReject] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(() => { api(`/c/${college}/equipment/${id}`).then(setR).catch((e) => setError(e.message)) }, [college, id])
  useEffect(() => { load() }, [load])

  if (error) return <Card><p role="alert" style={{ color: 'var(--c-error)' }}>{error}</p></Card>
  if (!r) return <div style={{ padding: 48, textAlign: 'center' }}><Loader label="Loading…" /></div>
  const { equipment: e, spec, files, can } = r
  const order = ['draft', 'submitted', 'approved']
  const at = e.status === 'rejected' ? 0 : order.indexOf(e.status)

  const decide = async (decision, note) => {
    try { await api(`/c/${college}/equipment/${id}/review`, { method: 'POST', body: { decision, note } }); setReject(null); toast(decision === 'approve' ? 'Done' : 'Sent back to the coordinator'); load() }
    catch (er) { toast(er.message, 'error') }
  }
  const remove = async () => { if (!(await dialog.confirm({ title: 'Delete this draft?', message: 'This equipment draft and its files will be removed. This cannot be undone.', confirmText: 'Delete', tone: 'danger' }))) return; await api(`/c/${college}/equipment/${id}`, { method: 'DELETE' }); nav(`/c/${college}/lab`) }

  return (
    <div className="fade-up" style={{ maxWidth: 900 }}>
      <div className="row"><Badge tone="primary">{e.department} · {e.labName}</Badge><Badge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</Badge><span className="spacer" />
        {can.edit && <Button as={Link} to={user.role === 'lab_incharge' ? `/c/${college}/lab/equipment/${e.id}/fill` : `/c/${college}/lab-details/equipment/${e.id}/edit`}><Pencil size={14} /> Edit</Button>}
        {can.delete && <Button variant="ghost" onClick={remove}><Trash2 size={14} /> Delete draft</Button>}</div>
      <h2 style={{ margin: 'var(--s-3) 0 0' }}>{e.name}{e.data?.variant ? <small className="muted"> · {e.data.variant}</small> : null}</h2>
      <p className="muted">{spec.template?.label}</p>
      <div className="steps">{FLOW.map(([k, label], i) => <div key={k} className={`stp ${i < at ? 'done' : i === at && e.status !== 'rejected' ? 'now' : ''}`}>{i < at && <Check size={12} />} {label}</div>)}</div>
      {e.status === 'rejected' && <Card style={{ borderColor: 'var(--c-error)', background: 'var(--c-error-bg)', marginBottom: 'var(--s-4)' }}><b>Sent back for changes:</b> {e.reviewNote}</Card>}
      {can.review && (
        <Card style={{ borderColor: 'var(--c-primary)', marginBottom: 'var(--s-4)' }}>
          <b>Your turn: review this record as HOD</b>
          <p className="muted">Approving is the final approval and publishes it on the public lab page. Or send it back with a note.</p>
          <div className="row"><Button onClick={() => decide('approve')}><Check size={16} /> Approve & publish</Button><Button variant="ghost" onClick={() => setReject({ note: '' })}><X size={16} /> Send back</Button></div>
        </Card>)}
      <EquipmentSections sections={spec.sections} data={e.data} highValueLakhs={spec.highValueLakhs} files={files} fileKinds={spec.fileKinds} college={college} />
      <Modal size="sm" open={!!reject} title="Send back to the coordinator" onClose={() => setReject(null)}>
        {reject && <><div className="field"><label>What needs to be fixed?</label><textarea className="textarea" rows={4} value={reject.note} onChange={(ev) => setReject({ note: ev.target.value })} /></div>
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button variant="ghost" onClick={() => setReject(null)}>Cancel</Button><Button disabled={reject.note.trim().length < 3} onClick={() => decide('reject', reject.note)}>Send back</Button></div></>}
      </Modal>
    </div>
  )
}
