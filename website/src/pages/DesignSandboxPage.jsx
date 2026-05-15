/* ============================================================
   DESIGN SANDBOX — TEMPORARY PAGE (route: /design)
   Final base: minimal + steel/cream + aurora + green + pill
   toolbar + "body in tone" card (option A). Now comparing the
   ICON LANGUAGE inside the card header:
     A = original (emoji)  ·  B = line set  ·  C = duotone set
   DELETE LATER: this file, its .css, /design route + import.
   ============================================================ */
import { useState } from 'react'
import './DesignSandboxPage.css'

function TactLogo({ tone = 'dark', size = 1 }) {
  const letters = ['T', 'A', 'C', 'T']
  return (
    <span className={`ds-logo ds-logo-${tone}`} style={{ '--ds-logo-scale': size }}>
      <span className="ds-logo-lockup">
        <span className="ds-logo-row">
          <span className="ds-logo-mark">
            {letters.map((l, i) => (
              <span key={i} className="ds-logo-seg">
                <span className="ds-logo-letter">{l}</span>
                {i < letters.length - 1 && <span className="ds-logo-dot" />}
              </span>
            ))}
          </span>
          <span className="ds-logo-word">accounting</span>
        </span>
      </span>
    </span>
  )
}

const STEEL = {
  '--ds-bg': '#FAF9F5',
  '--ds-surface': '#FFFEFB',
  '--ds-primary': '#1F3A5F',
  '--ds-primary-soft': 'rgba(31, 58, 95, 0.07)',
  '--ds-text': '#2A2A28',
  '--ds-muted': '#706A60',
  '--ds-border': '#E7E2D6',
  '--ds-accent': '#D64A2E',
  '--ds-pos': '#2F8F5B',
  '--ds-pos-soft': 'rgba(47, 143, 91, 0.12)',
  '--ds-ink': '#1C1B19',
}

/* options just for the KPI-card title (label) colour */
const LABELOPTS = [
  { id: 'orig', name: 'אופציה א · המקורי (אפור)', note: 'כותרת ריבוע המידע בצבע האפור הנוכחי. ללא שינוי.' },
  { id: 'red', name: 'אופציה ב · אדום', note: 'כותרת ריבוע המידע באדום־חמרה של המותג.' },
  { id: 'blue', name: 'אופציה ג · כחול', note: 'כותרת ריבוע המידע בכחול־פלדה של המותג.' },
]

const NAV = ['סקירה', 'לקוחות', 'חשבוניות', 'דוחות']

const KPIS = [
  { key: 'clients', icon: '📚', label: 'תיקי לקוח', value: '128', delta: '+6 מהחודש', up: true },
  { key: 'invoices', icon: '🧾', label: 'חשבוניות', value: '1,248', delta: '+12% מהחודש', up: true },
  { key: 'target', icon: '🎯', label: 'דיוק קליטה', value: '98.6%', delta: '+1.4% מהחודש', up: true },
  { key: 'calendar', icon: '📅', label: 'ימי פעילות', value: '27', delta: 'רצף שיא: 32', up: null },
]

const CARDS = [
  { key: 'energy', tone: 'green', icon: '⚡', title: 'אנרגיה',
    desc: 'חשבוניות, לקוחות ודוחות אנרגיה', metric: '1,248 חשבוניות',
    tag: 'פעיל', ready: true },
  { key: 'invoices', tone: 'steel', icon: '🧾', title: 'חשבוניות',
    desc: 'הפקה, קליטה ומעקב מסמכים', metric: 'השקה ברבעון הקרוב',
    tag: 'בקרוב', ready: false },
  { key: 'reports', tone: 'blue', icon: '📊', title: 'דוחות',
    desc: 'רווח והפסד, גיול וניתוח תזרים', metric: 'רווח/הפסד · גיול',
    tag: 'חדש', ready: false },
]

/* ---- the icon LANGUAGE: one consistent set, two finishes ----
   Shared rules: 24x24 grid, 2px geometry, rounded joins. */
const GLYPHS = {
  energy: (
    <path
      d="M13 2 L5 14 H11 L10 22 L19 9 H13 Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  ),
  invoices: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3 H15 L19 7 V21 H6 Z" />
      <path d="M9 10 H15 M9 14 H15 M9 18 H13" />
    </g>
  ),
  reports: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4 V20 H20" />
      <path d="M8 17 V13 M12 17 V9 M16 17 V11" />
    </g>
  ),
  clients: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7 H10 L12 9 H20 V19 H4 Z" />
      <path d="M4 11 H20" />
    </g>
  ),
  target: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </g>
  ),
  calendar: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 9 H20 M8 3 V6 M16 3 V6" />
    </g>
  ),
}

function CardIcon({ name }) {
  return (
    <svg className="ds-ico-svg" viewBox="0 0 24 24" width="19" height="19">
      {GLYPHS[name]}
    </svg>
  )
}

/* frameless icon for the top KPI cards (no chip behind it) */
function KpiIcon({ name }) {
  return (
    <svg className="ds-kpi-svg" viewBox="0 0 24 24" width="20" height="20">
      {GLYPHS[name]}
    </svg>
  )
}

function Search() {
  return (
    <div className="ds-search">
      <span className="ds-search-ico">⌕</span>
      <span className="ds-search-ph">חיפוש לקוח, חשבונית או דוח…</span>
      <span className="ds-search-k">⌘K</span>
    </div>
  )
}

function Toolbar() {
  return (
    <header className="ds-bar" data-bar="pill">
      <TactLogo tone="light" size={0.82} />
      <div className="ds-pillnav">
        <nav className="ds-nav">
          {NAV.map((n, i) => (
            <span key={n} className={`ds-nav-link ${i === 0 ? 'ds-nav-active' : ''}`}>
              {n}
            </span>
          ))}
        </nav>
      </div>
      <div className="ds-bar-end">
        <Search />
        <button className="ds-btn ds-btn-icon" aria-label="התראות">🔔</button>
        <button className="ds-btn ds-btn-primary ds-btn-sm">+ תיק חדש</button>
        <span className="ds-avatar">רכ</span>
      </div>
    </header>
  )
}

function Delta({ text, up }) {
  if (up === null) return <span className="ds-delta ds-delta-neutral">{text}</span>
  return (
    <span className={`ds-delta ${up ? 'ds-delta-up' : 'ds-delta-down'}`}>
      <i>{up ? '▲' : '▼'}</i> {text}
    </span>
  )
}

function MiniChart() {
  return (
    <svg className="ds-chart" viewBox="0 0 560 150" preserveAspectRatio="none">
      <defs>
        <linearGradient id="dsFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ds-primary)" stopOpacity="0.20" />
          <stop offset="100%" stopColor="var(--ds-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,95 C50,70 80,60 110,72 C150,88 175,60 210,55 C250,49 280,86 320,92 C360,98 390,64 430,52 C470,41 510,70 560,60 L560,150 L0,150 Z"
        fill="url(#dsFill)"
      />
      <path
        d="M0,95 C50,70 80,60 110,72 C150,88 175,60 210,55 C250,49 280,86 320,92 C360,98 390,64 430,52 C470,41 510,70 560,60"
        fill="none"
        stroke="var(--ds-primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="320" cy="92" r="5" fill="var(--ds-primary)" stroke="#fff" strokeWidth="2" />
    </svg>
  )
}

function Badge({ tag }) {
  const cls =
    tag === 'פעיל' ? 'ds-badge-on' : tag === 'חדש' ? 'ds-badge-new' : 'ds-badge-soon'
  return <span className={`ds-badge ${cls}`}>{tag}</span>
}

function Card({ c }) {
  return (
    <div className={`ds-hcard ds-hcard--orig ds-tone-${c.tone} ${c.ready ? '' : 'ds-hcard-soon'}`}>
      <div className="ds-hcard-cap">
        <span className="ds-hcard-ico ds-hcard-ico--svg ds-ico-locked">
          <CardIcon name={c.key} />
        </span>
        <Badge tag={c.tag} />
      </div>
      <div className="ds-hcard-body">
        <h3 className="ds-hcard-title">{c.title}</h3>
        <p className="ds-hcard-desc">{c.desc}</p>
        <div className="ds-hcard-foot">
          <span className="ds-hcard-metric">{c.metric}</span>
          <span className="ds-hcard-link">{c.ready ? 'כניסה →' : 'בקרוב'}</span>
        </div>
      </div>
    </div>
  )
}

function VariantPreview({ variant }) {
  return (
    <div className="ds-variant" data-flavor="aurora" data-style="minimal" style={STEEL}>
      <Toolbar />

      <div className="ds-greet">
        <div>
          <span className="ds-eyebrow">tact accounting<i /></span>
          <h1 className="ds-h1">בוקר טוב, רינה — סקירת המשרד</h1>
        </div>
        <div className="ds-seg">
          <span className="ds-seg-on">שבוע</span>
          <span>חודש</span>
          <span>שנה</span>
        </div>
      </div>

      <div className="ds-kpis">
        {KPIS.map((k) => (
          <div className="ds-kpi" key={k.label}>
            <div className="ds-kpi-top">
              <span className={`ds-kpi-label ds-kpi-label--${variant}`}>{k.label}</span>
              <span className="ds-kpi-ico ds-kpi-ico--steel">
                <KpiIcon name={k.key} />
              </span>
            </div>
            <div className="ds-kpi-val">{k.value}</div>
            <Delta text={k.delta} up={k.up} />
          </div>
        ))}
      </div>

      <div className="ds-panel">
        <div className="ds-panel-head">
          <div>
            <h3 className="ds-panel-title">היקף פעילות</h3>
            <p className="ds-panel-sub">שעות עבודה על תיקים השבוע</p>
          </div>
          <span className="ds-chip">שבוע ▾</span>
        </div>
        <MiniChart />
      </div>

      <div className="ds-section-head">
        <h3 className="ds-section-title">המערכות שלי</h3>
      </div>
      <div className="ds-cards">
        {CARDS.map((c) => (
          <Card key={c.title} c={c} />
        ))}
      </div>

      <div className="ds-foot">
        <div className="ds-foot-brand">
          <span className="ds-foot-mark">
            {['T', 'A', 'C', 'T'].map((l, i) => (
              <span key={i} className="ds-logo-seg">
                <span className="ds-logo-letter">{l}</span>
                {i < 3 && <span className="ds-logo-dot" />}
              </span>
            ))}
          </span>
          <span className="ds-foot-tagline">הטמעת מערכות בינה מלאכותית</span>
        </div>
      </div>
    </div>
  )
}

export default function DesignSandboxPage() {
  const [only, setOnly] = useState('all')
  const shown = only === 'all' ? LABELOPTS : LABELOPTS.filter((t) => t.id === only)

  return (
    <div className="ds-page">
      <div className="ds-topnote">
        <strong>צבע כותרת ריבועי המידע</strong> — א = אפור (מקור), ב = אדום,
        ג = כחול. כל השאר נעול. בחר ותגיד מה לפתח.
        <div className="ds-switch">
          <button className={only === 'all' ? 'on' : ''} onClick={() => setOnly('all')}>
            הכל
          </button>
          {LABELOPTS.map((t) => (
            <button
              key={t.id}
              className={only === t.id ? 'on' : ''}
              onClick={() => setOnly(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {shown.map((t) => (
        <section className="ds-block" key={t.id}>
          <header className="ds-block-head">
            <h2>{t.name}</h2>
            <p>{t.note}</p>
          </header>
          <VariantPreview variant={t.id} />
        </section>
      ))}
    </div>
  )
}
