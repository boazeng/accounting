import { useNavigate } from 'react-router-dom'
import TactIcon from './TactIcon'
import './AppCards.css'

const apps = [
  {
    key: 'energy',
    tone: 'green',
    title: 'אנרגיה',
    description: 'חשבוניות, לקוחות ודוחות עבור אנרגיה',
    metric: '1,248 חשבוניות',
    tag: 'פעיל',
    ready: true,
    link: '/energy',
  },
  {
    key: 'invoices',
    tone: 'steel',
    title: 'חשבוניות',
    description: 'הפקה, קליטה ומעקב אחר מסמכים',
    metric: 'השקה ברבעון הקרוב',
    tag: 'בקרוב',
    ready: false,
  },
  {
    key: 'reports',
    tone: 'blue',
    title: 'דוחות',
    description: 'רווח והפסד, גיול וניתוח תזרים',
    metric: 'רווח/הפסד · גיול',
    tag: 'חדש',
    ready: false,
  },
  {
    key: 'accounting',
    tone: 'purple',
    title: 'הנהלת חשבונות',
    description: 'קליטת חשבוניות ספק, אישורים ורישום בפריוריטי',
    metric: 'חשבוניות ספק · מייל',
    tag: 'חדש',
    ready: true,
    link: '/accounting',
  },
]

export default function AppCards() {
  const navigate = useNavigate()

  return (
    <section className="systems" id="systems">
      <div className="container">
        <h2 className="systems-title">המערכות שלי</h2>
        <p className="systems-sub">גישה מהירה לכלי הניהול של המשרד</p>
        <div className="systems-grid">
          {apps.map((app) => (
            <div
              key={app.key}
              className={`syscard syscard-${app.tone} ${app.ready ? '' : 'syscard-soon'}`}
              role={app.ready ? 'button' : undefined}
              tabIndex={app.ready ? 0 : undefined}
              onClick={() => app.ready && navigate(app.link)}
              onKeyDown={(e) => app.ready && e.key === 'Enter' && navigate(app.link)}
            >
              <div className="syscard-cap">
                <span className="syscard-ico">
                  <TactIcon name={app.key} size={19} />
                </span>
                <span
                  className={`syscard-badge ${
                    app.tag === 'פעיל'
                      ? 'syscard-badge-on'
                      : app.tag === 'חדש'
                      ? 'syscard-badge-new'
                      : 'syscard-badge-soon'
                  }`}
                >
                  {app.tag}
                </span>
              </div>
              <div className="syscard-body">
                <h3 className="syscard-name">{app.title}</h3>
                <p className="syscard-desc">{app.description}</p>
                <div className="syscard-foot">
                  <span className="syscard-metric">{app.metric}</span>
                  <span className="syscard-link">
                    {app.ready ? 'כניסה →' : 'בקרוב'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
