import './TactLogo.css'

/* The TACT brand mark: spaced T·A·C·T letters with rust dots between,
   plus the "accounting" word on the other side of the mark.
   tone: "light" (ink letters, for light surfaces) | "dark" (cream
   letters on the ink chip). size scales the whole lockup.
   tagline: show "הטמעת מערכות בינה מלאכותית" under the mark. */
export default function TactLogo({ tone = 'light', size = 1, tagline = false, word = true }) {
  const letters = ['T', 'A', 'C', 'T']
  return (
    <span className={`tact-logo tact-logo-${tone}`} style={{ '--tact-scale': size }}>
      <span className="tact-logo-lockup">
        <span className="tact-logo-row">
          <span className="tact-logo-mark">
            {letters.map((l, i) => (
              <span key={i} className="tact-logo-seg">
                <span className="tact-logo-letter">{l}</span>
                {i < letters.length - 1 && <span className="tact-logo-dot" />}
              </span>
            ))}
          </span>
          {word && <span className="tact-logo-word">accounting</span>}
        </span>
        {tagline && (
          <span className="tact-logo-tagline">הטמעת מערכות בינה מלאכותית</span>
        )}
      </span>
    </span>
  )
}
