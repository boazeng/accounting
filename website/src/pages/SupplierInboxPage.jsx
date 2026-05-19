import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './SupplierInvoicesPage.css'

const API = import.meta.env.DEV ? 'http://localhost:5000' : ''

const STATUS_LABEL = { pending: 'ממתין', approved: 'אושר', rejected: 'נדחה' }
const STATUS_COLOR = { pending: '#f59e0b', approved: '#22c55e', rejected: '#ef4444' }

function PdfPreviewModal({ invoiceId, filename, onClose }) {
  const [pdfUrl, setPdfUrl] = useState(null)

  useEffect(() => {
    fetch(`${API}/api/supplier-inbox/${invoiceId}/pdf`)
      .then(r => r.json())
      .then(data => {
        if (data.pdf_base64) {
          const bytes = atob(data.pdf_base64)
          const arr = new Uint8Array(bytes.length)
          for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
          const blob = new Blob([arr], { type: 'application/pdf' })
          setPdfUrl(URL.createObjectURL(blob))
        }
      })
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }
  }, [invoiceId])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, width: '80vw', height: '85vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{filename}</strong>
          <button onClick={onClose} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 14px', cursor: 'pointer' }}>סגור</button>
        </div>
        {pdfUrl
          ? <iframe src={pdfUrl} style={{ flex: 1, border: 'none', borderRadius: 8 }} title="PDF Preview" />
          : <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>טוען PDF...</div>
        }
      </div>
    </div>
  )
}

function ApproveModal({ invoice, onClose, onApproved }) {
  const [form, setForm] = useState({
    supname: invoice.supname || '',
    branch: invoice.branch || '',
    sku: invoice.sku || '',
    date: invoice.date || '',
    invoice_num: invoice.invoice_num || '',
    amount_no_vat: invoice.amount_no_vat || '',
    description: invoice.description || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleApprove = async () => {
    setError('')
    if (!form.supname) return setError('יש להזין מספר ספק בפריוריטי')
    if (!form.branch) return setError('יש להזין סניף')
    if (!form.invoice_num) return setError('יש להזין מספר חשבונית')
    setLoading(true)
    try {
      const resp = await fetch(`${API}/api/supplier-inbox/${invoice.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await resp.json()
      if (!data.ok) { setError(data.error || 'שגיאה לא ידועה'); setLoading(false); return }
      onApproved(data.ivnum)
    } catch (e) {
      setError(String(e))
      setLoading(false)
    }
  }

  const field = (label, key, type = 'text') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 14, textAlign: 'right' }}
      />
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 480, direction: 'rtl' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>אישור חשבונית ספק</h3>

        <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#444' }}>
          <div><strong>מאת:</strong> {invoice.email_from}</div>
          <div><strong>נושא:</strong> {invoice.email_subject}</div>
          <div><strong>קובץ:</strong> {invoice.pdf_filename}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {field('מספר ספק בפריוריטי *', 'supname')}
          {field('סניף *', 'branch')}
          {field('מספר חשבונית *', 'invoice_num')}
          {field('תאריך', 'date')}
          {field('סכום לפני מע"מ', 'amount_no_vat')}
          {field('מקט (PARTNAME)', 'sku')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>תיאור</label>
          <input
            value={form.description}
            onChange={e => set('description', e.target.value)}
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 14, textAlign: 'right' }}
          />
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={loading} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>ביטול</button>
          <button onClick={handleApprove} disabled={loading} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {loading ? 'שולח לפריוריטי...' : 'אשר ושלח לפריוריטי'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SupplierInboxPage() {
  const [invoices, setInvoices] = useState([])
  const [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)
  const [pollResult, setPollResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [previewId, setPreviewId] = useState(null)
  const [approveInvoice, setApproveInvoice] = useState(null)
  const [error, setError] = useState('')

  const load = async (all = showAll) => {
    setLoading(true)
    try {
      const ep = all ? '/api/supplier-inbox/all' : '/api/supplier-inbox/pending'
      const data = await fetch(`${API}${ep}`).then(r => r.json())
      if (data.ok) setInvoices(data.invoices || [])
      else setError(data.error)
    } catch (e) { setError(String(e)) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handlePoll = async () => {
    setPolling(true)
    setPollResult(null)
    try {
      const data = await fetch(`${API}/api/supplier-inbox/poll`, { method: 'POST' }).then(r => r.json())
      setPollResult(data)
      if (data.ok) load()
    } catch (e) { setPollResult({ ok: false, error: String(e) }) }
    setPolling(false)
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    setUploadResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const data = await fetch(`${API}/api/supplier-inbox/upload`, { method: 'POST', body: form }).then(r => r.json())
      setUploadResult(data)
      if (data.ok) load()
    } catch (e) { setUploadResult({ ok: false, error: String(e) }) }
    setUploading(false)
  }

  const handleReject = async (id) => {
    if (!confirm('לדחות חשבונית זו?')) return
    await fetch(`${API}/api/supplier-inbox/${id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: '' }) })
    load()
  }

  const toggleShowAll = () => {
    const next = !showAll
    setShowAll(next)
    load(next)
  }

  const previewInvoice = invoices.find(i => i.id === previewId)

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', direction: 'rtl', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Link to="/accounting" style={{ color: '#6366f1', textDecoration: 'none', fontSize: 14 }}>→ חזרה להנהלת חשבונות</Link>

        <h1 style={{ fontSize: 26, fontWeight: 700, margin: '12px 0 4px' }}>📬 תיבת חשבוניות ספק</h1>
        <p style={{ color: '#6b7280', margin: '0 0 24px', fontSize: 14 }}>חשבוניות שהתקבלו במייל ממתינות לאישור</p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={handlePoll} disabled={polling} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            {polling ? '⏳ בודק מייל...' : '📥 בדוק מייל עכשיו'}
          </button>

          <label style={{
            padding: '10px 20px', borderRadius: 8, border: 'none',
            background: uploading ? '#d1d5db' : '#0ea5e9', color: '#fff',
            fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 14,
            display: 'inline-block',
          }}>
            {uploading ? '⏳ מנתח חשבונית...' : '📎 העלה חשבונית PDF'}
            <input
              type="file" accept=".pdf" onChange={handleUpload}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>

          <button onClick={toggleShowAll} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 14 }}>
            {showAll ? 'הצג ממתינים בלבד' : 'הצג הכל (כולל מאושרות ודחויות)'}
          </button>
        </div>

        {uploadResult && (
          <div style={{ background: uploadResult.ok ? '#dcfce7' : '#fee2e2', color: uploadResult.ok ? '#166534' : '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            {uploadResult.ok
              ? `✅ הקובץ נשמר — לחצי "אשר" כדי למלא את הפרטים ולשלוח לפריוריטי`
              : `❌ ${uploadResult.error}`}
          </div>
        )}

        {pollResult && (
          <div style={{ background: pollResult.ok ? '#dcfce7' : '#fee2e2', color: pollResult.ok ? '#166534' : '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            {pollResult.ok
              ? `✅ עובד: ${pollResult.processed} חדשות | ${pollResult.skipped} דולגו | ${pollResult.errors} שגיאות`
              : `❌ ${pollResult.error}`}
          </div>
        )}

        {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>{error}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', color: '#888', padding: 48 }}>טוען...</div>
        ) : invoices.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', padding: 64, background: '#fff', borderRadius: 12 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div>אין חשבוניות ממתינות</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {invoices.map(inv => (
              <div key={inv.id} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ background: STATUS_COLOR[inv.status] + '22', color: STATUS_COLOR[inv.status], borderRadius: 20, padding: '2px 12px', fontSize: 12, fontWeight: 700 }}>
                      {STATUS_LABEL[inv.status]}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{inv.pdf_filename}</span>
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>{inv.received_at?.slice(0, 16).replace('T', ' ')}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '4px 20px', fontSize: 13 }}>
                    {inv.email_from && inv.email_from !== 'העלאה ידנית' && <div><span style={{ color: '#9ca3af' }}>מאת: </span>{inv.email_from}</div>}
                    {inv.email_from === 'העלאה ידנית' && <div><span style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: 4, padding: '1px 7px', fontSize: 11 }}>📎 הועלה ידנית</span></div>}
                    {inv.invoice_num && <div><span style={{ color: '#9ca3af' }}>מס׳ חשב׳: </span><strong>{inv.invoice_num}</strong></div>}
                    {inv.date && <div><span style={{ color: '#9ca3af' }}>תאריך: </span>{inv.date}</div>}
                    {inv.amount_with_vat && <div><span style={{ color: '#9ca3af' }}>כולל מע"מ: </span><strong>₪{Number(inv.amount_with_vat).toLocaleString()}</strong></div>}
                    {inv.amount_no_vat && <div><span style={{ color: '#9ca3af' }}>לפני מע"מ: </span>₪{Number(inv.amount_no_vat).toLocaleString()}</div>}
                    {inv.description && <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#9ca3af' }}>תיאור: </span>{inv.description}</div>}
                    {inv.supplier_name && <div><span style={{ color: '#9ca3af' }}>ח.פ.: </span>{inv.supplier_name}</div>}
                    {inv.priority_ivnum && <div><span style={{ color: '#9ca3af' }}>פריוריטי: </span><strong>{inv.priority_ivnum}</strong></div>}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 110 }}>
                  <button onClick={() => setPreviewId(inv.id)} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                    👁 צפה ב-PDF
                  </button>
                  {inv.status === 'pending' && <>
                    <button onClick={() => setApproveInvoice(inv)} style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                      ✅ אשר
                    </button>
                    <button onClick={() => handleReject(inv.id)} style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                      ✗ דחה
                    </button>
                  </>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewId && (
        <PdfPreviewModal
          invoiceId={previewId}
          filename={previewInvoice?.pdf_filename || ''}
          onClose={() => setPreviewId(null)}
        />
      )}

      {approveInvoice && (
        <ApproveModal
          invoice={approveInvoice}
          onClose={() => setApproveInvoice(null)}
          onApproved={(ivnum) => {
            setApproveInvoice(null)
            setPollResult({ ok: true, processed: 0, skipped: 0, errors: 0 })
            alert(`✅ חשבונית נוצרה בפריוריטי: ${ivnum}`)
            load()
          }}
        />
      )}
    </div>
  )
}
