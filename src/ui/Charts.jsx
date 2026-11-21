import './charts.css'

/** Small SVG/CSS charts (no chart library). Colours come from the design tokens. */
export const fmt = (v) => Number(v || 0).toLocaleString('en-IN')
export const money = (v) => {
  const n = Number(v || 0)
  if (n >= 10000000) return `₹ ${(n / 10000000).toFixed(2)} Cr`
  if (n >= 100000) return `₹ ${(n / 100000).toFixed(2)} L`
  return `₹ ${n.toLocaleString('en-IN')}`
}

export function BarList({ data, onPick, empty = 'No data yet' }) {
  if (!data?.length) return <p className="muted">{empty}</p>
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <ul className="barlist">{data.map((d) => (
      <li key={d.label}>
        <button type="button" className="bl-row" onClick={() => onPick?.(d)} disabled={!onPick}>
          <span className="bl-label" title={d.label}>{d.label}</span>
          <span className="bl-track"><i style={{ width: `${Math.max(3, (d.value / max) * 100)}%` }} /></span>
          <span className="bl-val">{fmt(d.value)}</span>
        </button>
      </li>))}</ul>
  )
}

export function Columns({ data, empty = 'No data yet' }) {
  if (!data?.length) return <p className="muted">{empty}</p>
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="cols" role="img" aria-label="Column chart">{data.map((d) => (
      <div key={d.label} className="col"><span className="col-val">{fmt(d.value)}</span><i style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }} /><span className="col-label">{d.label}</span></div>))}</div>
  )
}

export function Donut({ parts, center, sub }) {
  const total = parts.reduce((t, p) => t + p.value, 0)
  const R = 54, C = 2 * Math.PI * R
  let off = 0
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" className="donut" role="img" aria-label="Condition chart">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--c-surface-2)" strokeWidth="18" />
        {total > 0 && parts.map((p) => { const len = (p.value / total) * C; const el = <circle key={p.label} cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 70 70)" />; off += len; return el })}
        <text x="70" y="68" textAnchor="middle" className="donut-n">{center}</text><text x="70" y="86" textAnchor="middle" className="donut-s">{sub}</text>
      </svg>
      <ul className="legend">{parts.map((p) => <li key={p.label}><i style={{ background: p.color }} />{p.label} <b>{fmt(p.value)}</b></li>)}</ul>
    </div>
  )
}

export function Stacked({ rows, parts }) {
  if (!rows?.length) return <p className="muted">No data yet</p>
  return (
    <div className="stacked">
      <ul className="legend row-legend">{parts.map((p) => <li key={p.key}><i style={{ background: p.color }} />{p.label}</li>)}</ul>
      {rows.map((r) => { const tot = parts.reduce((t, p) => t + (r[p.key] || 0), 0) || 1; return (
        <div key={r.label} className="st-row"><span className="bl-label" title={r.label}>{r.label}</span>
          <span className="st-track">{parts.map((p) => (r[p.key] ? <i key={p.key} style={{ width: `${(r[p.key] / tot) * 100}%`, background: p.color }} title={`${p.label}: ${r[p.key]}`} /> : null))}</span>
          <span className="bl-val">{tot === 1 && !parts.some((p) => r[p.key]) ? 0 : parts.reduce((t, p) => t + (r[p.key] || 0), 0)}</span></div>) })}
    </div>
  )
}
