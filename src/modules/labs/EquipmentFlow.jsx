import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CircleAlert, Info, Plus, Trash2, Upload, X } from 'lucide-react'
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
  const started = useRef(false)
  const [save, setSave] = useState('saved') // saved | saving | error

  useEffect(() => {
    api(`/c/${college}/equipment/${id}`).then((r) => {
      if (!r.can.edit) return nav(`/c/${college}/equipment/${id}`, { replace: true })
      setState(r); setData(r.equipment.data); saved.current = r.equipment.data; setFiles(r.files)
    }).catch((e) => setError(e.message))
  }, [college, id, nav])

  const spec = state?.spec
  const hv = spec?.highValueLakhs ?? 1.5
  const current = !!spec?.current
  const questions = useMemo(() => {
    if (!spec) return []
    const out = []
    for (const s of spec.sections) {
      for (const f of s.fields) if (visible(f, data, hv)) out.push({ key: f.key, section: s, field: f })
      if (s.files) { const kinds = s.files === true ? spec.fileKinds : spec.fileKinds.filter((k) => s.files.includes(k.key)); for (const k of kinds) if (current || fileKindVisible(k.key, data, hv)) out.push({ key: `file:${k.key}`, section: s, kind: k }) }
    }
    return out
  }, [spec, data, hv, current])

  const at = cursor ?? questions[0]?.key
  const idx = at === 'review' ? questions.length : Math.max(0, questions.findIndex((q) => q.key === at))
  const q = questions[idx]
  const fileQs = questions.filter((x) => x.kind).length
  const answered = questions.filter((x) => x.field && !empty(data[x.field.key])).length

  // Open at the first question that is still empty, so a returning in-charge continues where they stopped.
  useEffect(() => {
    if (started.current || !questions.length) return
    started.current = true
    const firstEmpty = questions.find((x) => x.field && empty(data[x.field.key]))
    setCursor(firstEmpty ? firstEmpty.key : questions[0].key)
  }, [questions, data])

  const persist = useCallback(async () => {
    const changed = {}
    for (const [k, v] of Object.entries(data)) if (JSON.stringify(saved.current[k]) !== JSON.stringify(v)) changed[k] = v
    if (!Object.keys(changed).length) { setSave('saved'); return true }
    setSave('saving')
    try { await api(`/c/${college}/equipment/${id}`, { method: 'PATCH', body: { data: changed } }); saved.current = { ...data }; setSave('saved'); return true }
    catch { setSave('error'); return false }
  }, [data, college, id])

  // Every answer is saved by itself a moment after the last change, so nothing is lost if the page is closed.
  useEffect(() => {
    if (!state) return undefined
    const t = setTimeout(() => { persist() }, 1000)
    return () => clearTimeout(t)
  }, [data, state, persist])

  const go = async (to) => { setBusy(true); const ok = await persist(); if (ok || to) setCursor(to); setBusy(false) }
  const next = () => go(idx + 1 >= questions.length ? 'review' : questions[idx + 1].key)
  const back = () => idx > 0 && go(questions[at === 'review' ? questions.length - 1 : idx - 1].key)
  const exit = async () => { setBusy(true); if (await persist()) nav(`/c/${college}/lab`); else toast('We could not save just now. Please check your internet connection and try again.', 'error'); setBusy(false) }
  const submit = async () => {
    setBusy(true)
    try { if (!(await persist())) { toast('We could not save just now. Please check your internet connection and try again.', 'error'); return } await api(`/c/${college}/equipment/${id}/submit`, { method: 'POST' }); toast('Sent to your HOD for approval'); nav(`/c/${college}/lab`) }
    catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  const set = (key, value) => setData((d) => ({ ...d, [key]: value }))
  const upload = async (kind, fileList) => {
    for (const file of fileList) {
      if (file.size > 8 * 1024 * 1024) { toast(`“${file.name}” is bigger than 8 MB. Please choose a smaller file.`, 'error'); continue }
      try {
        const r = await api(`/c/${college}/equipment/${id}/files`, { method: 'POST', body: { kind, filename: file.name, contentBase64: await fileToBase64(file) } })
        setFiles((f) => [...(kind === 'photos' ? f.filter((x) => x.kind !== 'photos') : f), r.file])
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
        <span className={`savebadge ${save}`} role="status" aria-live="polite">{save === 'saving' ? 'Saving…' : save === 'error' ? 'Not saved yet. Your answers are still here; we will keep trying.' : <><Check size={13} /> All changes saved</>}</span>
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
            <ul className="stepsum">{sections.filter((s) => questions.some((x) => x.section.key === s.key)).map((s) => { const qs = questions.filter((x) => x.section.key === s.key && x.field); const done = qs.filter((x) => !empty(data[x.field.key])).length; return <li key={s.key}><button type="button" className="linklike" onClick={() => jump(s.key)}>{s.title}</button><span className="muted">{qs.length ? `${done} of ${qs.length} answered` : 'uploads only'}</span></li> })}</ul>
            <p className="muted">You can still go back to any step above. Nothing is lost if you leave now: open the equipment from your list and choose <b>Continue</b>.</p>
            <div className="flow-nav"><Button variant="ghost" onClick={back} disabled={busy}><ArrowLeft size={16} /> Back</Button>
              <Button onClick={submit} disabled={busy}><Check size={16} /> Send to HOD for approval</Button></div>
          </>
        ) : q && (
          <>
            <span className="sec">{q.section.title} · question {idx + 1} of {questions.length}</span>
            {q.section.help && <p className="helpbox"><Info size={15} /> {q.section.help}</p>}
            {q.kind ? (
              <>
                <h2>{q.kind.label} <small className="muted" style={{ fontSize: 14 }}>(optional)</small></h2>
                <p className="muted">{q.kind.key === 'photos' ? 'Add one clear photo of the equipment (JPG or PNG). A new photo replaces the old one.' : 'PDF, photo, Word or Excel, up to 8 MB each. You can skip this and add it later.'}</p>
                {files.filter((f) => f.kind === q.kind.key).map((f) => (
                  <div key={f.id} className="filerow"><a href="#" onClick={(e) => { e.preventDefault(); openFile(`/c/${college}/files/${f.id}`).catch((er) => toast(er.message, 'error')) }}>{f.name}</a><span className="muted">{Math.ceil(f.size / 1024)} KB</span><span className="spacer" /><Button variant="ghost" size="sm" onClick={() => removeFile(f.id)} aria-label="Remove"><Trash2 size={14} /></Button></div>
                ))}
                <label className="btn btn-ghost" style={{ cursor: 'pointer' }}><Upload size={16} /> Choose file(s)
                  <input type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" onChange={(e) => { upload(q.kind.key, [...e.target.files]); e.target.value = '' }} /></label>
              </>
            ) : <Question field={q.field} value={data[q.field.key]} onChange={(v) => set(q.field.key, v)} data={data} />}
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

function Question({ field, value, onChange, data }) {
  const v = value ?? ''
  const label = <>{field.label}{field.unit && field.type !== 'text' ? <small className="muted"> ({field.unit})</small> : field.unit ? <small className="muted"> ({field.unit})</small> : null}</>
  let input
  switch (field.type) {
    case 'counts': {
      const qty = Math.max(1, Math.floor(Number(data.quantity) || 1))
      const c = value && typeof value === 'object' ? value : {}
      const n = (x) => Math.max(0, Math.floor(Number(x) || 0))
      const repair = n(c.repair), unused = n(c.unused), working = qty - repair - unused
      const set = (patch) => onChange({ repair, unused, note: c.note || '', ...patch })
      input = (
        <div className="counts-q">
          <p>You have <b>{qty}</b> unit{qty === 1 ? '' : 's'} (from “How many do you have?”).</p>
          <div className="grid cols-2">
            <label className="field"><span>Needs repair</span><input className="input" type="number" min="0" max={qty} value={repair || ''} placeholder="0" onChange={(e) => set({ repair: n(e.target.value) })} /></label>
            <label className="field"><span>Not in use / beyond repair</span><input className="input" type="number" min="0" max={qty} value={unused || ''} placeholder="0" onChange={(e) => set({ unused: n(e.target.value) })} /></label>
          </div>
          <p className={working < 0 ? 'warn' : 'okcount'}>{working < 0 ? <><CircleAlert size={15} /> That is more than the {qty} unit{qty === 1 ? '' : 's'} you have. Please check the numbers.</> : <>Working: <b>{working}</b> of {qty}</>}</p>
          {(repair > 0 || unused > 0) && <label className="field"><span>What is wrong? (optional)</span><input className="input" value={c.note || ''} placeholder="e.g. 2 units have a faulty display" onChange={(e) => set({ note: e.target.value })} /></label>}
        </div>)
      break
    }
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
  return <><h2>{label}</h2>{field.help && <p className="muted">{field.help}</p>}{field.example && <p className="muted eg">Example: {field.example}</p>}{input}</>
}
