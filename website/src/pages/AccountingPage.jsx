import { Link } from 'react-router-dom'
import './ArielPage.css'

export default function AccountingPage() {
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
      </div>
    </div>
  )
}
