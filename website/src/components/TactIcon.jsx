/* TACT icon language — one consistent line set.
   Rules: 24x24 grid, 1.8 stroke, round joins, currentColor.
   Add new glyphs here so every icon stays in the same family. */
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
  accounting: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3 H15 L19 7 V21 H6 Z" />
      <path d="M9 12 H15 M9 16 H13" />
      <path d="M13 3 V8 H19" />
    </g>
  ),
  calendar: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 9 H20 M8 3 V6 M16 3 V6" />
    </g>
  ),
}

export default function TactIcon({ name, size = 20, className = '' }) {
  return (
    <svg
      className={`tact-icon ${className}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
    >
      {GLYPHS[name] || null}
    </svg>
  )
}
