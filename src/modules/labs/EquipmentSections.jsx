import { empty, visible } from './spec'
import { FileLine } from './ProofViewer'
import './labs.css'

function Value({ field, value }) {
  if (field.type === 'list') return <ul className="vlist">{value.map((x, i) => <li key={i}>{x}</li>)}</ul>
  if (field.type === 'kv') return <table className="kv"><tbody>{value.map((r, i) => <tr key={i}><th>{r.k}</th><td>{r.v}</td></tr>)}</tbody></table>
  if (field.type === 'counts') return <span>{[value.repair && `${value.repair} need repair`, value.unused && `${value.unused} not in use`].filter(Boolean).join(', ')}{value.note ? ` (${value.note})` : ''}</span>
  if (field.type === 'number' && field.unit === '₹') return <span>₹ {Number(value).toLocaleString('en-IN')}</span>
  if (field.type === 'url') return <a href={value} target="_blank" rel="noopener noreferrer">{value}</a>
  if (field.type === 'email') return <a href={`mailto:${value}`}>{value}</a>
  return <span style={{ whiteSpace: 'pre-wrap' }}>{value}{field.unit && field.type === 'number' ? ` ${field.unit}` : ''}</span>
}

const kindsOf = (s, all) => (Array.isArray(s.files) ? s.files : s.files === true ? all : [])

/** Read-only view of an equipment record, section by section, in the same order as the entry form.
 *  With `files` (internal pages) each uploaded file sits under the question it was uploaded for, with a "Show proof" button. */
export default function EquipmentSections({ sections, data, highValueLakhs, files, fileKinds, college }) {
  const claimed = new Set(sections.flatMap((s) => (Array.isArray(s.files) ? s.files : [])))
  const unclaimed = files ? [...new Set(files.map((f) => f.kind))].filter((k) => !claimed.has(k)) : []
  const label = (k) => fileKinds?.find((x) => x.key === k)?.label || 'Uploaded files'
  const fileRows = (kinds) => kinds.map((k) => {
    const list = (files || []).filter((f) => f.kind === k)
    return list.length ? <div key={k} className="eq-row"><dt>{label(k)}</dt><dd>{list.map((f) => <FileLine key={f.id} college={college} file={f} />)}</dd></div> : null
  }).filter(Boolean)
  const hasDocsSection = sections.some((s) => s.files === true)
  const out = sections.map((s) => {
    const rows = s.fields.filter((f) => visible(f, data, highValueLakhs) && !empty(data[f.key]))
    const frows = files ? fileRows(kindsOf(s, unclaimed)) : []
    if (!rows.length && !frows.length) return null
    return (
      <section key={s.key} className="eq-sec">
        <h3>{s.title.replace(/ \(all optional\)/, '')}</h3>
        <dl>{rows.map((f) => <div key={f.key} className="eq-row"><dt>{f.label}</dt><dd><Value field={f} value={data[f.key]} /></dd></div>)}{frows}</dl>
      </section>
    )
  })
  if (files && !hasDocsSection && unclaimed.length) out.push(<section key="__other" className="eq-sec"><h3>Other uploaded files</h3><dl>{fileRows(unclaimed)}</dl></section>)
  return out
}
