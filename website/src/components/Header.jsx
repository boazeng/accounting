import { Link, useLocation } from 'react-router-dom'
import TactLogo from './TactLogo'
import './Header.css'

const navItems = [
  { path: '/', label: 'בית' },
  { path: '/accounting', label: 'הנהלת חשבונות' },
  { path: '/management-reports', label: 'דוחות ניהוליים' },
  { path: '/cashflow', label: 'תזרים' },
  // existing system pages
  { path: '/maintenance', label: 'אחזקה' },
  { path: '/parking', label: 'חניה' },
  { path: '/ariel', label: 'אריאל' },
  { path: '/energy', label: 'אנרגיה' },
  { path: '/reports', label: 'דוחות' },
  { path: '/apps', label: 'אפליקציות' },
]

export default function Header() {
  const location = useLocation()

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="header-logo" aria-label="tact accounting">
          <TactLogo tone="light" size={0.82} />
        </Link>

        <nav className="header-nav">
          {navItems.map((item) => {
            const active =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`header-nav-link ${active ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <button className="header-account" type="button">
          <span className="header-account-dot">מנ</span>
          <span className="header-account-text">מנהל מערכת</span>
        </button>
      </div>
    </header>
  )
}
