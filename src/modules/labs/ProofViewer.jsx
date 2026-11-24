import { useEffect, useState } from 'react'
import { Eye, FileText } from 'lucide-react'
import { Button, Loader, Modal } from '../../ui'
import { api, getToken } from '../../core/api'
import { useAuth } from '../../core/auth'
import './proof.css'

const ext = (name) => String(name || '').split('.').pop().toLowerCase()

function Sheet({ rows }) {
  return <div className="proof-scroll"><table className="proof-table"><tbody>{rows.map((r, i) => <tr key={i}><th>{i + 1}</th>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
}

function Body({ college, file }) {
  const [state, setState] = useState({ loading: true })
  useEffect(() => {
    let on = true, url = ''
    const e = ext(file.name)
    const done = (s) => on && setState(s)
    if (['png', 'jpg', 'jpeg', 'webp', 'pdf'].includes(e)) {
      fetch(`/api/c/${college}/files/${file.id}`, { headers: { Authorization: `Bearer ${getToken()}` } })
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('x'))))
        .then((b) => { url = URL.createObjectURL(b); done({ kind: e === 'pdf' ? 'pdf' : 'img', url }) })
        .catch(() => done({ kind: 'error' }))
    } else {
      api(`/c/${college}/files/${file.id}/preview`).then((p) => done({ kind: p.type, p })).catch(() => done({ kind: 'error' }))
    }
    return () => { on = false; if (url) URL.revokeObjectURL(url) }
  }, [college, file.id, file.name])

  if (state.loading) return <div style={{ padding: 48, textAlign: 'center' }}><Loader label="Opening…" /></div>
  if (state.kind === 'img') return <img className="proof-img" src={state.url} alt={file.name} draggable={false} />
  if (state.kind === 'pdf') return <embed className="proof-pdf" src={`${state.url}#toolbar=0&navpanes=0&statusbar=0`} type="application/pdf" />
  if (state.kind === 'doc') return (
    <div className="proof-doc">{state.p.blocks.map((b, i) => b.t === 'table'
      ? <div key={i} className="proof-scroll"><table className="proof-table"><tbody>{b.rows.map((r, a) => <tr key={a}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
      : b.h ? <h4 key={i}>{b.text}</h4> : <p key={i}>{b.text}</p>)}
    {!state.p.blocks.length && <p className="muted">This document has no readable text.</p>}</div>)
  if (state.kind === 'sheet') return <div>{state.p.sheets.map((s, i) => <div key={i}><h4 className="proof-sheet">{s.name}</h4><Sheet rows={s.rows} /></div>)}</div>
  if (state.kind === 'none') return <p className="helpbox">A preview is not available for this older file format (.doc or .xls). Ask the in-charge to upload it again as .docx / .xlsx or PDF.</p>
  return <p className="helpbox" role="alert">The file could not be opened. Please try again.</p>
}

/** View-only window for an uploaded file: no download, print or save controls, with the viewer's name as a watermark. */
export function ProofViewer({ college, file, onClose }) {
  const { user } = useAuth()
  const stamp = `SVES Connect · ${user?.name || user?.email || ''} · ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`
  useEffect(() => {
    const block = (e) => { if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'c', 'u'].includes(e.key.toLowerCase())) e.preventDefault() }
    window.addEventListener('keydown', block)
    return () => window.removeEventListener('keydown', block)
  }, [])
  return (
    <Modal size="lg" open title={`Proof: ${file.name}`} onClose={onClose}>
      <div className="proof-stage" onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()}>
        <Body college={college} file={file} />
        <div className="proof-wm" aria-hidden="true">{Array.from({ length: 90 }, (_, i) => <span key={i}>{stamp}</span>)}</div>
      </div>
      <p className="muted proof-note">View only. This window cannot download or print the file.</p>
    </Modal>
  )
}

/** One uploaded file with its "Show proof" button. */
export function FileLine({ college, file }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="proof-line"><FileText size={14} /><span className="proof-name">{file.name}</span>
      <Button variant="ghost" size="sm" className="no-print" onClick={() => setOpen(true)}><Eye size={14} /> Show proof</Button>
      {open && <ProofViewer college={college} file={file} onClose={() => setOpen(false)} />}</div>
  )
}
