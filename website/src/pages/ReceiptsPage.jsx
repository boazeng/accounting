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

const ACTION_STYLES = {
  receipt:  { label: 'הפקת קבלה',          color: '#16a34a', bg: '#f0fdf4' },
  journal:  { label: 'רישום פקודת התאמה',  color: '#d97706', bg: '#fffbeb' },
  transfer: { label: 'הפקת העברה בנקאית',  color: '#2563eb', bg: '#eff6ff' },
}

function AmountCell({ sum1, direction }) {
  const dir = direction || ''
  const cls = dir === '+' ? 'receipts-amount-plus' : dir === '-' ? 'receipts-amount-minus' : 'receipts-amount'
  return (
    <span className={cls}>
      {dir === '+' ? '+ ' : dir === '-' ? '- ' : ''}{fmtAmount(sum1)}
    </span>
  )
}

export default function ReceiptsPage() {
  const [bankTxns, setBankTxns]       = useState([])
  const [approved, setApproved]       = useState([])
  const [doneActions, setDoneActions] = useState([])
  const [actionQueue, setActionQueue] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  const [closing, setClosing]   = useState(null)
  const [deleting, setDeleting] = useState(null)

  const [days, setDays]               = useState(180)
  const [since, setSince]             = useState('')
  const [branchFilter, setBranchFilter] = useState('all')
  const [allBranches, setAllBranches] = useState([])

  const loadAll = useCallback(async (d, b) => {
    const daysParam   = d ?? days
    const branchParam = b !== undefined ? b : branchFilter
    setLoading(true)
    setError('')
    try {
      const txnUrl = branchParam && branchParam !== 'all'
        ? `${API}/api/receipts/bank-transactions?days=${daysParam}&branch=${encodeURIComponent(branchParam)}`
        : `${API}/api/receipts/bank-transactions?days=${daysParam}`
      const [bRes, a, aq, done] = await Promise.all([
        fetch(txnUrl).then(r => r.json()),
        fetch(`${API}/api/receipts/approved`).then(r => r.json()),
        fetch(`${API}/api/receipts/action-queue`).then(r => r.json()),
        fetch(`${API}/api/receipts/action-queue/done-list`).then(r => r.json()),
      ])
      if (bRes.ok) {
        setBankTxns(bRes.transactions || [])
        setSince(bRes.since || '')
        if (!branchParam || branchParam === 'all') {
          const branches = [...new Set((bRes.transactions || []).map(t => t.BRANCHNAME).filter(Boolean))].sort()
          setAllBranches(branches)
        }
      }
      if (a.ok)    setApproved(a.receipts || [])
      if (aq.ok)   setActionQueue(aq.items || [])
      if (done.ok) setDoneActions(done.items || [])
    } catch (e) {
      setError('שגיאה בטעינת נתונים: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [days, branchFilter])

  useEffect(() => { loadAll() }, [loadAll])

  async function closeReceipt(rec) {
    if (!window.confirm(`לסגור את הקבלה ${rec.priority_ivnum} בפריוריטי?\n(פעולה זו אינה הפיכה)`)) return
    setClosing(rec.id)
    try {
      const resp = await fetch(`${API}/api/receipts/${rec.id}/close`, { method: 'POST' })
      const data = await resp.json()
      if (!data.ok) throw new Error(data.error || 'שגיאה')
      await loadAll()
      alert(`קבלה ${rec.priority_ivnum} נסגרה בהצלחה`)
    } catch (e) {
      alert('שגיאה בסגירת קבלה: ' + e.message)
    } finally {
      setClosing(null)
    }
  }

  async function deleteReceipt(rec) {
    const label = rec.priority_ivnum ? ` (${rec.priority_ivnum})` : ''
    if (!window.confirm(`למחוק את הרשומה של ${rec.accdes || rec.details || ''}${label}?\nאם נשלחה לפריוריטי יש למחוק שם ידנית.`)) return
    setDeleting(rec.id)
    try {
      const resp = await fetch(`${API}/api/receipts/${rec.id}/delete`, { method: 'POST' })
      const data = await resp.json()
      if (!data.ok) throw new Error(data.error || 'שגיאה')
      await loadAll()
    } catch (e) {
      alert('שגיאה במחיקה: ' + e.message)
    } finally {
      setDeleting(null)
    }
  }

  async function addToActionQueue(txn) {
    try {
      const resp = await fetch(`${API}/api/receipts/action-queue/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fncnum:    txn.FNCNUM,
          curdate:   txn.CURDATE,
          details:   txn.DETAILS,
          accname1:  txn.ACCNAME1,
          accdes1:   txn.ACCDES1,
          accname2:  txn.ACCNAME2,
          accdes2:   txn.ACCDES2,
          sum1:      txn.SUM1,
          direction: txn.direction,
          branchname: txn.BRANCHNAME,
          action:    txn.suggested_action || 'journal',
        }),
      })
      const data = await resp.json()
      if (!data.ok) throw new Error(data.error || 'שגיאה')
      await loadAll()
    } catch (e) {
      alert('שגיאה: ' + e.message)
    }
  }

  async function updateQueueItemAction(itemId, action) {
    try {
      await fetch(`${API}/api/receipts/action-queue/${itemId}/set-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      setActionQueue(prev => prev.map(i => i.id === itemId ? { ...i, action } : i))
    } catch (e) {
      alert('שגיאה: ' + e.message)
    }
  }

  async function markActionDone(item) {
    try {
      const resp = await fetch(`${API}/api/receipts/action-queue/${item.id}/done`, { method: 'POST' })
      const data = await resp.json()
      if (!data.ok) throw new Error(data.error || 'שגיאה')
      await loadAll()
    } catch (e) {
      alert('שגיאה: ' + e.message)
    }
  }

  async function removeFromActionQueue(item) {
    try {
      const resp = await fetch(`${API}/api/receipts/action-queue/${item.id}/remove`, { method: 'POST' })
      const data = await resp.json()
      if (!data.ok) throw new Error(data.error || 'שגיאה')
      await loadAll()
    } catch (e) {
      alert('שגיאה: ' + e.message)
    }
  }

  const sentCount = approved.length + doneActions.length

  return (
    <div className="receipts-page" dir="rtl">
      <div className="receipts-container">
        <Link to="/accounting" className="receipts-back">&rarr; חזרה להנהלת חשבונות</Link>
        <h1 className="receipts-title">תנועות בנק</h1>

        {loading && <p className="receipts-loading">טוען נתונים...</p>}
        {error   && <p className="receipts-error">{error}</p>}

        {!loading && (
          <>
            {/* ── Section A: Sent to Priority ── */}
            {sentCount > 0 && (
              <section className="receipts-section">
                <div className="receipts-section-header">
                  <h2>פעולות שנשלחו לפריוריטי</h2>
                  <span className="receipts-badge" style={{ background: '#16a34a' }}>{sentCount}</span>
                </div>
                <div className="receipts-table-wrap">
                  <table className="receipts-table">
                    <thead>
                      <tr>
                        <th>תאריך</th>
                        <th>תיאור / לקוח</th>
                        <th>סכום</th>
                        <th>פעולה</th>
                        <th>מזהה בפריוריטי</th>
                        <th>סניף</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Approved receipts (created via TINVOICES) */}
                      {approved.map(rec => {
                        const s = ACTION_STYLES.receipt
                        return (
                          <tr key={`rec-${rec.id}`} style={rec.status === 'closed' ? { opacity: 0.6 } : {}}>
                            <td>{fmt(rec.approved_at)}</td>
                            <td>{rec.accdes}</td>
                            <td><AmountCell sum1={rec.totprice} direction="+" /></td>
                            <td>
                              <span className="receipts-action-label" style={{ color: s.color, background: s.bg }}>
                                {s.label}
                              </span>
                            </td>
                            <td className="receipts-mono" style={{ color: '#6c5ce7', fontWeight: 700 }}>
                              {rec.priority_ivnum || '—'}
                            </td>
                            <td>{rec.branchname}</td>
                            <td className="receipts-actions">
                              {rec.status !== 'closed' && rec.priority_ivnum && (
                                <button
                                  className="receipts-btn receipts-btn-approve"
                                  onClick={() => closeReceipt(rec)}
                                  disabled={closing === rec.id}
                                >
                                  {closing === rec.id ? 'סוגר...' : 'סגור קבלה'}
                                </button>
                              )}
                              {rec.status === 'closed' && (
                                <span style={{ color: '#16a34a', fontSize: '0.85em' }}>✓ סגורה</span>
                              )}
                              <button
                                className="receipts-btn receipts-btn-reject"
                                onClick={() => deleteReceipt(rec)}
                                disabled={deleting === rec.id}
                              >
                                {deleting === rec.id ? '...' : 'מחק'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                      {/* Done action queue items */}
                      {doneActions.map(item => {
                        const s = ACTION_STYLES[item.action] || ACTION_STYLES.journal
                        return (
                          <tr key={`done-${item.id}`}>
                            <td>{fmt(item.done_at || item.curdate)}</td>
                            <td>{item.accdes1 || item.details}</td>
                            <td><AmountCell sum1={item.sum1} direction={item.direction} /></td>
                            <td>
                              <span className="receipts-action-label" style={{ color: s.color, background: s.bg }}>
                                {s.label}
                              </span>
                            </td>
                            <td className="receipts-mono" style={{ color: '#9ca3af' }}>—</td>
                            <td>{item.branchname}</td>
                            <td></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── Section B: Action queue (pending treatment) ── */}
            {actionQueue.length > 0 && (
              <section className="receipts-section">
                <div className="receipts-section-header">
                  <h2>פעולות לביצוע</h2>
                  <span className="receipts-badge" style={{ background: '#d97706' }}>{actionQueue.length}</span>
                </div>
                <p className="receipts-hint">בצע את הפעולה בפריוריטי ולחץ "בוצע"</p>
                <div className="receipts-table-wrap">
                  <table className="receipts-table">
                    <thead>
                      <tr>
                        <th>תאריך</th>
                        <th>תיאור</th>
                        <th>חשבון</th>
                        <th>סכום</th>
                        <th>סניף</th>
                        <th>פעולה</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {actionQueue.map(item => (
                        <tr key={item.id}>
                          <td>{fmt(item.curdate)}</td>
                          <td>{item.details}</td>
                          <td title={item.accname1} className="receipts-mono">{item.accdes1 || item.accname1}</td>
                          <td><AmountCell sum1={item.sum1} direction={item.direction} /></td>
                          <td>{item.branchname}</td>
                          <td>
                            <select
                              className="receipts-action-select"
                              value={item.action}
                              onChange={e => updateQueueItemAction(item.id, e.target.value)}
                            >
                              {Object.entries(ACTION_STYLES).map(([val, s]) => (
                                <option key={val} value={val}>{s.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="receipts-actions">
                            <button
                              className="receipts-btn receipts-btn-approve"
                              onClick={() => markActionDone(item)}
                            >
                              ✓ בוצע
                            </button>
                            <button
                              className="receipts-btn receipts-btn-cancel"
                              onClick={() => removeFromActionQueue(item)}
                              title="החזר לרשימת התנועות"
                            >
                              ביטול
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── Section C: Unmatched bank transactions ── */}
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
                    onChange={e => { const v = e.target.value; setBranchFilter(v); loadAll(undefined, v) }}
                  >
                    <option value="all">כל הסניפים</option>
                    {allBranches.map(b => <option key={b} value={b}>{b}</option>)}
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
                לחץ על הפעולה המוצעת להעברה לתור הביצוע
              </p>
              {bankTxns.filter(t => !t.already_queued).length === 0 ? (
                <p className="receipts-empty">אין תנועות בנק פתוחות בתקופה זו</p>
              ) : (
                <div className="receipts-table-wrap">
                  <table className="receipts-table">
                    <thead>
                      <tr>
                        <th>תאריך</th>
                        <th>תיאור תנועה</th>
                        <th>חשבון</th>
                        <th>סכום</th>
                        <th>בנק</th>
                        <th>סניף</th>
                        <th>פעולה מוצעת</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bankTxns.filter(t => !t.already_queued).map(txn => {
                        const action = txn.suggested_action || 'journal'
                        const s = ACTION_STYLES[action] || ACTION_STYLES.journal
                        return (
                          <tr key={txn.FNCNUM}>
                            <td>{fmt(txn.CURDATE)}</td>
                            <td>{txn.DETAILS}</td>
                            <td title={txn.ACCNAME1} className="receipts-mono">{txn.ACCDES1 || txn.ACCNAME1}</td>
                            <td><AmountCell sum1={txn.SUM1} direction={txn.direction} /></td>
                            <td className="receipts-small" title={txn.ACCNAME2}>{txn.ACCDES2 || txn.ACCNAME2}</td>
                            <td>{txn.BRANCHNAME}</td>
                            <td>
                              <button
                                className="receipts-action-btn"
                                style={{ color: s.color, background: s.bg, borderColor: s.color + '55' }}
                                onClick={() => addToActionQueue(txn)}
                                title="לחץ להעברה לתור ביצוע"
                              >
                                {s.label} ←
                              </button>
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
    </div>
  )
}
