import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download, FileText, Filter, Sparkles, X } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Modal, Skeleton, useToast } from '../../ui'
import { BarList, Columns, Donut, Stacked, fmt, money } from '../../ui/Charts'
import { useAuth } from '../../core/auth'
import { api } from '../../core/api'
import './dashboard.css'

const EXAMPLES = ['Equipment not working by department', 'All HODs', 'Lab in-charge wise equipment', 'Events this year', 'Equipment bought after 2020', 'Equipment awaiting HOD approval', 'Department wise summary']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const COLORS = { working: 'var(--c-accent)', repair: 'var(--c-secondary-brand)', notInUse: 'var(--c-primary)', unknown: 'var(--c-border)' }

const cell = (col, v, finance) => (v === undefined || v === null || v === '' ? '–' : col.money ? (finance ? money(v) : '–') : col.num ? fmt(v) : String(v))

/** The same table is used on screen and in the PDF. */
function ResultTable({ res, finance }) {
  return (
    <div className="tablewrap"><table className="restable">
      <thead><tr>{res.columns.map((c) => <th key={c.key} className={c.num || c.money ? 'r' : ''}>{c.label}</th>)}</tr></thead>
      <tbody>{res.rows.map((r, i) => <tr key={r.id ?? `${r.label}-${i}`}>{res.columns.map((c) => <td key={c.key} className={c.num || c.money ? 'r' : ''}>{cell(c, r[c.key], finance)}</td>)}</tr>)}
        {!res.rows.length && <tr><td colSpan={res.columns.length} className="muted">Nothing matches. Try removing a filter or choosing another date range.</td></tr>}</tbody>
      {res.rows.length > 1 && res.totals && <tfoot><tr>{res.columns.map((c, i) => <td key={c.key} className={c.num || c.money ? 'r' : ''}>{i === 0 ? <b>Total</b> : res.totals[c.key] !== undefined ? <b>{cell(c, res.totals[c.key], finance)}</b> : ''}</td>)}</tr></tfoot>}
    </table></div>
  )
}

function Tile({ label, value, sub, tone, onClick }) {
  return <button type="button" className={`tile ${tone || ''}`} onClick={onClick} disabled={!onClick}><span className="tile-v">{value}</span><span className="tile-l">{label}</span>{sub && <span className="tile-s">{sub}</span>}</button>
}

function Charts({ d, pick }) {
  const t = d.tiles
  return (
    <div className="dgrid">
      <Card className="dcard"><h3>Equipment condition</h3><Donut center={fmt(t.units)} sub="units" parts={[{ label: 'Working', value: t.working, color: COLORS.working }, { label: 'Needs repair', value: t.repair, color: COLORS.repair }, { label: 'Not in use', value: t.notInUse, color: COLORS.notInUse }, ...(t.notRecorded ? [{ label: 'Not recorded', value: t.notRecorded, color: COLORS.unknown }] : [])]} /></Card>
      <Card className="dcard"><h3>Units by department</h3><BarList data={d.unitsByDepartment} onPick={(x) => pick({ entity: 'equipment', filters: { department: x.label }, groupBy: 'type' })} /></Card>
      <Card className="dcard"><h3>Approval progress</h3><Stacked rows={d.approval.map((a) => ({ label: a.department, published: a.published, pending: a.pending, draft: a.draft }))} parts={[{ key: 'published', label: 'Published', color: COLORS.working }, { key: 'pending', label: 'Awaiting HOD', color: COLORS.repair }, { key: 'draft', label: 'With in-charge', color: COLORS.unknown }]} /></Card>
      <Card className="dcard"><h3>Top equipment types</h3><BarList data={d.topTypes} onPick={(x) => pick({ entity: 'equipment', filters: { type: x.label }, groupBy: 'department' })} /></Card>
      <Card className="dcard wide"><h3>Equipment bought per year (units)</h3><Columns data={d.boughtPerYear} empty="Add the year bought in the equipment details to see this chart." /></Card>
      <Card className="dcard"><h3>Most common equipment</h3><BarList data={d.topEquipment} onPick={(x) => pick({ entity: 'equipment', filters: { equipment: x.label } })} /></Card>
      <Card className="dcard wide"><h3>Events per month</h3><Columns data={d.eventsByMonth} empty="No events yet." /></Card>
    </div>
  )
}

/** Principal / HOD / administrator dashboard: numbers, charts, an ask-anything box, filters and PDF reports. */
export default function Dashboard() {
  const { college } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const [d, setD] = useState(null)
  const [opt, setOpt] = useState(null)
  const [error, setError] = useState('')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [finance, setFinance] = useState(true)
  const [form, setForm] = useState({ entity: 'equipment', groupBy: '', department: '', lab: '', type: '', condition: '', status: '', year: '', month: '', from: '', to: '', boughtFrom: '', boughtTo: '', q: '' })
  const [reportOpen, setReportOpen] = useState(false)
  const [include, setInclude] = useState({ tiles: true, charts: true, departments: true, labs: true, hods: false, incharges: false, equipment: false, events: false })
  const [report, setReport] = useState(null)
  const resultRef = useRef(null)
  const isHod = user.role === 'hod'

  useEffect(() => {
    api(`/c/${college}/insights/dashboard`).then(setD).catch((e) => setError(e.message))
    api(`/c/${college}/insights/options`).then(setOpt).catch(() => {})
  }, [college])

  const show = (r) => { setRes(r); setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60) }
  const runRequest = useCallback(async (request) => {
    setBusy(true)
    try { show(await api(`/c/${college}/insights/query`, { method: 'POST', body: { request, finance } })) } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }, [college, finance, toast])
  const ask = async (text) => {
    const p = (text ?? prompt).trim()
    if (p.length < 2) return toast('Please type what you would like to see.', 'error')
    setPrompt(p); setBusy(true)
    try { show(await api(`/c/${college}/insights/ask`, { method: 'POST', body: { prompt: p, finance } })) } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  const applyFilters = (ev) => {
    ev.preventDefault()
    const f = {}
    for (const k of ['department', 'lab', 'type', 'condition', 'status', 'from', 'to', 'q']) if (form[k]) f[k] = form[k]
    for (const k of ['year', 'month', 'boughtFrom', 'boughtTo']) if (form[k]) f[k] = Number(form[k])
    runRequest({ entity: form.entity, groupBy: form.groupBy || null, filters: f })
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  // Printing: the browser's print window; choose "Save as PDF".
  const printOnly = (cls) => { document.body.classList.add(cls); const done = () => { document.body.classList.remove(cls); window.removeEventListener('afterprint', done) }; window.addEventListener('afterprint', done); setTimeout(() => window.print(), 80) }
  const buildReport = async () => {
    setBusy(true)
    try {
      const get = (entity, groupBy = null) => api(`/c/${college}/insights/query`, { method: 'POST', body: { request: { entity, groupBy, filters: {} }, finance } })
      const out = { include: { ...include }, finance, tables: {} }
      if (include.departments) out.tables.departments = await get('departments')
      if (include.labs) out.tables.labs = await get('labs')
      if (include.hods && !isHod) out.tables.hods = await get('hods')
      if (include.incharges) out.tables.incharges = await get('incharges')
      if (include.equipment) out.tables.equipment = await get('equipment')
      if (include.events) out.tables.events = await get('events')
      setReport(out); setReportOpen(false)
      setTimeout(() => printOnly('print-full'), 200)
    } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  const today = useMemo(() => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), [])

  if (error) return <EmptyState title="Dashboard not available" icon={FileText}>{error}</EmptyState>
  if (!d) return <div className="dash"><Skeleton h={180} /><Skeleton h={120} /></div>
  const t = d.tiles
  const tileFor = (label, value, req, tone, sub) => <Tile label={label} value={value} tone={tone} sub={sub} onClick={req ? () => runRequest(req) : undefined} />

  return (
    <div className="dash fade-up">
      <section className="dash-hero no-print">
        <div><span className="dash-kicker">{d.scope}</span><h1>{d.college.name}</h1><p>Dashboard · {today}</p></div>
        <Button onClick={() => setReportOpen(true)}><Download size={16} /> Download PDF report</Button>
      </section>

      <section className="askbox no-print">
        <form onSubmit={(e) => { e.preventDefault(); ask() }}>
          <Sparkles size={20} className="ask-ico" />
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask anything: “not working equipment in CSE”, “all HODs”, “events in March”…" aria-label="Ask a question about your college" />
          <Button type="submit" disabled={busy}>{busy ? 'Working…' : 'Show'}</Button>
          <Button type="button" variant="ghost" onClick={() => setShowFilters((v) => !v)}><Filter size={15} /> Filters</Button>
        </form>
        <div className="chips-row">{EXAMPLES.map((x) => <button key={x} type="button" className="chip" onClick={() => ask(x)}>{x}</button>)}</div>
        {showFilters && (
          <form className="filters" onSubmit={applyFilters}>
            <label>Show<select className="select" value={form.entity} onChange={set('entity')}>{(opt?.entities || [{ key: 'equipment', label: 'Equipment' }]).map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}</select></label>
            <label>Group by<select className="select" value={form.groupBy} onChange={set('groupBy')}><option value="">No grouping</option><option value="department">Department</option><option value="lab">Lab</option><option value="type">Type</option><option value="equipment">Equipment</option><option value="incharge">Lab in-charge (faculty)</option><option value="year">Year bought</option><option value="month">Month</option></select></label>
            <label>Department<select className="select" value={form.department} onChange={set('department')}><option value="">All</option>{(opt?.departments || []).map((x) => <option key={x}>{x}</option>)}</select></label>
            <label>Type<select className="select" value={form.type} onChange={set('type')}><option value="">All</option>{(opt?.types || []).map((x) => <option key={x}>{x}</option>)}</select></label>
            <label>Condition<select className="select" value={form.condition} onChange={set('condition')}><option value="">Any</option><option value="working">Working</option><option value="repair">Needs repair</option><option value="not_in_use">Not in use</option><option value="not_working">Not working (repair or not in use)</option></select></label>
            <label>Status<select className="select" value={form.status} onChange={set('status')}><option value="">Any</option><option value="published">Published</option><option value="pending">Awaiting HOD</option><option value="draft">Draft</option><option value="sent_back">Sent back</option></select></label>
            <label>Year<input className="input" type="number" placeholder="e.g. 2025" value={form.year} onChange={set('year')} /></label>
            <label>Month<select className="select" value={form.month} onChange={set('month')}><option value="">Any</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></label>
            <label>From date<input className="input" type="date" value={form.from} onChange={set('from')} /></label>
            <label>To date<input className="input" type="date" value={form.to} onChange={set('to')} /></label>
            <label>Bought from year<input className="input" type="number" placeholder="e.g. 2018" value={form.boughtFrom} onChange={set('boughtFrom')} /></label>
            <label>Bought up to year<input className="input" type="number" placeholder="e.g. 2024" value={form.boughtTo} onChange={set('boughtTo')} /></label>
            <label className="wide">Contains the word<input className="input" value={form.q} onChange={set('q')} placeholder="e.g. server, Dell, lathe" /></label>
            <div className="row wide"><Button type="submit" disabled={busy}>Show results</Button><Button type="button" variant="ghost" onClick={() => setForm({ ...form, groupBy: '', department: '', lab: '', type: '', condition: '', status: '', year: '', month: '', from: '', to: '', boughtFrom: '', boughtTo: '', q: '' })}>Clear</Button></div>
          </form>)}
        <label className="fin"><input type="checkbox" checked={finance} onChange={(e) => setFinance(e.target.checked)} /> Include cost in results and PDFs</label>
      </section>

      {res && (
        <Card className="result-card" ref={resultRef}>
          <div className="row no-print"><h2 style={{ margin: 0 }}>{res.title}</h2><span className="spacer" />
            <Button onClick={() => printOnly('print-result')}><Download size={15} /> Download PDF</Button><Button variant="ghost" onClick={() => setRes(null)} aria-label="Close result"><X size={15} /></Button></div>
          <h2 className="only-print">{d.college.name}: {res.title}</h2>
          <p className="muted only-print">{today} · {d.scope}</p>
          {res.prompt && <p className="muted" style={{ margin: 'var(--s-2) 0' }}>You asked: “{res.prompt}”</p>}
          <div className="chips-row">{res.understood.length ? res.understood.map((u) => <Badge key={u} tone="primary">{u}</Badge>) : <Badge>Everything</Badge>}{res.mode === 'basic' && <Badge>Simple understanding. Check the filters above</Badge>}</div>
          {res.narrative && <p className="narr">{res.narrative}{res.narrativeAi && <small className="muted"> (AI summary)</small>}</p>}
          <ResultTable res={res} finance={finance} />
          {res.truncated && <p className="muted">Showing the first 1000 rows.</p>}
        </Card>)}

      <section className="tiles no-print">
        {tileFor('Departments', t.departments, { entity: 'departments' })}
        {tileFor('Labs', t.labs, { entity: 'labs' })}
        {tileFor('Lab in-charges', t.inCharges, { entity: 'incharges' })}
        {!isHod && tileFor('HODs', t.hods, { entity: 'hods' })}
        {tileFor('Equipment records', t.equipment, { entity: 'equipment' })}
        {tileFor('Total units', fmt(t.units), { entity: 'equipment', groupBy: 'department' })}
        {tileFor('Working', fmt(t.working), { entity: 'equipment', filters: { condition: 'working' } }, 'good')}
        {tileFor('Needs repair', fmt(t.repair), { entity: 'equipment', filters: { condition: 'repair' } }, 'warn')}
        {tileFor('Not in use', fmt(t.notInUse), { entity: 'equipment', filters: { condition: 'not_in_use' } }, 'bad')}
        {tileFor('Published', t.published, { entity: 'equipment', filters: { status: 'published' } })}
        {tileFor('Awaiting HOD', t.pending, { entity: 'equipment', filters: { status: 'pending' } }, t.pending ? 'warn' : '')}
        {finance && tileFor('Investment', money(t.investment), { entity: 'departments' })}
        {tileFor('Events', t.events, { entity: 'events' }, '', `${t.publishedEvents} published`)}
      </section>

      {d.alerts.length > 0 && <section className="alerts no-print">{d.alerts.map((a) => <button key={a.text} type="button" className={`alert ${a.tone}`} onClick={() => a.ask && ask(a.ask)} disabled={!a.ask}>{a.text}</button>)}</section>}
      <div className="no-print"><Charts d={d} pick={runRequest} /></div>

      <Modal open={reportOpen} title="Download PDF report" onClose={() => setReportOpen(false)}>
        <p className="muted">Choose what to include. A print window opens: choose <b>Save as PDF</b>.</p>
        <div className="checks">{[['tiles', 'Summary numbers'], ['charts', 'Charts'], ['departments', 'Department table'], ['labs', 'Lab table'], ...(!isHod ? [['hods', 'HOD list']] : []), ['incharges', 'Lab in-charge (faculty) table'], ['equipment', 'Full equipment list'], ['events', 'Events']].map(([k, l]) => (
          <label key={k}><input type="checkbox" checked={include[k]} onChange={(e) => setInclude({ ...include, [k]: e.target.checked })} /> {l}</label>))}
          <label><input type="checkbox" checked={finance} onChange={(e) => setFinance(e.target.checked)} /> Include cost</label></div>
        <div className="row" style={{ justifyContent: 'flex-end' }}><Button variant="ghost" onClick={() => setReportOpen(false)}>Cancel</Button><Button onClick={buildReport} disabled={busy}><Download size={15} /> Create PDF</Button></div>
      </Modal>

      {report && (
        <section className="print-report">
          <header><h1>{d.college.name}</h1><p>{d.scope} · Report dated {today}</p></header>
          {report.include.tiles && <div className="pr-tiles">{[['Departments', t.departments], ['Labs', t.labs], ['Lab in-charges', t.inCharges], ['Equipment records', t.equipment], ['Total units', fmt(t.units)], ['Working', fmt(t.working)], ['Needs repair', fmt(t.repair)], ['Not in use', fmt(t.notInUse)], ['Published', t.published], ['Awaiting HOD', t.pending], ...(report.finance ? [['Investment', money(t.investment)]] : []), ['Events', t.events]].map(([l, v]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}</div>}
          {report.include.charts && <Charts d={d} pick={() => {}} />}
          {Object.entries({ departments: 'Departments', labs: 'Labs', hods: 'Heads of Department', incharges: 'Lab in-charges (faculty-wise)', equipment: 'Equipment list', events: 'Events' }).map(([k, label]) => report.tables[k] && <div key={k} className="pr-table"><h2>{label}</h2><ResultTable res={report.tables[k]} finance={report.finance} /></div>)}
        </section>)}
    </div>
  )
}
