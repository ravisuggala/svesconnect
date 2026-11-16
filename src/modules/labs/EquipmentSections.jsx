import { empty, visible } from './spec'
import './labs.css'

function Value({ field, value }) {
  if (field.type === 'list') return <ul className="vlist">{value.map((x, i) => <li key={i}>{x}</li>)}</ul>
  if (field.type === 'kv') return <table className="kv"><tbody>{value.map((r, i) => <tr key={i}><th>{r.k}</th><td>{r.v}</td></tr>)}</tbody></table>
  if (field.type === 'url') return <a href={value} target="_blank" rel="noopener noreferrer">{value}</a>
  if (field.type === 'email') return <a href={`mailto:${value}`}>{value}</a>
  return <span style={{ whiteSpace: 'pre-wrap' }}>{value}{field.unit && field.type === 'number' ? ` ${field.unit}` : ''}</span>
}

/** Read-only view of an equipment record, section by section. Used for internal review and for the public page. */
export default function EquipmentSections({ sections, data, highValueLakhs }) {
  return sections.filter((s) => !s.files).map((s) => {
    const rows = s.fields.filter((f) => visible(f, data, highValueLakhs) && !empty(data[f.key]))
    if (!rows.length) return null
    return (
      <section key={s.key} className="eq-sec">
        <h3>{s.title}</h3>
        <dl>{rows.map((f) => <div key={f.key} className="eq-row"><dt>{f.label}</dt><dd><Value field={f} value={data[f.key]} /></dd></div>)}</dl>
      </section>
    )
  })
}
