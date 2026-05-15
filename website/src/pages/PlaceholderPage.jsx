import './PlaceholderPage.css'

/* Branded "in build" page for menu items not yet implemented. */
export default function PlaceholderPage({ title, desc }) {
  return (
    <div className="ph">
      <div className="container ph-inner">
        <span className="ph-eyebrow">
          tact accounting<i />
        </span>
        <h1 className="ph-title">{title}</h1>
        <p className="ph-desc">{desc || 'המסך נמצא בבנייה — נחבר אותו בקרוב.'}</p>
        <span className="ph-badge">בבנייה</span>
      </div>
    </div>
  )
}
