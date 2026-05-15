import { useState, useEffect, useRef } from 'react'
import EditableTable from '../components/EditableTable'
import './CashflowPage.css'

const API_BASE = import.meta.env.DEV ? 'http://localhost:5000' : ''

const COMPANIES = [
  { id: 'all', label: 'כל החברות' },
  { id: 'חניה אורבנית', label: 'חניה אורבנית' },
  { id: 'אחזקה אורבנית', label: 'אחזקה אורבנית' },
  { id: 'אנרגיה אורבנית', label: 'אנרגיה אורבנית' },
]

const CF_COLS = [
  { key: 'company', label: 'שם חברה' },
  {
    key: 'kind',
    label: 'סיווג',
    type: 'select',
    options: [
      { v: 'income', l: 'הכנסה' },
      { v: 'expense', l: 'הוצאה' },
    ],
  },
  { key: 'category', label: 'סיווג התנועה' },
  { key: 'pay_date', label: 'תאריך תשלום' },
  { key: 'details', label: 'פרטים' },
  { key: 'amount', label: 'סכום בש"ח', type: 'money' },
]

const PANELS = {
  employees: {
    label: 'עובדים',
    url: 'employees',
    listKey: 'employees',
    cols: [
      { key: 'company', label: 'שם החברה' },
      { key: 'name', label: 'שם העובד' },
      { key: 'gross', label: 'שכר ברוטו', type: 'money' },
      { key: 'net', label: 'שכר נטו', type: 'money' },
      { key: 'social', label: 'סכום סוציאליות', type: 'money' },
      { key: 'extra', label: 'הוצאה נוספת', type: 'money' },
      { key: 'notes', label: 'פרטים' },
      {
        key: 'active',
        label: 'פעיל',
        type: 'select',
        options: [
          { v: true, l: 'כן' },
          { v: false, l: 'לא' },
        ],
      },
    ],
    blank: { company: '', name: '', gross: 0, net: 0, social: 0, extra: 0, notes: '', active: true },
  },
  vehicles: {
    label: 'רכבים',
    url: 'vehicles',
    listKey: 'vehicles',
    cols: [
      { key: 'company', label: 'שם החברה' },
      { key: 'employee', label: 'שם העובד' },
      { key: 'belongs_to', label: 'רכב שייך ל' },
      { key: 'vtype', label: 'סוג הרכב' },
      { key: 'plate', label: 'מספר הרכב' },
      { key: 'leasing', label: 'סכום ליסינג', type: 'money' },
      { key: 'fuel', label: 'דלק (הערכה)', type: 'money' },
      { key: 'notes', label: 'פרטים' },
    ],
    blank: { company: '', employee: '', belongs_to: '', vtype: '', plate: '', leasing: 0, fuel: 0, notes: '' },
  },
  loans: {
    label: 'הלוואות',
    url: 'loans',
    listKey: 'loans',
    cols: [
      { key: 'company', label: 'שם החברה' },
      { key: 'loan_type', label: 'סוג הלוואה' },
      { key: 'bank', label: 'בנק' },
      { key: 'total', label: 'סך ההלוואה', type: 'money', w: 'md' },
      { key: 'monthly', label: 'סכום חודשי', type: 'money' },
      { key: 'start_date', label: 'התחלה', type: 'mmyy' },
      { key: 'end_date', label: 'סיום', type: 'mmyy' },
      { key: 'move_date', label: 'תאריך תנועה' },
      { key: 'notes', label: 'פרטים' },
    ],
    blank: {
      company: '',
      loan_type: '',
      bank: '',
      total: 0,
      monthly: 0,
      start_date: '',
      end_date: '',
      move_date: '',
      notes: '',
    },
  },
  mgmt: {
    label: 'דמי ניהול',
    url: 'mgmt',
    listKey: 'mgmt',
    cols: [
      { key: 'company', label: 'שם החברה' },
      { key: 'employee', label: 'שם העובד' },
      { key: 'fee_before', label: 'דמי ניהול לפני מע"מ', type: 'money' },
      { key: 'fee_incl', label: 'דמי ניהול כולל מע"מ', type: 'money' },
      { key: 'move_date', label: 'תאריך תנועה' },
      { key: 'notes', label: 'פרטים' },
    ],
    blank: { company: '', employee: '', fee_before: 0, fee_incl: 0, move_date: '', notes: '' },
  },
}

const ils = (n) =>
  '₪' + Number(n || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })
const uid = () =>
  (crypto.randomUUID && crypto.randomUUID()) || 'id-' + Math.random().toString(36).slice(2)

/* debounced PUT saver */
function useAutosave(url, bodyKey) {
  const t = useRef(null)
  return (rows) => {
    clearTimeout(t.current)
    t.current = setTimeout(() => {
      fetch(`${API_BASE}${url}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [bodyKey]: rows }),
      }).catch(() => {})
    }, 700)
  }
}

export default function CashflowPage() {
  const [company, setCompany] = useState('all')
  const [month, setMonth] = useState('all')
  const [fKind, setFKind] = useState('all')
  const [fCat, setFCat] = useState('all')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [panel, setPanel] = useState(null)
  const [ext, setExt] = useState({}) // { employees:[], vehicles:[], loans:[] }
  const loaded = useRef(false)

  const saveCf = useAutosave('/api/cashflow', 'transactions')
  const saveEmp = useAutosave('/api/cashflow/employees', 'rows')
  const saveVeh = useAutosave('/api/cashflow/vehicles', 'rows')
  const saveLoan = useAutosave('/api/cashflow/loans', 'rows')
  const saveMgmt = useAutosave('/api/cashflow/mgmt', 'rows')
  const panelSaver = { employees: saveEmp, vehicles: saveVeh, loans: saveLoan, mgmt: saveMgmt }

  useEffect(() => {
    fetch(`${API_BASE}/api/cashflow?company=all`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setRows(d.transactions)
          loaded.current = true
        } else setError(d.error || 'שגיאה בטעינת הנתונים')
      })
      .catch(() => setError('שגיאת תקשורת עם השרת'))
      .finally(() => setLoading(false))
  }, [])

  // lazy-load a panel dataset on first open
  useEffect(() => {
    if (!panel || ext[panel]) return
    fetch(`${API_BASE}/api/cashflow/${PANELS[panel].url}`)
      .then((r) => r.json())
      .then((d) => d.ok && setExt((p) => ({ ...p, [panel]: d[PANELS[panel].listKey] })))
      .catch(() => setExt((p) => ({ ...p, [panel]: [] })))
  }, [panel, ext])

  /* ---- cashflow row ops (operate on full rows, save full array) ---- */
  const cfChange = (id, key, val) => {
    setRows((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, [key]: val } : r))
      saveCf(next)
      return next
    })
  }
  const cfAdd = (id) => {
    setRows((prev) => {
      const i = prev.findIndex((r) => r.id === id)
      const copy = { ...prev[i], id: uid() }
      const next = [...prev]
      next.splice(i + 1, 0, copy)
      saveCf(next)
      return next
    })
  }
  const cfDel = (id) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id)
      saveCf(next)
      return next
    })
  }

  /* ---- panel (employees/vehicles/loans) row ops ---- */
  const pChange = (id, key, val) =>
    setExt((p) => {
      const next = p[panel].map((r) => (r.id === id ? { ...r, [key]: val } : r))
      panelSaver[panel](next)
      return { ...p, [panel]: next }
    })
  const pAdd = (id) =>
    setExt((p) => {
      const arr = p[panel]
      const i = arr.findIndex((r) => r.id === id)
      const copy = { ...arr[i], id: uid() }
      const next = [...arr]
      next.splice(i + 1, 0, copy)
      panelSaver[panel](next)
      return { ...p, [panel]: next }
    })
  const pDel = (id) =>
    setExt((p) => {
      const next = p[panel].filter((r) => r.id !== id)
      panelSaver[panel](next)
      return { ...p, [panel]: next }
    })
  const pNew = () =>
    setExt((p) => {
      const next = [...(p[panel] || []), { id: uid(), ...PANELS[panel].blank }]
      panelSaver[panel](next)
      return { ...p, [panel]: next }
    })

  // client-side filters for display
  const months = [...new Set(rows.map((r) => (r.pay_date || '').slice(0, 7)))]
    .filter(Boolean)
    .sort()
    .reverse()
  const monthLabel = (m) => `${m.slice(5, 7)}/${m.slice(0, 4)}`
  const activeMonth = month !== 'all' && !months.includes(month) ? 'all' : month
  const categories = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort()
  const qn = q.trim().toLowerCase()
  const kindLabel = (k) => (k === 'income' ? 'הכנסה' : 'הוצאה')
  const visibleRows = rows.filter((r) => {
    if (company !== 'all' && r.company !== company) return false
    if (activeMonth !== 'all' && (r.pay_date || '').slice(0, 7) !== activeMonth) return false
    if (fKind !== 'all' && r.kind !== fKind) return false
    if (fCat !== 'all' && r.category !== fCat) return false
    if (qn) {
      const hay = [
        r.company,
        kindLabel(r.kind),
        r.category,
        r.pay_date,
        r.details,
        String(r.amount),
      ]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(qn)) return false
    }
    return true
  })
  const summary = visibleRows.reduce(
    (a, r) => {
      const amt = Number(String(r.amount).replace(/[^\d.-]/g, '')) || 0
      if (r.kind === 'income') a.income += amt
      else a.expense += amt
      a.count += 1
      a.net = a.income - a.expense
      return a
    },
    { income: 0, expense: 0, net: 0, count: 0 }
  )

  return (
    <div className="cf">
      <div className="container">
        <div className="cf-head">
          <h1 className="cf-title">תזרים</h1>
          <div className="cf-controls">
            <div className="cf-month">
              <label className="cf-month-label" htmlFor="cf-month">
                חודש התזרים
              </label>
              <select
                id="cf-month"
                className="cf-month-select"
                value={activeMonth}
                onChange={(e) => setMonth(e.target.value)}
              >
                <option value="all">כל החודשים</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="cf-filters">
              {COMPANIES.map((c) => (
                <button
                  key={c.id}
                  className={`cf-filter ${company === c.id ? 'active' : ''}`}
                  onClick={() => setCompany(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="cf-panels">
          <div className="cf-panel-btns">
            {Object.entries(PANELS).map(([id, p]) => (
              <button
                key={id}
                className={`cf-panel-btn ${panel === id ? 'active' : ''}`}
                onClick={() => setPanel(panel === id ? null : id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {panel && (
            <div className="cf-card cf-panel-table">
              {!ext[panel] ? (
                <div className="cf-state">טוען…</div>
              ) : (
                <>
                  <EditableTable
                    columns={PANELS[panel].cols}
                    data={ext[panel]}
                    onChange={pChange}
                    onAddBelow={pAdd}
                    onDelete={pDel}
                  />
                  <button className="cf-add-row" onClick={pNew}>
                    + הוסף שורה
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="cf-summary">
          <div className="cf-sum">
            <span className="cf-sum-label">צפי הכנסות</span>
            <span className="cf-sum-val cf-pos">{ils(summary.income)}</span>
          </div>
          <div className="cf-sum">
            <span className="cf-sum-label">צפי הוצאות</span>
            <span className="cf-sum-val cf-neg">{ils(summary.expense)}</span>
          </div>
          <div className="cf-sum">
            <span className="cf-sum-label">תזרים נטו</span>
            <span className={`cf-sum-val ${summary.net >= 0 ? 'cf-pos' : 'cf-neg'}`}>
              {ils(summary.net)}
            </span>
          </div>
          <div className="cf-sum">
            <span className="cf-sum-label">תנועות</span>
            <span className="cf-sum-val">{summary.count}</span>
          </div>
        </div>

        <div className="cf-fbar">
          <div className="cf-ffield">
            <label>שם החברה</label>
            <select value={company} onChange={(e) => setCompany(e.target.value)}>
              {COMPANIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="cf-ffield">
            <label>סיווג</label>
            <select value={fKind} onChange={(e) => setFKind(e.target.value)}>
              <option value="all">הכל</option>
              <option value="income">הכנסה</option>
              <option value="expense">הוצאה</option>
            </select>
          </div>
          <div className="cf-ffield">
            <label>סיווג התנועה</label>
            <select value={fCat} onChange={(e) => setFCat(e.target.value)}>
              <option value="all">הכל</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="cf-ffield cf-fsearch">
            <label>חיפוש כללי</label>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חיפוש בכל השדות…"
            />
          </div>
          {(company !== 'all' || fKind !== 'all' || fCat !== 'all' || q) && (
            <button
              type="button"
              className="cf-fclear"
              onClick={() => {
                setCompany('all')
                setFKind('all')
                setFCat('all')
                setQ('')
              }}
            >
              נקה סינון
            </button>
          )}
        </div>

        <div className="cf-card">
          {loading ? (
            <div className="cf-state">טוען…</div>
          ) : error ? (
            <div className="cf-state cf-error">{error}</div>
          ) : visibleRows.length === 0 ? (
            <div className="cf-state">אין תנועות עתידיות להצגה</div>
          ) : (
            <EditableTable
              columns={CF_COLS}
              data={visibleRows}
              onChange={cfChange}
              onAddBelow={cfAdd}
              onDelete={cfDel}
            />
          )}
        </div>
      </div>
    </div>
  )
}
