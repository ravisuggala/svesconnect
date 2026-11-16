import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, Upload, X } from 'lucide-react'
import { Badge, Button, Card, Field, Loader } from '../../ui'
import { api, fileToBase64, openFile } from '../../core/api'
import { empty, fileKindVisible, visible } from './spec'
import { useToast } from '../../ui'
import './labs.css'

/** One question at a time. Questions come from the server's form spec, and appear or disappear as earlier answers change. */
export default function EquipmentFlow() {
  const { college, id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const [state, setState] = useState(null)
  const [data, setData] = useState({})
  const [files, setFiles] = useState([])
  const [cursor, setCursor] = useState(null) // question key, or 'review'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saved = useRef({})

  useEffect(() => {
    api(`/c/${college}/equipment/${id}`).then((r) => {
      if (!r.can.edit) return nav(`/c/${college}/equipment/${id}`, { replace: true })
      setState(r); setData(r.equipment.data); saved.current = r.equipment.data; setFiles(r.files)
    }).catch((e) => setError(e.message))
  }, [college, id, nav])

  const spec = state?.spec
  const hv = spec?.highValueLakhs
  const questions = useMemo(() => {
    if (!spec) return []
    const out = []
    for (const s of spec.sections) {
      if (s.files) { for (const k of spec.fileKinds) if (fileKindVisible(k.key, data, hv)) out.push({ key: `file:${k.key}`, section: s, kind: k }) }
      else for (const f of s.fields) if (visible(f, data, hv)) out.push({ key: f.key, section: s, field: f })
    }
    return out
  }, [spec, data, hv])

  const at = cursor ?? questions[0]?.key // first question until the user moves on
  const idx = at === 'review' ? questions.length : Math.max(0, questions.findIndex((q) => q.key === at))
  const q = questions[idx]
  const fileQs = questions.filter((x) => x.kind).length
  const answered = questions.filter((x) => x.field && !empty(data[x.field.key])).length

  const persist = useCallback(async () => {
    const changed = {}
    for (const [k, v] of Object.entries(data)) if (JSON.stringify(saved.current[k]) !== JSON.stringify(v)) changed[k] = v
    if (!Object.keys(changed).length) return true
    try { await api(`/c/${college}/equipment/${id}`, { method: 'PATCH', body: { data: changed } }); saved.current = { ...data }; return true }
    catch (e) { toast(e.message, 'error'); return false }
  }, [data, college, id, toast])

  const go = async (to) => { setBusy(true); if (await persist()) setCursor(to); setBusy(false) }
  const next = () => go(idx + 1 >= questions.length ? 'review' : questions[idx + 1].key)
  const back = () => idx > 0 && go(questions[at === 'review' ? questions.length - 1 : idx - 1].key)
  const exit = async () => { setBusy(true); if (await persist()) nav(`/c/${college}/lab`); setBusy(false) }
  const submit = async () => {
    setBusy(true)
    try { if (!(await persist())) return; await api(`/c/${college}/equipment/${id}/submit`, { method: 'POST' }); toast('Submitted to your HOD'); nav(`/c/${college}/equipment/${id}`) }
    catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  const set = (key, value) => setData((d) => ({ ...d, [key]: value }))
  const upload = async (kind, fileList) => {
    for (const file of fileList) {
      if (file.size > 8 * 1024 * 1024) { toast(`${file.name} is larger than 8 MB`, 'error'); continue }
      try {
        const r = await api(`/c/${college}/equipment/${id}/files`, { method: 'POST', body: { kind, filename: file.name, contentBase64: await fileToBase64(file) } })
        setFiles((f) => [...f, r.file])
      } catch (e) { toast(e.message, 'error') }
    }
  }
  const removeFile = async (fid) => { try { await api(`/c/${college}/files/${fid}`, { method: 'DELETE' }); setFiles((f) => f.filter((x) => x.id !== fid)) } catch (e) { toast(e.message, 'error') } }

  if (error) return <Card><p role="alert" style={{ color: 'var(--c-error)' }}>{error}</p></Card>
  if (!state) return <div style={{ padding: 48, textAlign: 'center' }}><Loader label="Loading form…" /></div>

  const sections = spec.sections
  const curSection = at === 'review' ? null : q?.section.key
  const jump = (sKey) => { const t = questions.find((x) => x.section.key === sKey); if (t) go(t.key) }
  const pct = Math.round(((at === 'review' ? questions.length : idx) / Math.max(1, questions.length)) * 100)

  return (
    <div className="flow fade-up">
      <div className="row"><Badge tone="primary">{state.equipment.labName}</Badge><Badge>{spec.template?.label}</Badge><span className="spacer" />
        <Button variant="ghost" size="sm" onClick={exit} disabled={busy}><X size={14} /> Save & exit</Button></div>
      <h2 style={{ margin: 'var(--s-3) 0' }}>{data.name}</h2>
      <div className="chips">{sections.filter((s) => questions.some((x) => x.section.key === s.key)).map((s) => <button key={s.key} className={`chip ${curSection === s.key ? 'on' : ''}`} onClick={() => jump(s.key)}>{s.title.replace(/ \(all optional\)/, '')}</button>)}
        <button className={`chip ${at === 'review' ? 'on' : ''}`} onClick={() => go('review')}>Review & submit</button></div>
      <div className="bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>

      <Card className="q">
        {at === 'review' ? (
          <>
            <span className="sec">Final step</span>
            <h2>Review and submit</h2>
            <p>You answered <b>{answered}</b> of {questions.length - fileQs} questions. Anything you leave blank is simply not shown. While the record is a draft you can come back and add more. After you submit, your HOD reviews it and gives the final approval, and only then does it appear on the public lab page.</p>
            <div className="flow-nav"><Button variant="ghost" onClick={back} disabled={busy}><ArrowLeft size={16} /> Back</Button>
              <Button onClick={submit} disabled={busy}><Check size={16} /> Submit to HOD</Button></div>
          </>
        ) : q && (
          <>
            <span className="sec">{q.section.title} · question {idx + 1} of {questions.length}</span>
            {q.kind ? (
              <>
                <h2>{q.kind.label} <small className="muted" style={{ fontSize: 14 }}>(optional)</small></h2>
                <p className="muted">PDF, image, Word or Excel, up to 8 MB each. You can skip this.</p>
                {files.filter((f) => f.kind === q.kind.key).map((f) => (
                  <div key={f.id} className="filerow"><a href="#" onClick={(e) => { e.preventDefault(); openFile(`/c/${college}/files/${f.id}`).catch((er) => toast(er.message, 'error')) }}>{f.name}</a><span className="muted">{Math.ceil(f.size / 1024)} KB</span><span className="spacer" /><Button variant="ghost" size="sm" onClick={() => removeFile(f.id)} aria-label="Remove"><Trash2 size={14} /></Button></div>
                ))}
                <label className="btn btn-ghost" style={{ cursor: 'pointer' }}><Upload size={16} /> Choose file(s)
                  <input type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" onChange={(e) => { upload(q.kind.key, [...e.target.files]); e.target.value = '' }} /></label>
              </>
            ) : <Question field={q.field} value={data[q.field.key]} onChange={(v) => set(q.field.key, v)} />}
            <div className="flow-nav">
              <Button variant="ghost" onClick={back} disabled={busy || idx === 0}><ArrowLeft size={16} /> Back</Button>
              {!q.kind && <Button variant="ghost" onClick={next} disabled={busy}>Skip</Button>}
              <Button onClick={next} disabled={busy}>{idx + 1 >= questions.length ? 'Finish' : 'Next'} <ArrowRight size={16} /></Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

function Question({ field, value, onChange }) {
  const v = value ?? ''
  const label = <>{field.label}{field.unit && field.type !== 'text' ? <small className="muted"> ({field.unit})</small> : field.unit ? <small className="muted"> ({field.unit})</small> : null}</>
  let input
  switch (field.type) {
    case 'textarea': input = <Field>{(a) => <textarea className="textarea" rows={4} autoFocus value={v} onChange={(e) => onChange(e.target.value)} {...a} />}</Field>; break
    case 'number': input = <Field>{(a) => <input className="input" type="number" step="any" autoFocus value={v} onChange={(e) => onChange(e.target.value)} {...a} />}</Field>; break
    case 'date': input = <Field>{(a) => <input className="input" type="date" autoFocus value={v} onChange={(e) => onChange(e.target.value)} {...a} />}</Field>; break
    case 'yesno': input = <div className="opts">{['Yes', 'No'].map((o) => <button key={o} type="button" className={`opt ${v === o ? 'on' : ''}`} onClick={() => onChange(o)}>{o}</button>)}</div>; break
    case 'select': input = <div className="opts">{field.options.map((o) => <button key={o} type="button" className={`opt ${v === o ? 'on' : ''}`} onClick={() => onChange(o)}>{o}</button>)}</div>; break
    case 'list': input = <Field>{(a) => <textarea className="textarea" rows={5} autoFocus placeholder="One per line" value={Array.isArray(value) ? value.join('\n') : v} onChange={(e) => onChange(e.target.value.split('\n'))} {...a} />}</Field>; break
    case 'kv': {
      const rows = Array.isArray(value) && value.length ? value : [{ k: '', v: '' }]
      const upd = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
      input = <div>{rows.map((r, i) => (
        <div className="kvrow" key={i}><input className="input" placeholder="Feature" value={r.k} onChange={(e) => upd(i, { k: e.target.value })} /><input className="input" placeholder="Specification" value={r.v} onChange={(e) => upd(i, { v: e.target.value })} />
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove row"><Trash2 size={14} /></Button></div>))}
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...rows, { k: '', v: '' }])}><Plus size={14} /> Add row</Button></div>
      break
    }
    default: input = <Field>{(a) => <input className="input" type={field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'} autoFocus placeholder={field.placeholder} value={v} onChange={(e) => onChange(e.target.value)} {...a} />}</Field>
  }
  return <><h2>{label}</h2>{field.help && <p className="muted">{field.help}</p>}{input}</>
}
