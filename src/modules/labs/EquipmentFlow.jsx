import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleAlert, ClipboardList, Cpu, FileText, FolderOpen, Info, Phone, Plus, Receipt, ShieldCheck, Trash2, Upload, Wrench, X } from 'lucide-react'
import { Badge, Button, Card, Field, Loader, useDialog, useToast } from '../../ui'
import { api, fileToBase64, openFile } from '../../core/api'
import { useAuth } from '../../core/auth'
import { empty, fileKindVisible, visible } from './spec'
import './labs.css'

const ICONS = { basic: Info, purchase: Receipt, financial: Receipt, technical: Cpu, template: Cpu, service: Wrench, warranty: Wrench, operation: ShieldCheck, operations: ShieldCheck, usage: BookOpen, documents: FolderOpen, contact: Phone }
const WEIGHT = { textarea: 2, list: 2, kv: 3, counts: 3 }
const WIDE = new Set(['textarea', 'list', 'kv', 'counts'])
const PAGE_WEIGHT = 14 // fields sit in two columns, so a page holds about fourteen weight units; only much bigger categories continue on a second page

/** The equipment form: one page per category with all its fields visible together. Everything autosaves. */
export default function EquipmentFlow() {
  const { college, id } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const owner = user.role === 'lab_incharge'
  const toast = useToast()
  const dialog = useDialog()
  const [state, setState] = useState(null)
  const [data, setData] = useState({})
  const [files, setFiles] = useState([])
  const [pageKey, setPageKey] = useState(null)
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

  const pages = useMemo(() => {
    if (!spec) return []
    const out = []
    for (const s of spec.sections) {
      const vis = s.fields.filter((f) => visible(f, data, hv))
      const kinds = s.files ? (s.files === true ? spec.fileKinds : spec.fileKinds.filter((k) => s.files.includes(k.key))).filter((k) => current || fileKindVisible(k.key, data, hv)) : []
      if (!vis.length && !kinds.length) continue
      const chunks = []; let cur = [], w = 0
      for (const f of vis) { const fw = WEIGHT[f.type] || 1; if (cur.length && w + fw > PAGE_WEIGHT) { chunks.push(cur); cur = []; w = 0 } cur.push(f); w += fw }
      if (cur.length || !chunks.length) chunks.push(cur)
      chunks.forEach((c, i) => out.push({ key: `${s.key}:${i}`, section: s, part: i + 1, parts: chunks.length, fields: c, kinds: i === chunks.length - 1 ? kinds : [] }))
    }
    return out
  }, [spec, data, hv, current])

  // Open at the first page that still has an empty field, so a returning in-charge continues where they stopped.
  useEffect(() => {
    if (started.current || !pages.length) return
    started.current = true
    setPageKey((pages.find((p) => p.fields.some((f) => empty(data[f.key]))) || pages[0]).key)
  }, [pages, data])

  const idx = Math.max(0, pages.findIndex((p) => p.key === pageKey))
  const page = pages[idx]
  const isLast = idx === pages.length - 1

  const persist = useCallback(async () => {
    const changed = {}
    for (const [k, v] of Object.entries(data)) if (JSON.stringify(saved.current[k]) !== JSON.stringify(v)) changed[k] = v
    if (!Object.keys(changed).length) { setSave('saved'); return true }
    setSave('saving')
    try { await api(`/c/${college}/equipment/${id}`, { method: 'PATCH', body: { data: changed } }); saved.current = { ...data }; setSave('saved'); return true }
    catch { setSave('error'); return false }
  }, [data, college, id])

  // Every change is saved by itself a moment after the last keystroke, so nothing is lost if the page is closed.
  useEffect(() => {
    if (!state) return undefined
    const t = setTimeout(() => { persist() }, 1000)
    return () => clearTimeout(t)
  }, [data, state, persist])

  const lost = () => dialog.error('We could not save just now. Please check your internet connection and try again. Your answers are still on this page.')
  const go = async (key) => { setBusy(true); await persist(); setPageKey(key); setBusy(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const exit = async () => { setBusy(true); if (await persist()) nav(owner ? `/c/${college}/lab` : `/c/${college}/lab-details/${state.equipment.labId}/review`); else await lost(); setBusy(false) }
  const submit = async () => {
    const ok = await dialog.confirm({ title: 'Send to your HOD?', message: 'Your HOD will review this equipment and approve it. You can still change it later; changes will also need approval.', confirmText: 'Send to HOD' })
    if (!ok) return
    setBusy(true)
    try { if (!(await persist())) { await lost(); return } await api(`/c/${college}/equipment/${id}/submit`, { method: 'POST' }); await dialog.success('Your HOD has been notified. After approval this equipment appears on the public pages.', 'Sent to your HOD'); nav(`/c/${college}/lab`) }
    catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  const set = (key, value) => setData((d) => ({ ...d, [key]: value }))
  const upload = async (kind, fileList) => {
    for (const file of fileList) {
      if (file.size > 8 * 1024 * 1024) { toast(`“${file.name}” is bigger than 8 MB. Please choose a smaller file or reduce its size.`, 'error'); continue }
      try {
        const r = await api(`/c/${college}/equipment/${id}/files`, { method: 'POST', body: { kind, filename: file.name, contentBase64: await fileToBase64(file) } })
        setFiles((f) => [...(kind === 'photos' ? f.filter((x) => x.kind !== 'photos') : f), r.file])
      } catch (e) { toast(e.message, 'error') }
    }
  }
  const removeFile = async (f) => {
    if (!(await dialog.confirm({ title: 'Remove this file?', message: `“${f.name}” will be removed from this equipment.`, confirmText: 'Remove', tone: 'danger' }))) return
    try { await api(`/c/${college}/files/${f.id}`, { method: 'DELETE' }); setFiles((x) => x.filter((y) => y.id !== f.id)) } catch (e) { toast(e.message, 'error') }
  }

  if (error) return <Card><p role="alert" style={{ color: 'var(--c-error)' }}>{error}</p></Card>
  if (!state || !page) return <div style={{ padding: 48, textAlign: 'center' }}><Loader label="Loading form…" /></div>

  const Icon = ICONS[page.section.key] || ClipboardList
  const qty = Math.max(1, Math.floor(Number(data.quantity) || 1))
  const cond = data.condition && typeof data.condition === 'object' ? data.condition : {}
  const repair = Math.min(qty, Math.floor(Number(cond.repair) || 0)), unused = Math.min(qty - repair, Math.floor(Number(cond.unused) || 0))
  const pageDone = (p) => p.fields.length ? p.fields.some((f) => !empty(data[f.key])) : p.kinds.some((k) => files.some((f) => f.kind === k.key))
  const answered = pages.reduce((t, p) => t + p.fields.filter((f) => !empty(data[f.key])).length, 0)
  const total = pages.reduce((t, p) => t + p.fields.length, 0)

  return (
    <div className="fp fade-up">
      <header className="fp-head">
        <div>
          <div className="row"><Badge tone="primary">{state.equipment.labName}</Badge><Badge>{spec.template?.label}</Badge></div>
          <h1>{data.name}{data.variant ? <small className="muted"> · {data.variant}</small> : null}</h1>
        </div>
        <div className="fp-head-r">
          <span className={`savebadge ${save}`} role="status" aria-live="polite">{save === 'saving' ? 'Saving…' : save === 'error' ? 'Not saved yet. Your answers are still here; we will keep trying.' : <><Check size={13} /> All changes saved</>}</span>
          <Button variant="ghost" size="sm" onClick={exit} disabled={busy}><X size={14} /> Save & close</Button>
        </div>
      </header>
      {state.equipment.published && <p className="helpbox"><Info size={15} /> {owner ? 'This equipment is already published. You can change anything: the public keeps seeing the approved version until your HOD approves your changes. When you finish, press “Send to HOD” on the last page.' : 'This equipment is published. Your changes go live when you approve the lab.'}</p>}

      <nav className="fp-steps" aria-label="Form pages">{pages.map((p, i) => (
        <button key={p.key} type="button" className={`fp-step ${p.key === page.key ? 'on' : ''} ${pageDone(p) ? 'done' : ''}`} onClick={() => go(p.key)}>
          <span className="n">{pageDone(p) && p.key !== page.key ? <Check size={13} /> : i + 1}</span><span className="t">{p.section.title.replace(/ \(all optional\)/, '')}{p.parts > 1 ? ` ${p.part}/${p.parts}` : ''}</span></button>))}
      </nav>

      <div className="fp-body">
        <main>
          <Card className="fp-card">
            <div className="fp-title"><span className="fp-ico"><Icon size={22} /></span><div><h2>{page.section.title.replace(/ \(all optional\)/, '')}{page.parts > 1 ? ` (page ${page.part} of ${page.parts})` : ''}</h2>{page.section.help && <p>{page.section.help}</p>}</div></div>
            {page.fields.length > 0 && <div className="fp-grid">{page.fields.map((f) => <div key={f.key} className={`fp-field ${WIDE.has(f.type) ? 'wide' : ''}`}><FieldInput field={f} value={data[f.key]} onChange={(v) => set(f.key, v)} data={data} /></div>)}</div>}
            {page.kinds.length > 0 && (
              <div className="fp-files">{page.kinds.map((k) => (
                <div key={k.key} className="fp-drop">
                  <div className="fp-drop-h"><b>{k.label}</b> <small className="muted">(optional)</small></div>
                  <p className="muted">{k.key === 'photos' ? 'One clear photo of the equipment (JPG or PNG). A new photo replaces the old one.' : 'PDF, photo, Word or Excel, up to 8 MB each. You can add it later.'}</p>
                  {files.filter((f) => f.kind === k.key).map((f) => (
                    <div key={f.id} className="filerow"><FileText size={15} /><a href="#" onClick={(e) => { e.preventDefault(); openFile(`/c/${college}/files/${f.id}`).catch((er) => toast(er.message, 'error')) }}>{f.name}</a><span className="muted">{Math.ceil(f.size / 1024)} KB</span><span className="spacer" /><Button variant="ghost" size="sm" onClick={() => removeFile(f)} aria-label={`Remove ${f.name}`}><Trash2 size={14} /></Button></div>))}
                  <label className="btn btn-ghost" style={{ cursor: 'pointer' }}><Upload size={16} /> Choose file{k.key === 'photos' ? '' : '(s)'}
                    <input type="file" multiple={k.key !== 'photos'} hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" onChange={(e) => { upload(k.key, [...e.target.files]); e.target.value = '' }} /></label>
                </div>))}</div>)}
          </Card>

          {isLast && (
            <Card className="fp-card fp-review">
              <div className="fp-title"><span className="fp-ico ok"><Check size={22} /></span><div><h2>Review and send</h2><p>You answered <b>{answered}</b> of {total} questions. Anything left blank is simply not shown. Nothing is lost if you leave now: open the equipment from your list and choose <b>Continue</b>.</p></div></div>
              <ul className="stepsum">{pages.map((p) => { const a = p.fields.filter((f) => !empty(data[f.key])).length; return <li key={p.key}><button type="button" className="linklike" onClick={() => go(p.key)}>{p.section.title.replace(/ \(all optional\)/, '')}{p.parts > 1 ? ` ${p.part}/${p.parts}` : ''}</button><span className="muted">{p.fields.length ? `${a} of ${p.fields.length} answered` : 'uploads only'}</span></li> })}</ul>
              <div className="row" style={{ justifyContent: 'flex-end' }}>{owner ? <Button onClick={submit} disabled={busy}><Check size={16} /> Send to HOD</Button> : <Button onClick={exit} disabled={busy}><Check size={16} /> Done, back to lab review</Button>}</div>
            </Card>)}
        </main>

        <aside className="fp-side">
          <Card className="eqcard">
            <span className="eq-k">This equipment</span><h3>{data.name}</h3><p className="muted">{spec.template?.label} · {state.equipment.labName}</p>
            <div className="eq-stats"><div><b>{qty}</b><span>units</span></div><div><b className="g">{qty - repair - unused}</b><span>working</span></div><div><b className="o">{repair}</b><span>repair</span></div><div><b className="p">{unused}</b><span>not in use</span></div></div>
            <div className="bar" aria-hidden="true"><i style={{ width: `${Math.round((answered / Math.max(1, total)) * 100)}%` }} /></div>
            <small className="muted">{answered} of {total} answers filled</small>
          </Card>
          <Card className="tipcard"><h4><Info size={15} /> Tips</h4><ul><li>Skip anything you do not know. You can come back and add it later.</li><li>Everything saves by itself. Use the steps above to jump to any page.</li><li>Write in your own words, a short line is enough.</li></ul></Card>
        </aside>
      </div>

      <div className="fp-bar"><Button variant="ghost" onClick={() => go(pages[idx - 1].key)} disabled={busy || idx === 0}><ArrowLeft size={16} /> Back</Button>
        <span className="muted fp-pos">Page {idx + 1} of {pages.length}</span>
        {isLast ? (owner ? <Button onClick={submit} disabled={busy}><Check size={16} /> Send to HOD</Button> : <Button onClick={exit} disabled={busy}><Check size={16} /> Done</Button>) : <Button onClick={() => go(pages[idx + 1].key)} disabled={busy}>Next <ArrowRight size={16} /></Button>}</div>
    </div>
  )
}

function FieldInput({ field, value, onChange, data }) {
  const v = value ?? ''
  const label = <>{field.label}{field.unit ? <small className="muted"> ({field.unit})</small> : null}</>
  const hint = <>{field.help}{field.example && <span className="eg"> {field.help ? ' ' : ''}Example: {field.example}</span>}</>
  const has = field.help || field.example
  switch (field.type) {
    case 'counts': {
      const qty = Math.max(1, Math.floor(Number(data.quantity) || 1))
      const c = value && typeof value === 'object' ? value : {}
      const n = (x) => Math.max(0, Math.floor(Number(x) || 0))
      const repair = n(c.repair), unused = n(c.unused), working = qty - repair - unused
      const set = (patch) => onChange({ repair, unused, note: c.note || '', ...patch })
      return (
        <div className="field counts-q"><label>{label}</label>{has && <span className="hint">{hint}</span>}
          <p>You have <b>{qty}</b> unit{qty === 1 ? '' : 's'} (from “How many do you have?”).</p>
          <div className="grid cols-3">
            <label className="field"><span>Needs repair</span><input className="input" type="number" min="0" max={qty} value={repair || ''} placeholder="0" onChange={(e) => set({ repair: n(e.target.value) })} /></label>
            <label className="field"><span>Not in use / beyond repair</span><input className="input" type="number" min="0" max={qty} value={unused || ''} placeholder="0" onChange={(e) => set({ unused: n(e.target.value) })} /></label>
            <div className="field"><span>Working</span><div className={`workbox ${working < 0 ? 'bad' : ''}`}>{working < 0 ? '–' : working} <small>of {qty}</small></div></div>
          </div>
          {working < 0 && <p className="warn"><CircleAlert size={15} /> That is more than the {qty} unit{qty === 1 ? '' : 's'} you have. Please check the numbers.</p>}
          {(repair > 0 || unused > 0) && <label className="field"><span>What is wrong? (optional)</span><input className="input" value={c.note || ''} placeholder="e.g. 2 units have a faulty display" onChange={(e) => set({ note: e.target.value })} /></label>}
        </div>)
    }
    case 'textarea': return <Field label={label} hint={has && hint}>{(a) => <textarea className="textarea" rows={2} value={v} onChange={(e) => onChange(e.target.value)} {...a} />}</Field>
    case 'number': return <Field label={label} hint={has && hint}>{(a) => <input className="input" type="number" step="any" value={v} onChange={(e) => onChange(e.target.value)} {...a} />}</Field>
    case 'date': return <Field label={label} hint={has && hint}>{(a) => <input className="input" type="date" value={v} onChange={(e) => onChange(e.target.value)} {...a} />}</Field>
    case 'yesno': return <div className="field"><label>{label}</label>{has && <span className="hint">{hint}</span>}<div className="opts">{['Yes', 'No'].map((o) => <button key={o} type="button" className={`opt ${v === o ? 'on' : ''}`} onClick={() => onChange(v === o ? '' : o)}>{o}</button>)}</div></div>
    case 'select': return <div className="field"><label>{label}</label>{has && <span className="hint">{hint}</span>}<div className="opts">{field.options.map((o) => <button key={o} type="button" className={`opt ${v === o ? 'on' : ''}`} onClick={() => onChange(v === o ? '' : o)}>{o}</button>)}</div></div>
    case 'list': return <Field label={label} hint={has && hint}>{(a) => <textarea className="textarea" rows={4} placeholder="One per line" value={Array.isArray(value) ? value.join('\n') : v} onChange={(e) => onChange(e.target.value.split('\n'))} {...a} />}</Field>
    case 'kv': {
      const rows = Array.isArray(value) && value.length ? value : [{ k: '', v: '' }]
      const upd = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
      return (
        <div className="field"><label>{label}</label>{has && <span className="hint">{hint}</span>}
          {rows.map((r, i) => (
            <div className="kvrow" key={i}><input className="input" placeholder="Feature, e.g. Bandwidth" value={r.k} onChange={(e) => upd(i, { k: e.target.value })} /><input className="input" placeholder="Value, e.g. 100 MHz" value={r.v} onChange={(e) => upd(i, { v: e.target.value })} />
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove row"><Trash2 size={14} /></Button></div>))}
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...rows, { k: '', v: '' }])}><Plus size={14} /> Add row</Button></div>)
    }
    default: return <Field label={label} hint={has && hint}>{(a) => <input className="input" type={field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'} placeholder={field.placeholder} value={v} onChange={(e) => onChange(e.target.value)} {...a} />}</Field>
  }
}
