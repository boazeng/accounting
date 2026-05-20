import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import './ReceiptsPage.css'

const API = 'http://localhost:5000'

function fmt(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function fmtAmount(n) {
  if (n == null) return ''
  return Number(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₪'
}

const TXN_TYPES = {
  receipt:      { label: 'תקבול לקוח',     color: '#16a34a', action: 'queue' },
  fee:          { label: 'עמלה / הוצאה',   color: '#d97706', action: 'process' },
  transfer:     { label: 'העברה בנקאית',   color: '#2563eb', action: 'process' },
  intercompany: { label: 'חו"ז',            color: '#7c3aed', action: 'process' },
  internal:     { label: 'פנימי',           color: '#64748b', action: 'process' },
  supplier:     { label: 'ספק',             color: '#b45309', action: 'process' },
  loan:         { label: 'הלוואה',          color: '#0891b2', action: 'process' },
  other:        { label: 'אחר',             color: '#6b7280', action: 'process' },
}

export default function ReceiptsPage() {
  const [bankTxns, setBankTxns] = useState([])
  const [pending, setPending] = useState([])
  const [approved, setApproved] = useState([])
  const [cashAccounts, setCashAccounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Queue-modal state
  const [modal, setModal] = useState(null)    // null | { txn }
  const [modalCash, setModalCash] = useState('')
  const [modalDate, setModalDate] = useState('')
  const [modalDetails, setModalDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Approve-confirm modal
  const [approveTarget, setApproveTarget] = useState(null)
  const [approving, setApproving] = useState(false)

  // Edit-pending modal
  const [editTarget, setEditTarget] = useState(null)   // pending receipt
  const [editCash, setEditCash] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editDetails, setEditDetails] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Close receipt via Web SDK
  const [closing, setClosing] = useState(null)  // receipt id being closed

  const [days, setDays] = useState(180)
  const [since, setSince] = useState('')
  const [branchFilter, setBranchFilter] = useState('all')
  const [allBranches, setAllBranches] = useState([])
  const [processing, setProcessing] = useState(null)  // fncnum being marked

  const loadAll = useCallback(async (d, b) => {
    const daysParam = d ?? days
    const branchParam = b !== undefined ? b : branchFilter
    setLoading(true)
    setError('')
    try {
      const txnUrl = branchParam && branchParam !== 'all'
        ? `${API}/api/receipts/bank-transactions?days=${daysParam}&branch=${encodeURIComponent(branchParam)}`
        : `${API}/api/receipts/bank-transactions?days=${daysParam}`
      const [bRes, p, a, c] = await Promise.all([
        fetch(txnUrl).then(r => r.json()),
        fetch(`${API}/api/receipts/pending`).then(r => r.json()),
        fetch(`${API}/api/receipts/approved`).then(r => r.json()),
        fetch(`${API}/api/receipts/cash-accounts`).then(r => r.json()),
      ])
      if (bRes.ok) {
        setBankTxns(bRes.transactions || [])
        setSince(bRes.since || '')
        // When loading all branches, capture the branch list for the dropdown
        if (!branchParam || branchParam === 'all') {
          const branches = [...new Set((bRes.transactions || []).map(t => t.BRANCHNAME).filter(Boolean))].sort()
          setAllBranches(branches)
        }
      }
      if (p.ok) setPending(p.receipts || [])
      if (a.ok) setApproved(a.receipts || [])
      if (c.ok) setCashAccounts(c.byBranch || {})
    } catch (e) {
      setError('שגיאה בטעינת נתונים: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [days, branchFilter])

  useEffect(() => { loadAll() }, [loadAll])

  function openModal(txn) {
    const branch = txn.BRANCHNAME || ''
    const options = cashAccounts[branch] || []
    setModal({ txn })
    setModalCash(options[0] || '')
    setModalDate((txn.CURDATE || '').slice(0, 10))
    setModalDetails(txn.DETAILS || 'תקבול')
    setSubmitError('')
  }

  async function submitQueue() {
    if (!modal) return
    const { txn } = modal
    if (!modalCash) { setSubmitError('נא לבחור חשבון בנק'); return }
    setSubmitting(true)
    setSubmitError('')
    try {
      const resp = await fetch(`${API}/api/receipts/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fncnum: txn.FNCNUM,
          accname: txn.ACCNAME1,
          accdes: txn.ACCDES1,
          cashname: modalCash,
          totprice: txn.SUM1,
          ivdate: modalDate || txn.CURDATE,
          branchname: txn.BRANCHNAME,
          details: modalDetails,
        }),
      })
      const data = await resp.json()
      if (!data.ok) throw new Error(data.error || 'שגיאה')
      setModal(null)
      await loadAll()
    } catch (e) {
      setSubmitError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function approveReceipt(rec) {
    setApproving(true)
    try {
      const resp = await fetch(`${API}/api/receipts/${rec.id}/approve`, { method: 'POST' })
      const data = await resp.json()
      if (!data.ok) {
        const detail = data.detail ? `\n\nפרטים: ${JSON.stringify(data.detail)}` : ''
        throw new Error((data.error || 'שגיאה') + detail)
      }
      setApproveTarget(null)
      await loadAll()
      alert(`נוצרה קבלה סופית בפריוריטי: ${data.priority_ivnum}`)
    } catch (e) {
      alert('שגיאה באישור: ' + e.message)
    } finally {
      setApproving(false)
    }
  }

  function openEdit(rec) {
    setEditTarget(rec)
    setEditCash(rec.cashname || '')
    setEditDate((rec.ivdate || '').slice(0, 10))
    setEditDetails(rec.details || '')
  }

  async function saveEdit() {
    if (!editTarget) return
    setEditSaving(true)
    try {
      const resp = await fetch(`${API}/api/receipts/${editTarget.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashname: editCash, ivdate: editDate, details: editDetails }),
      })
      const data = await resp.json()
      if (!data.ok) throw new Error(data.error || 'שגיאה')
      setEditTarget(null)
      await loadAll()
    } catch (e) {
      alert('שגיאה: ' + e.message)
    } finally {
      setEditSaving(false)
    }
  }

  async function closeReceipt(rec) {
    if (!window.confirm(`לסגור את הקבלה ${rec.priority_ivnum} בפריוריטי?\n(פעולה זו מפעילה פרוצדורת סגירה — אינה הפיכה)`)) return
    setClosing(rec.id)
    try {
      const resp = await fetch(`${API}/api/receipts/${rec.id}/close`, { method: 'POST' })
      const data = await resp.json()
      if (!data.ok) throw new Error(data.error || 'שגיאה')
      await loadAll()
      alert(`קבלה ${rec.priority_ivnum} נסגרה בהצלחה בפריוריטי`)
    } catch (e) {
      alert('שגיאה בסגירת קבלה: ' + e.message)
    } finally {
      setClosing(null)
    }
  }

  async function rejectReceipt(rec) {
    if (!window.confirm(`לבטל את הקבלה של ${rec.accdes}?`)) return
    try {
      const resp = await fetch(`${API}/api/receipts/${rec.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'בוטל על ידי מנהלת חשבונות' }),
      })
      const data = await resp.json()
      if (!data.ok) throw new Error(data.error || 'שגיאה')
      await loadAll()
    } catch (e) {
      alert('שגיאה: ' + e.message)
    }
  }

  async function markProcessed(txn) {
    setProcessing(txn.FNCNUM)
    try {
      const resp = await fetch(`${API}/api/receipts/bank-transactions/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fncnum: txn.FNCNUM }),
      })
      const data = await resp.json()
      if (!data.ok) throw new Error(data.error || 'שגיאה')
      await loadAll()
    } catch (e) {
      alert('שגיאה: ' + e.message)
    } finally {
      setProcessing(null)
    }
  }

  const branchOptions = modal ? (cashAccounts[modal.txn.BRANCHNAME] || Object.values(cashAccounts).flat()) : []

  return (
    <div className="receipts-page" dir="rtl">
      <div className="receipts-container">
        <Link to="/accounting" className="receipts-back">&rarr; חזרה להנהלת חשבונות</Link>
        <h1 className="receipts-title">תנועות בנק</h1>

        {loading && <p className="receipts-loading">טוען נתונים...</p>}
        {error && <p className="receipts-error">{error}</p>}

        {!loading && (
          <>
            {/* ── Section 1: Pending approvals (local queue) ── */}
            <section className="receipts-section">
              <div className="receipts-section-header">
                <h2>קבלות ממתינות לאישור</h2>
                <span className="receipts-badge receipts-badge-orange">{pending.length}</span>
                <button className="receipts-refresh" onClick={loadAll}>רענן</button>
              </div>
              <p className="receipts-hint">
                לאחר אישור — תיווצר טיוטת קבלה בפריוריטי
              </p>
              {pending.length === 0 ? (
                <p className="receipts-empty">אין קבלות ממתינות לאישור</p>
              ) : (
                <div className="receipts-table-wrap">
                  <table className="receipts-table">
                    <thead>
                      <tr>
                        <th>תאריך</th>
                        <th>לקוח</th>
                        <th>חשבון לקוח</th>
                        <th>חשבון בנק</th>
                        <th>סכום</th>
                        <th>פירוט</th>
                        <th>סניף</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.map(rec => (
                        <tr key={rec.id}>
                          <td>{fmt(rec.ivdate)}</td>
                          <td>{rec.accdes}</td>
                          <td className="receipts-mono">{rec.accname}</td>
                          <td className="receipts-mono">{rec.cashname}</td>
                          <td className="receipts-amount">{fmtAmount(rec.totprice)}</td>
                          <td>{rec.details}</td>
                          <td>{rec.branchname}</td>
                          <td className="receipts-actions">
                            <button
                              className="receipts-btn receipts-btn-approve"
                              onClick={() => setApproveTarget(rec)}
                            >
                              אשר ושלח לפריוריטי
                            </button>
                            <button
                              className="receipts-btn receipts-btn-edit"
                              onClick={() => openEdit(rec)}
                            >
                              ערוך
                            </button>
                            <button
                              className="receipts-btn receipts-btn-reject"
                              onClick={() => rejectReceipt(rec)}
                            >
                              דחה
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── Section 1b: Approved receipts (sent to Priority) ── */}
            {approved.length > 0 && (
              <section className="receipts-section">
                <div className="receipts-section-header">
                  <h2>קבלות שנשלחו לפריוריטי</h2>
                  <span className="receipts-badge" style={{ background: '#16a34a' }}>{approved.length}</span>
                </div>
                <p className="receipts-hint">
                  קבלות סופיות שנוצרו בפריוריטי
                </p>
                <div className="receipts-table-wrap">
                  <table className="receipts-table">
                    <thead>
                      <tr>
                        <th>תאריך אישור</th>
                        <th>לקוח</th>
                        <th>סכום</th>
                        <th>מס׳ קבלה בפריוריטי</th>
                        <th>חשבון בנק</th>
                        <th>פירוט</th>
                        <th>סניף</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {approved.map(rec => (
                        <tr key={rec.id} style={rec.status === 'closed' ? { opacity: 0.6 } : {}}>
                          <td>{fmt(rec.approved_at)}</td>
                          <td>{rec.accdes}</td>
                          <td className="receipts-amount">{fmtAmount(rec.totprice)}</td>
                          <td className="receipts-mono" style={{ color: '#6c5ce7', fontWeight: 700 }}>
                            {rec.priority_ivnum || '—'}
                          </td>
                          <td className="receipts-mono">{rec.cashname}</td>
                          <td>{rec.details}</td>
                          <td>{rec.branchname}</td>
                          <td>
                            {rec.status !== 'closed' && rec.priority_ivnum && (
                              <button
                                className="receipts-btn receipts-btn-approve"
                                onClick={() => closeReceipt(rec)}
                                disabled={closing === rec.id}
                                title="הפעל פרוצדורת CLOSETIV בפריוריטי"
                              >
                                {closing === rec.id ? 'סוגר...' : 'סגור קבלה'}
                              </button>
                            )}
                            {rec.status === 'closed' && <span style={{ color: '#16a34a', fontSize: '0.85em' }}>✓ סגורה</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── Section 2: Unmatched bank transactions ── */}
            <section className="receipts-section">
              <div className="receipts-section-header">
                <h2>תנועות בנק ללא התאמה</h2>
                <span className="receipts-badge">
                  {bankTxns.filter(t => !t.already_queued).length}
                </span>
                <div className="receipts-days-selector">
                  <label>סניף:</label>
                  <select
                    value={branchFilter}
                    onChange={e => {
                      const newBranch = e.target.value
                      setBranchFilter(newBranch)
                      loadAll(undefined, newBranch)
                    }}
                  >
                    <option value="all">כל הסניפים</option>
                    {allBranches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="receipts-days-selector">
                  <label>הצג מ-</label>
                  <select
                    value={days}
                    onChange={e => { const d = Number(e.target.value); setDays(d); loadAll(d, branchFilter) }}
                  >
                    <option value={30}>30 יום</option>
                    <option value={60}>60 יום</option>
                    <option value={90}>90 יום</option>
                    <option value={180}>חצי שנה</option>
                    <option value={365}>שנה</option>
                  </select>
                  {since && <span className="receipts-since">({fmt(since + 'T00:00:00Z')} ואילך)</span>}
                </div>
                <button className="receipts-refresh" onClick={() => loadAll(undefined, branchFilter)}>רענן</button>
              </div>
              <p className="receipts-hint">
                תנועות בנק שיובאו ועדיין לא הותאמו בפריוריטי.
                תקבול לקוח → הוסף לתור קבלות | עמלה / הוצאה / העברה → סמן כמטופל לאחר ביצוע ידני בפריוריטי.
              </p>
              {bankTxns.filter(t => !t.already_queued).length === 0 ? (
                <p className="receipts-empty">אין תנועות בנק פתוחות בתקופה זו</p>
              ) : (
                <div className="receipts-table-wrap">
                  <table className="receipts-table">
                    <thead>
                      <tr>
                        <th>תאריך</th>
                        <th>סוג</th>
                        <th>תיאור תנועה</th>
                        <th>חשבון</th>
                        <th>סכום</th>
                        <th>בנק</th>
                        <th>סניף</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {bankTxns.filter(t => !t.already_queued).map(txn => {
                        const typeInfo = TXN_TYPES[txn.txn_type] || TXN_TYPES.other
                        return (
                          <tr key={txn.FNCNUM}>
                            <td>{fmt(txn.CURDATE)}</td>
                            <td>
                              <span className="receipts-type-badge" style={{ background: typeInfo.color }}>
                                {typeInfo.label}
                              </span>
                            </td>
                            <td>{txn.DETAILS}</td>
                            <td title={txn.ACCNAME1} className="receipts-mono">{txn.ACCDES1 || txn.ACCNAME1}</td>
                            <td className="receipts-amount">{fmtAmount(txn.SUM1)}</td>
                            <td className="receipts-small" title={txn.ACCNAME2}>{txn.ACCDES2 || txn.ACCNAME2}</td>
                            <td>{txn.BRANCHNAME}</td>
                            <td>
                              {typeInfo.action === 'queue' ? (
                                <button
                                  className="receipts-btn receipts-btn-queue"
                                  onClick={() => openModal(txn)}
                                >
                                  + הוסף לתור
                                </button>
                              ) : (
                                <button
                                  className="receipts-btn receipts-btn-process"
                                  onClick={() => markProcessed(txn)}
                                  disabled={processing === txn.FNCNUM}
                                  title="סמן כמטופל — התנועה תוסר מהתור לאחר ביצוע ידני בפריוריטי"
                                >
                                  {processing === txn.FNCNUM ? '...' : '✓ מטופל'}
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* ── Queue modal ── */}
      {modal && (
        <div className="receipts-modal-overlay" onClick={() => setModal(null)}>
          <div className="receipts-modal" onClick={e => e.stopPropagation()} dir="rtl">
            <h3>הוספה לתור קבלות</h3>
            <p className="receipts-modal-note">הקבלה תישמר במערכת שלנו בלבד. לא תישלח לפריוריטי עד לאחר אישורך.</p>
            <table className="receipts-modal-info">
              <tbody>
                <tr><th>תנועה:</th><td className="receipts-mono">{modal.txn.FNCNUM}</td></tr>
                <tr><th>תיאור:</th><td>{modal.txn.DETAILS}</td></tr>
                <tr><th>חשבון:</th><td>{modal.txn.ACCDES1 || modal.txn.ACCNAME1}</td></tr>
                <tr><th>סכום:</th><td>{fmtAmount(modal.txn.SUM1)}</td></tr>
                <tr><th>בנק:</th><td className="receipts-small">{modal.txn.ACCDES2 || modal.txn.ACCNAME2}</td></tr>
                <tr><th>סניף:</th><td>{modal.txn.BRANCHNAME}</td></tr>
              </tbody>
            </table>

            <div className="receipts-modal-field">
              <label>תאריך קבלה:</label>
              <input
                type="date"
                value={modalDate}
                onChange={e => setModalDate(e.target.value)}
                dir="ltr"
              />
            </div>

            <div className="receipts-modal-field">
              <label>חשבון בנק / אמצעי תשלום:</label>
              {branchOptions.length > 0 ? (
                <select value={modalCash} onChange={e => setModalCash(e.target.value)}>
                  {[...new Set(branchOptions)].map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={modalCash}
                  onChange={e => setModalCash(e.target.value)}
                  placeholder="הכנס קוד חשבון"
                />
              )}
            </div>

            <div className="receipts-modal-field">
              <label>פירוט:</label>
              <input
                value={modalDetails}
                onChange={e => setModalDetails(e.target.value)}
              />
            </div>

            {submitError && <p className="receipts-error">{submitError}</p>}

            <div className="receipts-modal-actions">
              <button
                className="receipts-btn receipts-btn-queue"
                onClick={submitQueue}
                disabled={submitting}
              >
                {submitting ? 'שומר...' : 'הוסף לתור'}
              </button>
              <button
                className="receipts-btn receipts-btn-cancel"
                onClick={() => setModal(null)}
                disabled={submitting}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Approve confirm modal ── */}
      {approveTarget && (
        <div className="receipts-modal-overlay" onClick={() => setApproveTarget(null)}>
          <div className="receipts-modal" onClick={e => e.stopPropagation()} dir="rtl">
            <h3>אישור קבלה</h3>
            <p>
              לאשר ולשלוח לפריוריטי כטיוטה?<br />
              לקוח: <strong>{approveTarget.accdes}</strong><br />
              סכום: <strong>{fmtAmount(approveTarget.totprice)}</strong>
            </p>
            <p className="receipts-warn">
              לאחר אישור תיווצר קבלה סופית בפריוריטי. פעולה זו אינה הפיכה.
            </p>
            <div className="receipts-modal-actions">
              <button
                className="receipts-btn receipts-btn-approve"
                onClick={() => approveReceipt(approveTarget)}
                disabled={approving}
              >
                {approving ? 'שולח...' : 'אשר ושלח לפריוריטי'}
              </button>
              <button
                className="receipts-btn receipts-btn-cancel"
                onClick={() => setApproveTarget(null)}
                disabled={approving}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit pending receipt modal ── */}
      {editTarget && (
        <div className="receipts-modal-overlay" onClick={() => setEditTarget(null)}>
          <div className="receipts-modal" onClick={e => e.stopPropagation()} dir="rtl">
            <h3>עריכת קבלה ממתינה</h3>
            <p className="receipts-modal-note">
              לקוח: <strong>{editTarget.accdes}</strong> · סכום: <strong>{fmtAmount(editTarget.totprice)}</strong>
            </p>
            <div className="receipts-modal-field">
              <label>תאריך קבלה:</label>
              <input
                type="date"
                value={editDate}
                onChange={e => setEditDate(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="receipts-modal-field">
              <label>חשבון בנק / קופה (קוד בפריוריטי):</label>
              <input
                value={editCash}
                onChange={e => setEditCash(e.target.value)}
                placeholder="לדוגמה: BANK001"
                dir="ltr"
              />
              <small className="receipts-cashname-hint">
                הכנס את קוד החשבון בדיוק כפי שמופיע בפריוריטי בטבלת קופות, בנקים וחברות אשראי
              </small>
            </div>
            <div className="receipts-modal-field">
              <label>פירוט:</label>
              <input
                value={editDetails}
                onChange={e => setEditDetails(e.target.value)}
              />
            </div>
            <div className="receipts-modal-actions">
              <button
                className="receipts-btn receipts-btn-approve"
                onClick={saveEdit}
                disabled={editSaving}
              >
                {editSaving ? 'שומר...' : 'שמור'}
              </button>
              <button
                className="receipts-btn receipts-btn-cancel"
                onClick={() => setEditTarget(null)}
                disabled={editSaving}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
