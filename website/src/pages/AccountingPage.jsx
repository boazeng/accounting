import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './ArielPage.css'

const API = 'http://localhost:5000'

function fmt(isoStr) {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  return d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AccountingPage() {
  const [accStatus, setAccStatus]   = useState(null)
  const [syncing, setSyncing]       = useState(false)
  const [syncMsg, setSyncMsg]       = useState('')

  useEffect(() => {
    fetch(`${API}/api/accounts/status`)
      .then(r => r.json())
      .then(d => { if (d.ok) setAccStatus(d) })
      .catch(() => {})
  }, [])

  async function syncAccounts() {
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch(`${API}/api/accounts/sync`, { method: 'POST' }).then(r => r.json())
      if (res.ok) {
        setSyncMsg(`סונכרנו ${res.count} חשבונות בהצלחה`)
        setAccStatus({ count: res.count, updatedAt: new Date().toISOString() })
      } else {
        setSyncMsg(`שגיאה: ${res.error}`)
      }
    } catch (e) {
      setSyncMsg(`שגיאה: ${e.message}`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="ariel-page">
      <div className="container">
        <Link to="/" className="ariel-back">&rarr; חזרה לדף הבית</Link>

        <h1 className="ariel-title">הנהלת חשבונות</h1>

        <section className="ariel-sections">
          <div className="ariel-sections-grid">
            <Link to="/accounting/supplier-inbox" className="ariel-section-card">
              <span className="ariel-section-icon">📬</span>
              <h3 className="ariel-section-title">רישום חשבוניות ספק</h3>
              <p className="ariel-section-desc">חשבוניות שהתקבלו במייל ממתינות לאישור ורישום בפריוריטי</p>
              <span className="ariel-section-action">פתיחה &larr;</span>
            </Link>

            <Link to="/accounting/receipts" className="ariel-section-card">
              <span className="ariel-section-icon">🏦</span>
              <h3 className="ariel-section-title">תנועות בנק</h3>
              <p className="ariel-section-desc">תנועות בנק שטרם הותאמו — בדיקה והפקת קבלות בפריוריטי</p>
              <span className="ariel-section-action">פתיחה &larr;</span>
            </Link>

            <Link to="/accounting/journal" className="ariel-section-card">
              <span className="ariel-section-icon">📒</span>
              <h3 className="ariel-section-title">רישום פקודות יומן</h3>
              <p className="ariel-section-desc">הזנת פקודות יומן ידניות ורישומן בפריוריטי</p>
              <span className="ariel-section-action">בקרוב &larr;</span>
            </Link>
          </div>
        </section>

        {/* Accounts sync panel */}
        <section style={{
          marginTop: 32, padding: '18px 24px', borderRadius: 12,
          background: '#f8fafc', border: '1px solid #e2e8f0',
          direction: 'rtl', maxWidth: 520,
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: '#1e293b' }}>
            מאגר חשבונות פריוריטי
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            {accStatus
              ? accStatus.count > 0
                ? `${accStatus.count.toLocaleString()} חשבונות מסונכרנים — עדכון אחרון: ${fmt(accStatus.updatedAt)}`
                : 'לא בוצע סינכרון עדיין — יש לסנכרן כדי לאפשר חיפוש חשבונות מהיר בכל הטפסים'
              : 'בודק סטטוס...'
            }
          </div>
          <button
            onClick={syncAccounts}
            disabled={syncing}
            style={{
              padding: '7px 18px', borderRadius: 8, cursor: syncing ? 'default' : 'pointer',
              background: syncing ? '#94a3b8' : '#1d4ed8', color: '#fff',
              border: 'none', fontSize: 13, fontWeight: 600,
            }}
          >
            {syncing ? 'מסנכרן...' : 'סנכרן חשבונות מפריוריטי'}
          </button>
          {syncMsg && (
            <div style={{
              marginTop: 10, fontSize: 13, fontWeight: 600,
              color: syncMsg.startsWith('שגיאה') ? '#dc2626' : '#15803d',
            }}>
              {syncMsg}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
