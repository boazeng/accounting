import TactIcon from './TactIcon'
import './Stats.css'

const kpis = [
  { key: 'clients', label: 'תיקי לקוח', value: '128', delta: '+6 מהחודש', up: true },
  { key: 'invoices', label: 'חשבוניות', value: '1,248', delta: '+12% מהחודש', up: true },
  { key: 'target', label: 'דיוק קליטה', value: '98.6%', delta: '+1.4% מהחודש', up: true },
  { key: 'calendar', label: 'ימי פעילות', value: '27', delta: 'רצף שיא: 32', up: null },
]

function Delta({ text, up }) {
  if (up === null) return <span className="kpi-delta kpi-delta-neutral">{text}</span>
  return (
    <span className={`kpi-delta ${up ? 'kpi-delta-up' : 'kpi-delta-down'}`}>
      <i>{up ? '▲' : '▼'}</i> {text}
    </span>
  )
}

export default function Stats() {
  return (
    <section className="kpis" id="kpis">
      <div className="container kpis-grid">
        {kpis.map((k) => (
          <div className="kpi" key={k.key}>
            <div className="kpi-top">
              <span className="kpi-label">{k.label}</span>
              <span className="kpi-ico">
                <TactIcon name={k.key} size={20} />
              </span>
            </div>
            <div className="kpi-val">{k.value}</div>
            <Delta text={k.delta} up={k.up} />
          </div>
        ))}
      </div>
    </section>
  )
}
