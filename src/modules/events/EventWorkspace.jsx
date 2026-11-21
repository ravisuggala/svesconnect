import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Download, Eye, Globe, Lock, Pencil, Plus, Trash2, UploadCloud, UserPlus } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Skeleton, useDialog, useToast } from '../../ui'
import { api, downloadFile, fileToBase64, openFile } from '../../core/api'
import './events.css'

// One event's workspace: folders (made from the file metadata), upload with attributes, people, and what the public will see.
const NEW = '__new__'
const size = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
const EMPTY_UP = { files: [], folder: '', newFolder: '', subfolder: '', title: '', description: '', contributor: '', fileDate: '', tags: '', isPublic: true }

export default function EventWorkspace() {
  const { college, id } = useParams()
  const toast = useToast()
  const dialog = useDialog()
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('files')
  const [sel, setSel] = useState({ folder: '', sub: '' })
  const [up, setUp] = useState(null)
  const [edit, setEdit] = useState(null)
  const [info, setInfo] = useState(null)
  const [person, setPerson] = useState(null)
  const [creds, setCreds] = useState(null)
  const [busy, setBusy] = useState(false)
  const base = `/c/${college}`

  const load = useCallback(() => api(`${base}/events/${id}`).then((r) => { setD(r); setError('') }).catch((e) => setError(e.message)), [base, id])
  useEffect(() => { load() }, [load])

  // Folder tree = the type's starting folders + every folder/sub-folder that files have created.
  const tree = useMemo(() => {
    if (!d) return []
    const m = new Map(d.defaultFolders.map((f) => [f.name, new Map()]))
    for (const f of d.files) { if (!m.has(f.folder)) m.set(f.folder, new Map()); if (f.subfolder) m.get(f.folder).set(f.subfolder, 0) }
    return [...m.entries()].map(([name, subs]) => ({ name, subs: [...subs.keys()], count: d.files.filter((f) => f.folder === name).length }))
  }, [d])
  const shown = d ? d.files.filter((f) => (!sel.folder || f.folder === sel.folder) && (!sel.sub || f.subfolder === sel.sub)) : []

  if (error) return <EmptyState title="Not available">{error}</EmptyState>
  if (!d) return <Skeleton h={240} />
  const { event: ev, can } = d

  const suggest = (name) => {
    const n = name.toLowerCase()
    return d.defaultFolders.find((f) => f.hints.some((h) => n.includes(h)))?.name || (/\.(jpe?g|png|gif|webp)$/.test(n) ? 'Photos' : '')
  }
  const pickFiles = (e) => {
    const files = [...e.target.files]
    const folder = up.folder || suggest(files[0]?.name || '') || d.defaultFolders[0]?.name || ''
    const def = d.defaultFolders.find((f) => f.name === folder)
    setUp({ ...up, files, folder, isPublic: def ? def.public : true })
  }
  const setFolder = (folder) => { const def = d.defaultFolders.find((f) => f.name === folder); setUp({ ...up, folder, isPublic: def ? def.public : true }) }

  const upload = async (e) => {
    e.preventDefault()
    if (!up.files.length) return toast('Choose at least one file.', 'error')
    const folder = up.folder === NEW ? up.newFolder.trim() : up.folder
    if (!folder) return toast('Choose or name a folder.', 'error')
    setBusy(true)
    let ok = 0
    for (const f of up.files) {
      try {
        await api(`${base}/events/${id}/files`, { method: 'POST', body: { filename: f.name, contentBase64: await fileToBase64(f), folder, subfolder: up.subfolder, title: up.files.length === 1 ? up.title : '', description: up.description, contributor: up.contributor, fileDate: up.fileDate, tags: up.tags, isPublic: up.isPublic } })
        ok++
      } catch (err) { toast(`${f.name}: ${err.message}`, 'error') }
    }
    setBusy(false)
    if (ok) { toast(`${ok} file${ok > 1 ? 's' : ''} added to ${folder}`); setUp(null); load() }
  }
  const saveEdit = async (e) => {
    e.preventDefault(); setBusy(true)
    try { await api(`${base}/event-files/${edit.id}`, { method: 'PATCH', body: { ...edit, tags: edit.tags } }); setEdit(null); load(); toast('Saved') } catch (err) { toast(err.message, 'error') } finally { setBusy(false) }
  }
  const remove = async (f) => {
    if (!(await dialog.confirm({ title: 'Delete this file?', message: `“${f.title}” will be deleted. This cannot be undone.`, confirmText: 'Delete', tone: 'danger' }))) return
    try { await api(`${base}/event-files/${f.id}`, { method: 'DELETE' }); load() } catch (err) { toast(err.message, 'error') }
  }
  const publish = async () => {
    const on = ev.status !== 'published'
    if (on && !(await dialog.confirm({ title: 'Publish this event?', message: 'The summary and the files marked Public become visible to everyone.', confirmText: 'Publish' }))) return
    try { await api(`${base}/events/${id}/publish`, { method: 'POST', body: { published: on } }); load(); toast(on ? 'Event published' : 'Event unpublished') } catch (err) { toast(err.message, 'error') }
  }
  const saveInfo = async (e) => {
    e.preventDefault(); setBusy(true)
    try { await api(`${base}/events/${id}`, { method: 'PATCH', body: info }); setInfo(null); load(); toast('Saved') } catch (err) { toast(err.message, 'error') } finally { setBusy(false) }
  }
  const addPerson = async (e) => {
    e.preventDefault(); setBusy(true)
    try { const r = await api(`${base}/events/${id}/people`, { method: 'POST', body: person }); setPerson(null); setCreds({ email: r.email, password: r.initialPassword }); load() } catch (err) { toast(err.message, 'error') } finally { setBusy(false) }
  }
  const act = async (u, action) => {
    if (action === 'reset' && !(await dialog.confirm({ title: 'Reset password?', message: `The password of ${u.email} will go back to the default password.`, confirmText: 'Reset password', tone: 'warning' }))) return
    try { const r = await api(`${base}/events/${id}/people/${u.id}`, { method: 'PATCH', body: { action } }); if (action === 'reset') setCreds({ email: u.email, password: r.initialPassword, reset: true }); load() } catch (err) { toast(err.message, 'error') }
  }
  const folderOptions = [...d.defaultFolders.map((f) => f.name), ...tree.map((t) => t.name).filter((n) => !d.defaultFolders.some((f) => f.name === n))]

  return (
    <div className="fade-up">
      <div className="counts"><Badge tone="primary">{ev.type}</Badge>{ev.academicYear && <Badge>{ev.academicYear}</Badge>}{ev.department && <Badge>{ev.department}</Badge>}
        <Badge tone={ev.status === 'published' ? 'success' : 'warning'}>{ev.status === 'published' ? 'Published' : 'Not published'}</Badge></div>
      <div className="row" style={{ flexWrap: 'wrap' }}><h2 style={{ margin: 0 }}>{ev.name}</h2><span className="spacer" />
        {can.manage && <Button variant="ghost" onClick={() => setInfo({ name: ev.name, academicYear: ev.academicYear || '', eventDate: ev.eventDate || '', venue: ev.venue || '', description: ev.description })}><Pencil size={14} /> Edit details</Button>}
        {ev.status === 'published' && <Button as={Link} variant="ghost" to={`/events/${ev.id}`} target="_blank"><Globe size={14} /> Public page</Button>}
        {can.publish && <Button onClick={publish} variant={ev.status === 'published' ? 'ghost' : 'primary'}>{ev.status === 'published' ? 'Unpublish' : 'Publish event'}</Button>}</div>
      <p className="muted">{[ev.eventDate, ev.venue].filter(Boolean).join(' · ') || 'Add the date and venue in “Edit details”.'}</p>

      <div className="ev-tabs">{[['files', `Files (${d.files.length})`], ['people', `People (${d.people.length})`], ['public', 'Public summary']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === 'files' && (
        <>
          {can.manage && <div className="row" style={{ marginBottom: 'var(--s-3)' }}><Button onClick={() => setUp(EMPTY_UP)}><UploadCloud size={16} /> Upload files</Button>
            <span className="muted">Each file gets its folder from the details you give. Everyone in this event can view and download.</span></div>}
          <div className="ev-split">
            <nav className="ev-tree" aria-label="Folders">
              <button className={!sel.folder ? 'on' : ''} onClick={() => setSel({ folder: '', sub: '' })}><span>All files</span><small>{d.files.length}</small></button>
              {tree.map((t) => (<div key={t.name}>
                <button className={sel.folder === t.name && !sel.sub ? 'on' : ''} onClick={() => setSel({ folder: t.name, sub: '' })}><span>{t.name}</span><small>{t.count}</small></button>
                {t.subs.map((s) => <button key={s} className={`sub ${sel.folder === t.name && sel.sub === s ? 'on' : ''}`} onClick={() => setSel({ folder: t.name, sub: s })}><span>↳ {s}</span><small>{d.files.filter((f) => f.folder === t.name && f.subfolder === s).length}</small></button>)}
              </div>))}
            </nav>
            <div>
              {!shown.length ? <EmptyState title="No files here yet" icon={UploadCloud}>{can.manage ? 'Use “Upload files” to add the first one.' : 'The coordinator has not added files to this folder.'}</EmptyState> : shown.map((f) => (
                <div className="ev-file" key={f.id}>
                  <div className="body"><h4>{f.title}</h4>
                    <p className="muted">{[`${f.folder}${f.subfolder ? ` › ${f.subfolder}` : ''}`, f.contributor && `Credit: ${f.contributor}`, f.fileDate, size(f.size)].filter(Boolean).join(' · ')}</p>
                    {f.description && <p>{f.description}</p>}{f.summary && <p className="muted"><i>Summary: {f.summary}</i></p>}
                    <div className="counts" style={{ margin: 0 }}><Badge tone={f.isPublic ? 'success' : ''}>{f.isPublic ? <><Globe size={11} /> Public</> : <><Lock size={11} /> Team only</>}</Badge>{f.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div></div>
                  <div className="row" style={{ gap: 4 }}>
                    <Button variant="ghost" size="sm" aria-label="View" onClick={() => openFile(`${base}/event-files/${f.id}`).catch((e) => toast(e.message, 'error'))}><Eye size={14} /></Button>
                    <Button variant="ghost" size="sm" aria-label="Download" onClick={() => downloadFile(`${base}/event-files/${f.id}`, f.name).catch((e) => toast(e.message, 'error'))}><Download size={14} /></Button>
                    {can.manage && <Button variant="ghost" size="sm" aria-label="Edit" onClick={() => setEdit({ ...f, tags: f.tags.join(', ') })}><Pencil size={14} /></Button>}
                    {can.manage && <Button variant="ghost" size="sm" aria-label="Delete" onClick={() => remove(f)}><Trash2 size={14} /></Button>}
                  </div>
                </div>))}
            </div>
          </div>
        </>)}

      {tab === 'people' && (
        <>
          <div className="row" style={{ marginBottom: 'var(--s-3)' }}>
            <p className="muted" style={{ margin: 0, flex: 1 }}>Everyone listed here signs in with the normal login page and lands on this event. The coordinator uploads; team members can view and download every file.</p>
            {can.addPeople && <Button onClick={() => setPerson({ email: '', name: '', role: 'event_member' })}><UserPlus size={16} /> Add person</Button>}</div>
          {d.people.map((u) => (
            <div className="ev-file" key={u.id}><div className="body"><h4>{u.name}</h4><p className="muted">{u.email}</p></div>
              <Badge tone={u.role === 'event_coordinator' ? 'primary' : ''}>{u.role === 'event_coordinator' ? 'Coordinator' : 'Team member'}</Badge>
              <Badge tone={u.status === 'active' ? 'success' : 'error'}>{u.status === 'active' ? 'Active' : 'Disabled'}</Badge>
              {can.addPeople && <span className="row" style={{ gap: 4 }}><Button variant="ghost" size="sm" onClick={() => act(u, 'reset')}>Reset password</Button><Button variant="ghost" size="sm" onClick={() => act(u, u.status === 'active' ? 'disable' : 'enable')}>{u.status === 'active' ? 'Disable' : 'Enable'}</Button></span>}
            </div>))}
          {!d.people.length && <EmptyState title="No one assigned yet">Add the event coordinator first.</EmptyState>}
        </>)}

      {tab === 'public' && (
        <Card>
          <h3>What the public sees</h3>
          <p className="muted">Built from the details above and the files marked <b>Public</b>. {ev.status === 'published' ? 'This event is published.' : 'It is not visible until the HOD publishes the event.'}</p>
          <p style={{ maxWidth: '78ch' }}>{d.publicPreview.overview}</p>
          <p className="muted">{d.publicPreview.stats.files} public files · {d.publicPreview.stats.photos} photos · {d.publicPreview.stats.folders} folders{d.publicPreview.credits.length ? ` · Credit: ${d.publicPreview.credits.join(', ')}` : ''}</p>
          {d.publicPreview.highlights.map((h) => <div className="ev-hl" key={h.fileId}>{h.text}<br /><small>{h.folder} · {h.source}</small></div>)}
          {!d.publicPreview.highlights.length && <p className="muted">Highlights appear here when public files contain readable text (PDF, Word, PowerPoint, text) or a description.</p>}
        </Card>)}

      <Modal open={!!up} title="Upload files" onClose={() => setUp(null)}>
        {up && <form onSubmit={upload} noValidate>
          <div className="field"><label>Files (PDF, photos, Word/Excel/PowerPoint, CAD, ZIP … up to 8 MB each)</label><input className="input" type="file" multiple onChange={pickFiles} /></div>
          <Select label="Folder" value={up.folder} onChange={(e) => setFolder(e.target.value)} hint="Suggested from the file name. Choose “New folder” for anything else."
            options={[{ value: '', label: 'Select…' }, ...folderOptions, { value: NEW, label: '+ New folder…' }]} />
          {up.folder === NEW && <Input label="New folder name" value={up.newFolder} onChange={(e) => setUp({ ...up, newFolder: e.target.value })} />}
          <Input label="Sub-folder (optional)" value={up.subfolder} onChange={(e) => setUp({ ...up, subfolder: e.target.value })} hint="For example: Round 1, Team A, Day 2." />
          {up.files.length <= 1 && <Input label="Title (optional)" value={up.title} onChange={(e) => setUp({ ...up, title: e.target.value })} hint="Defaults to the file name." />}
          <div className="field"><label>Description (optional)</label><textarea className="textarea" rows={2} value={up.description} onChange={(e) => setUp({ ...up, description: e.target.value })} /></div>
          <div className="grid cols-2"><Input label="Credit / contributor" value={up.contributor} onChange={(e) => setUp({ ...up, contributor: e.target.value })} /><Input label="Date of the content" value={up.fileDate} onChange={(e) => setUp({ ...up, fileDate: e.target.value })} /></div>
          <Input label="Tags (comma separated)" value={up.tags} onChange={(e) => setUp({ ...up, tags: e.target.value })} />
          <label className="row" style={{ margin: 'var(--s-3) 0' }}><input type="checkbox" checked={up.isPublic} onChange={(e) => setUp({ ...up, isPublic: e.target.checked })} /> Show publicly once the event is published</label>
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button type="button" variant="ghost" onClick={() => setUp(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</Button></div>
        </form>}
      </Modal>

      <Modal open={!!edit} title="Edit file details" onClose={() => setEdit(null)}>
        {edit && <form onSubmit={saveEdit}>
          <Input label="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          <div className="grid cols-2"><Input label="Folder" value={edit.folder} onChange={(e) => setEdit({ ...edit, folder: e.target.value })} list="ev-folders" /><Input label="Sub-folder" value={edit.subfolder} onChange={(e) => setEdit({ ...edit, subfolder: e.target.value })} /></div>
          <datalist id="ev-folders">{folderOptions.map((f) => <option key={f} value={f} />)}</datalist>
          <div className="field"><label>Description</label><textarea className="textarea" rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
          <div className="grid cols-2"><Input label="Credit / contributor" value={edit.contributor} onChange={(e) => setEdit({ ...edit, contributor: e.target.value })} /><Input label="Date" value={edit.fileDate} onChange={(e) => setEdit({ ...edit, fileDate: e.target.value })} /></div>
          <Input label="Tags" value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} />
          <label className="row" style={{ margin: 'var(--s-3) 0' }}><input type="checkbox" checked={edit.isPublic} onChange={(e) => setEdit({ ...edit, isPublic: e.target.checked })} /> Show publicly once the event is published</label>
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button type="button" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" disabled={busy}>Save</Button></div>
        </form>}
      </Modal>

      <Modal open={!!info} title="Edit event details" onClose={() => setInfo(null)}>
        {info && <form onSubmit={saveInfo}>
          <Input label="Event name" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} />
          <div className="grid cols-2"><Input label="Academic year" value={info.academicYear} onChange={(e) => setInfo({ ...info, academicYear: e.target.value })} /><Input label="When" value={info.eventDate} onChange={(e) => setInfo({ ...info, eventDate: e.target.value })} /></div>
          <Input label="Venue" value={info.venue} onChange={(e) => setInfo({ ...info, venue: e.target.value })} />
          <div className="field"><label>Description shown on the public page</label><textarea className="textarea" rows={4} value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} /></div>
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button type="button" variant="ghost" onClick={() => setInfo(null)}>Cancel</Button><Button type="submit" disabled={busy}>Save</Button></div>
        </form>}
      </Modal>

      <Modal open={!!person} title="Add person" onClose={() => setPerson(null)}>
        {person && <form onSubmit={addPerson}>
          <Input label="Email" type="email" value={person.email} onChange={(e) => setPerson({ ...person, email: e.target.value })} />
          <Input label="Name (optional)" value={person.name} onChange={(e) => setPerson({ ...person, name: e.target.value })} />
          {can.publish && <Select label="Role" value={person.role} onChange={(e) => setPerson({ ...person, role: e.target.value })} options={[{ value: 'event_member', label: 'Team member (view and download)' }, { value: 'event_coordinator', label: 'Coordinator (uploads files)' }]} />}
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button type="button" variant="ghost" onClick={() => setPerson(null)}>Cancel</Button><Button type="submit" disabled={busy}>Create login</Button></div>
        </form>}
      </Modal>

      <Modal open={!!creds} title={creds?.reset ? 'Password reset' : 'Login created'} onClose={() => setCreds(null)}>
        <p>Share these details. They choose <b>{college.toUpperCase()}</b> on the login page.</p>
        <p style={{ fontFamily: 'var(--f-mono)', background: 'var(--c-surface-2)', padding: 'var(--s-3)', borderRadius: 'var(--r-md)' }}>{creds?.email}<br />{creds?.password}</p>
        <p className="muted">They can change it any time from “Change password”.</p><Button onClick={() => setCreds(null)}>Done</Button>
      </Modal>
    </div>
  )
}
