import { Badge, Card } from '../ui'

/** Shown for modules not built yet; lists the scope agreed in the project documents. */
export default function ModulePlaceholder({ module: m }) {
  return (
    <div className="fade-up">
      <div className="row"><m.icon color="var(--c-primary)" size={28} /><h2 style={{ margin: 0 }}>{m.label}</h2><Badge tone="primary">{m.phase}</Badge></div>
      <p className="muted" style={{ marginTop: 'var(--s-3)' }}>{m.summary}</p>
      <Card style={{ marginTop: 'var(--s-4)' }}>
        <h3>Planned scope</h3>
        <ul style={{ paddingLeft: 20, margin: 0 }}>{m.features.map((f) => <li key={f} style={{ marginBottom: 6 }}>{f}</li>)}</ul>
      </Card>
    </div>
  )
}
