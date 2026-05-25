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
  receipt:         { label: 'הפקת קבלה',          color: '#16a34a', bg: '#f0fdf4' },
  invoice_receipt: { label: 'חשבונית קבלה',        color: '#7c3aed', bg: '#f5f3ff' },
  journal:         { label: 'פקודת התאמה',         color: '#b45309', bg: '#fff7ed' },
  transfer:        { label: 'העברה בנקאית',        color: '#1d4ed8', bg: '#eff6ff' },
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
  const [bankTxns, setBankTxns]           = useState([])
  const [draftReceipts, setDraftReceipts] = useState([])
  const [closedReceipts, setClosedReceipts] = useState([])
  const [doneActions, setDoneActions]     = useState([])  // journal/transfer entries sent to Priority
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const [closing, setClosing]     = useState(null)
  const [deleting, setDeleting]   = useState(null)
  const [actioning, setActioning] = useState(null)
  const [rowActions, setRowActions] = useState({}) // fncnum → 'receipt'|'journal'|'transfer'

  const [days, setDays]               = useState(180)
  const [since, setSince]             = useState('')
  const [branchFilter, setBranchFilter] = useState('all')
  const [allBranches, setAllBranches] = useState([])

  // Receipt modal state
  const [receiptModal, setReceiptModal]       = useState(null)
  const [modalAccname, setModalAccname]       = useState('')
  const [modalAccdes, setModalAccdes]         = useState('')  // customer name
  const [modalDetails, setModalDetails]       = useState('')
  const [modalSending, setModalSending]       = useState(false)
  const [modalError, setModalError]           = useState('')
  const [lastIvnum, setLastIvnum]             = useState(null)
  const [custSuggestions, setCustSuggestions] = useState([])
  const [custSearching, setCustSearching]     = useState(false)
  const [openInvoices, setOpenInvoices]       = useState([])
  const [invoiceSearching, setInvoiceSearching] = useState(false)
  const [selectedInvoice, setSelectedInvoice]   = useState(null)
  const [existingRc, setExistingRc]             = useState(null) // RC number if receipt already exists
  const [receiptDocType, setReceiptDocType]     = useState('receipt') // 'receipt' | 'invoice_receipt'

  // Journal entry modal state
  const [journalModal, setJournalModal]               = useState(null)
  const [journalBankGlResolved, setJournalBankGlResolved] = useState('')  // detected GL account
  const [journalBankGlDesc, setJournalBankGlDesc]         = useState('')  // detected GL description
  const [journalCounterpart, setJournalCounterpart]   = useState('')
  const [journalCounterDesc, setJournalCounterDesc]   = useState('')
  const [journalDetails, setJournalDetails]           = useState('')
  const [journalSending, setJournalSending]           = useState(false)
  const [journalError, setJournalError]               = useState('')
  const [journalSuccess, setJournalSuccess]           = useState('')
  const [journalAccSuggestions, setJournalAccSuggestions] = useState([])
  const [journalAccSearching, setJournalAccSearching]     = useState(false)
  const [finalizingJournal, setFinalizingJournal]         = useState(null) // priority_fncnum being finalized

  // Invoice receipt modal state
  const [irModal, setIrModal]         = useState(null)
  const [irAccname, setIrAccname]     = useState('')
  const [irAccdes, setIrAccdes]       = useState('')
  const [irDetails, setIrDetails]     = useState('')
  const [irItems, setIrItems]         = useState([])
  const [irLoading, setIrLoading]     = useState(false)
  const [irSending, setIrSending]     = useState(false)
  const [irError, setIrError]         = useState('')
  const [irPrevNote, setIrPrevNote]   = useState('')  // feedback on previous invoice lookup

  const loadAll = useCallback(async (d, b) => {
    const daysParam   = d ?? days
    const branchParam = b !== undefined ? b : branchFilter
    setLoading(true)
    setError('')
    try {
      const txnUrl = branchParam && branchParam !== 'all'
        ? `${API}/api/receipts/bank-transactions?days=${daysParam}&branch=${encodeURIComponent(branchParam)}`
        : `${API}/api/receipts/bank-transactions?days=${daysParam}`
      const [bRes, a, doneRes] = await Promise.all([
        fetch(txnUrl).then(r => r.json()),
        fetch(`${API}/api/receipts/approved`).then(r => r.json()),
        fetch(`${API}/api/receipts/action-queue/done-list`).then(r => r.json()),
      ])
      if (bRes.ok) {
        const txns = bRes.transactions || []
        setBankTxns(txns)
        setSince(bRes.since || '')
        if (!branchParam || branchParam === 'all') {
          const branches = [...new Set(txns.map(t => t.BRANCHNAME).filter(Boolean))].sort()
          setAllBranches(branches)
        }
        setRowActions(prev => {
          const next = { ...prev }
          txns.forEach(t => { if (!next[t.FNCNUM]) next[t.FNCNUM] = t.suggested_action || 'journal' })
          return next
        })
        // Auto-scan: detect existing Priority receipts for credit lines — runs in background
        const creditLines = txns
          .filter(t => t.direction === '+')
          .slice(0, 30)
          .map(t => ({ fncnum: t.FNCNUM, amount: t.SUM1, branchname: t.BRANCHNAME || '', cashname: t.CASHNAME || '', curdate: (t.CURDATE || '').slice(0, 10) }))
        if (creditLines.length > 0) {
          fetch(`${API}/api/receipts/auto-scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions: creditLines }),
          }).then(r => r.json()).then(async data => {
            if (data.ok && data.imported > 0) {
              const [freshBank, freshApproved] = await Promise.all([
                fetch(txnUrl).then(r => r.json()),
                fetch(`${API}/api/receipts/approved`).then(r => r.json()),
              ])
              if (freshBank.ok) setBankTxns(freshBank.transactions || [])
              if (freshApproved.ok) {
                const all2 = freshApproved.receipts || []
                setDraftReceipts(all2.filter(r => r.status !== 'closed'))
                setClosedReceipts(all2.filter(r => r.status === 'closed'))
              }
            }
          }).catch(() => {})
        }
      }
      if (a.ok) {
        const all = a.receipts || []
        setDraftReceipts(all.filter(r => r.status !== 'closed'))
        setClosedReceipts(all.filter(r => r.status === 'closed'))
      }
      if (doneRes.ok) {
        setDoneActions(doneRes.items || [])
      }
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
      const rcLine  = data.rc_ivnum ? `\nמספר קבלה סופי: ${data.rc_ivnum}` : ''
      const fncLine = data.fncnum   ? `\nמספר תנועת יומן: ${data.fncnum}`  : ''
      alert(`קבלה ${rec.priority_ivnum} נסגרה בהצלחה${rcLine}${fncLine}`)
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

  async function searchOpenInvoices(accname, txn) {
    const t = txn || receiptModal
    if (!accname || accname.length < 2 || !t) { setOpenInvoices([]); return }
    setInvoiceSearching(true)
    try {
      const params = new URLSearchParams({
        accname,
        amount:     t.SUM1 != null ? String(t.SUM1) : '',
        branchname: t.BRANCHNAME || '',
      })
      const res = await fetch(`${API}/api/receipts/open-invoices?${params}`).then(r => r.json())
      if (res.ok) setOpenInvoices(res.invoices || [])
    } catch { /* silent */ } finally {
      setInvoiceSearching(false)
    }
  }

  async function openReceiptModal(txn, docType = 'receipt') {
    setReceiptModal(txn)
    setReceiptDocType(docType)
    setModalAccname('')
    setModalAccdes('')
    setModalDetails(docType === 'invoice_receipt' ? 'חשבונית קבלה' : 'קבלה')
    setModalError('')
    setLastIvnum(null)
    setCustSuggestions([])
    setOpenInvoices([])
    setSelectedInvoice(null)
    setExistingRc(null)
    // Auto-search customers who have a CINVOICES invoice matching this amount + branch
    if (txn.SUM1) {
      setCustSearching(true)
      try {
        const params = new URLSearchParams({ amount: txn.SUM1 || '', branchname: txn.BRANCHNAME || '', curdate: (txn.CURDATE || '').slice(0, 10) })
        const res = await fetch(`${API}/api/receipts/customer-search?${params}`).then(r => r.json())
        if (res.ok) {
          const suggestions = res.results || []
          setCustSuggestions(suggestions)
          // If exactly one match, auto-select and pre-fill the invoice
          if (suggestions.length === 1) {
            const s = suggestions[0]
            setModalAccname(s.accname)
            setCustSuggestions([])
            if (s.existing_rc) {
              await importExistingReceipt(txn, s)
              return
            } else if (s.ivnum) {
              const inv = { IVNUM: s.ivnum, IVDATE: s.ivdate, TOTPRICE: s.totprice, STATDES: s.statdes }
              setOpenInvoices([inv])
              setSelectedInvoice(inv)
            } else {
              searchOpenInvoices(s.accname, txn)
            }
          }
        }
      } catch { /* silent */ } finally {
        setCustSearching(false)
      }
    }
  }

  async function importExistingReceipt(txn, suggestion) {
    try {
      await fetch(`${API}/api/receipts/import-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_fncnum: txn.FNCNUM,
          accname:     suggestion.accname,
          accdes:      suggestion.accdes,
          cashname:    txn.CASHNAME || '',
          totprice:    txn.SUM1,
          ivdate:      (txn.CURDATE || '').slice(0, 10),
          branchname:  txn.BRANCHNAME || '',
          rc_ivnum:    suggestion.existing_rc,
          fncnum:      suggestion.existing_fncnum || '',
        }),
      })
    } catch { /* non-fatal */ }
    setReceiptModal(null)
    setOpenInvoices([])
    setSelectedInvoice(null)
    setExistingRc(null)
    await loadAll()
  }

  async function submitReceipt() {
    if (!modalAccname.trim()) { setModalError('יש להזין קוד לקוח'); return }
    setModalSending(true)
    setModalError('')
    try {
      const txn = receiptModal
      const resp = await fetch(`${API}/api/receipts/bank-line/create-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txn_id:      txn.FNCNUM,
          accname:     modalAccname.trim(),
          accdes:      '',
          amount:      txn.SUM1,
          ivdate:      (txn.CURDATE || '').slice(0, 10),
          cashname:    txn.CASHNAME,
          branchname:  txn.BRANCHNAME,
          details:     modalDetails,
          source_ivnum: selectedInvoice?.IVNUM || '',
          doc_type:    receiptDocType,
        }),
      })
      const data = await resp.json()
      if (!data.ok) throw new Error(
        (data.detail?.error?.message) || data.error || 'שגיאה'
      )
      setLastIvnum(data.priority_ivnum)
      await loadAll()
      setReceiptModal(null)
    } catch (e) {
      setModalError(e.message)
    } finally {
      setModalSending(false)
    }
  }

  async function recordAction(txn, action) {
    setActioning(txn.FNCNUM)
    try {
      const resp = await fetch(`${API}/api/receipts/bank-line/record-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txn_id:     txn.FNCNUM,
          action,
          details:    txn.DETAILS,
          sum1:       txn.SUM1,
          direction:  txn.direction,
          branchname: txn.BRANCHNAME,
          bank_desc:  txn.bank_desc,
          curdate:    txn.CURDATE,
        }),
      })
      const data = await resp.json()
      if (!data.ok) throw new Error(data.error || 'שגיאה')
      await loadAll()
    } catch (e) {
      alert('שגיאה: ' + e.message)
    } finally {
      setActioning(null)
    }
  }

  async function openJournalModal(txn) {
    setJournalModal(txn)
    setJournalDetails(txn.DETAILS || '')
    setJournalError('')
    setJournalSuccess('')
    setJournalAccSuggestions([])
    setJournalSaveTpl(true)
    setJournalCounterpart('')
    setJournalCounterDesc('')
    setJournalBankGlResolved('')
    setJournalBankGlDesc('')

    // Detect bank GL account for this transaction
    const params = new URLSearchParams({
      cashname:   txn.CASHNAME   || '',
      branchname: txn.BRANCHNAME || '',
      bank_name:  txn.bank_name  || '',
    })
    fetch(`${API}/api/receipts/bank-gl?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok && d.gl_account) {
          setJournalBankGlResolved(d.gl_account)
          setJournalBankGlDesc(d.gl_desc || '')
        }
      })
      .catch(() => {})

    // Load saved counterpart suggestion for this description
    if (txn.DETAILS) {
      fetch(`${API}/api/receipts/journal-template?details=${encodeURIComponent(txn.DETAILS)}`)
        .then(r => r.json())
        .then(d => {
          if (d.ok && d.counterpart_account) {
            setJournalCounterpart(d.counterpart_account)
            setJournalCounterDesc(d.counterpart_desc || '')
          }
        })
        .catch(() => {})
    }
  }

  async function loadLastEinvoice(accname, branchname) {
    if (!accname) return
    setIrLoading(true)
    setIrPrevNote('')
    try {
      const params = new URLSearchParams({ accname, branchname: branchname || '' })
      const res = await fetch(`${API}/api/receipts/last-einvoice?${params}`).then(r => r.json())
      if (!res.ok) {
        setIrPrevNote(`שגיאה: ${res.error || 'לא ידועה'}`)
        return
      }
      if (!res.found) {
        setIrPrevNote('לא נמצאה חשבונית קודמת ללקוח זה')
        return
      }
      setIrDetails(res.details || '')
      setIrPrevNote(`הועתק מ-${res.ivnum} (${fmt((res.ivdate || '').slice(0, 10))})`)
      if (res.items?.length > 0) {
        setIrItems(res.items.map(it => ({
          PARTNAME: it.PARTNAME || '000',
          PDES:     it.PDES || '',
          TQUANT:   Number(it.TQUANT) || 1,
          PRICE:    Number(it.PRICE) || 0,
        })))
      }
    } catch (e) {
      setIrPrevNote(`שגיאה בטעינה: ${e.message}`)
    } finally {
      setIrLoading(false)
    }
  }

  async function openInvoiceReceiptModal(txn) {
    setIrModal(txn)
    setIrAccname('')
    setIrAccdes('')
    setIrDetails('')
    setIrItems([{ PARTNAME: '000', PDES: '', TQUANT: 1, PRICE: txn.SUM1 || 0 }])
    setIrSending(false)
    setIrError('')
    setIrPrevNote('')
    setCustSuggestions([])

    if (txn.SUM1) {
      setCustSearching(true)
      try {
        const params = new URLSearchParams({ amount: txn.SUM1, branchname: txn.BRANCHNAME || '', curdate: (txn.CURDATE || '').slice(0, 10) })
        const res = await fetch(`${API}/api/receipts/customer-search?${params}`).then(r => r.json())
        if (res.ok) {
          const suggestions = (res.results || []).filter(s => !s.existing_rc)
          if (suggestions.length === 1) {
            const s = suggestions[0]
            setIrAccname(s.accname)
            setIrAccdes(s.accdes || '')
            await loadLastEinvoice(s.accname, txn.BRANCHNAME || '')
          } else if (suggestions.length > 1) {
            setCustSuggestions(suggestions)
          }
        }
      } catch { /* silent */ } finally {
        setCustSearching(false)
      }
    }
  }

  async function submitInvoiceReceipt() {
    if (!irAccname.trim()) { setIrError('יש להזין קוד לקוח'); return }
    setIrSending(true)
    setIrError('')
    try {
      const txn = irModal
      const resp = await fetch(`${API}/api/receipts/bank-line/create-invoice-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txn_id:    txn.FNCNUM,
          accname:   irAccname.trim(),
          accdes:    irAccdes,
          amount:    txn.SUM1,
          ivdate:    (txn.CURDATE || '').slice(0, 10),
          cashname:  txn.CASHNAME,
          branchname: txn.BRANCHNAME,
          details:   irDetails,
          items:     irItems,
        }),
      })
      const data = await resp.json()
      if (!data.ok) throw new Error((data.detail?.error?.message) || data.error || 'שגיאה')
      setLastIvnum(data.priority_ivnum)
      await loadAll()
      setIrModal(null)
    } catch (e) {
      setIrError(e.message)
    } finally {
      setIrSending(false)
    }
  }

  async function searchJournalAccounts(q) {
    if (!q || q.length < 2) { setJournalAccSuggestions([]); return }
    setJournalAccSearching(true)
    try {
      const res = await fetch(`${API}/api/receipts/priority-accounts?q=${encodeURIComponent(q)}`).then(r => r.json())
      if (res.ok) setJournalAccSuggestions(res.accounts || [])
    } catch { /* silent */ } finally {
      setJournalAccSearching(false)
    }
  }

  async function finalizeJournal(priorityFncnum) {
    if (!window.confirm(`להפוך פקודת יומן ${priorityFncnum} לסופית בפריוריטי?\n(פעולה זו אינה הפיכה)`)) return
    setFinalizingJournal(priorityFncnum)
    try {
      const resp = await fetch(`${API}/api/receipts/journal/${encodeURIComponent(priorityFncnum)}/finalize`, { method: 'POST' })
      if (!resp.ok && resp.headers.get('content-type')?.includes('text/html')) {
        throw new Error(`HTTP ${resp.status} — ייתכן שהשרת לא הופעל מחדש`)
      }
      const data = await resp.json()
      if (!data.ok) throw new Error(data.detail?.error?.message || data.error || 'שגיאה')
      setDoneActions(prev => prev.map(it =>
        it.priority_fncnum === priorityFncnum ? { ...it, is_final: true } : it
      ))
    } catch (e) {
      alert('שגיאה בהפיכה לסופי: ' + e.message)
    } finally {
      setFinalizingJournal(null)
    }
  }

  async function submitJournal() {
    if (!journalCounterpart.trim()) { setJournalError('יש להזין חשבון נגדי'); return }
    setJournalSending(true)
    setJournalError('')
    try {
      const txn  = journalModal
      const resp = await fetch(`${API}/api/receipts/bank-line/create-journal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txn_id:              txn.FNCNUM,
          direction:           txn.direction,
          amount:              txn.SUM1,
          cashname:            txn.CASHNAME,
          bank_name:           txn.bank_name || '',
          counterpart_account: journalCounterpart.trim(),
          counterpart_desc:    journalCounterDesc.trim(),
          details:             journalDetails,
          ivdate:              (txn.CURDATE || '').slice(0, 10),
          branchname:          txn.BRANCHNAME,
          save_template:       true,
        }),
      })
      const data = await resp.json()
      if (!data.ok) throw new Error((data.detail?.error?.message) || data.error || 'שגיאה')
      setJournalSuccess(data.fncnum ? `פקודת יומן נוצרה: ${data.fncnum}` : 'פקודת יומן נוצרה בהצלחה')
      await loadAll()
      setTimeout(() => { setJournalModal(null); setJournalSuccess('') }, 2000)
    } catch (e) {
      setJournalError(e.message)
    } finally {
      setJournalSending(false)
    }
  }

  return (
    <div className="receipts-page" dir="rtl">
      <div className="receipts-container">
        <Link to="/accounting" className="receipts-back">&rarr; חזרה להנהלת חשבונות</Link>
        <h1 className="receipts-title">תנועות בנק</h1>

        {loading && <p className="receipts-loading">טוען נתונים...</p>}
        {error   && <p className="receipts-error">{error}</p>}

        {lastIvnum && (
          <div className="receipts-modal-note" style={{ marginBottom: 16 }}>
            ✓ קבלה נשלחה לפריוריטי — מזהה: <strong>{lastIvnum}</strong>
            <button style={{ marginRight: 12, cursor: 'pointer', background: 'none', border: 'none', color: '#1d4ed8' }} onClick={() => setLastIvnum(null)}>×</button>
          </div>
        )}

        {!loading && (
          <>
            {/* ── Section A: Sent to Priority ── */}
            {closedReceipts.length > 0 && (
              <section className="receipts-section">
                <div className="receipts-section-header">
                  <h2>קבלות שנשלחו לפריוריטי</h2>
                  <span className="receipts-badge" style={{ background: '#16a34a' }}>{closedReceipts.length}</span>
                </div>
                <div className="receipts-table-wrap">
                  <table className="receipts-table">
                    <thead>
                      <tr>
                        <th>תאריך</th>
                        <th>תיאור</th>
                        <th>סכום</th>
                        <th>פעולה</th>
                        <th>מזהה בפריוריטי</th>
                        <th>סניף</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {closedReceipts.map(rec => {
                        const s = ACTION_STYLES[rec.doc_type] || ACTION_STYLES.receipt
                        return (
                          <tr key={rec.id} style={{ opacity: 0.6 }}>
                            <td>{fmt(rec.approved_at)}</td>
                            <td>{rec.accdes || rec.accname}</td>
                            <td><AmountCell sum1={rec.totprice} direction="+" /></td>
                            <td>
                              <span className="receipts-action-label" style={{ color: s.color, background: s.bg }}>
                                {s.label}
                              </span>
                            </td>
                            <td className="receipts-mono" style={{ color: '#6c5ce7', fontWeight: 700 }}>
                              <div>{rec.priority_ivnum || '—'}</div>
                              {rec.rc_ivnum && (
                                <div style={{ color: '#16a34a', fontSize: 11, fontWeight: 600 }}>
                                  RC: {rec.rc_ivnum}
                                </div>
                              )}
                              {rec.fncnum && (
                                <div style={{ color: '#6b7280', fontSize: 11 }}>
                                  יומן: {rec.fncnum}
                                </div>
                              )}
                            </td>
                            <td>{rec.branchname}</td>
                            <td className="receipts-actions">
                              <span style={{ color: '#16a34a', fontSize: '0.85em' }}>✓ סגורה</span>
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
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── Section A2: Journal / transfer actions sent to Priority ── */}
            {(() => {
              const sentJournals = doneActions.filter(it => it.priority_fncnum && it.action !== 'receipt')
              if (sentJournals.length === 0) return null
              return (
              <section className="receipts-section">
                <div className="receipts-section-header">
                  <h2>פקודות יומן שנשלחו לפריוריטי</h2>
                  <span className="receipts-badge" style={{ background: '#b45309' }}>{sentJournals.length}</span>
                </div>
                <div className="receipts-table-wrap">
                  <table className="receipts-table">
                    <thead>
                      <tr>
                        <th>תאריך</th>
                        <th>פרטים</th>
                        <th>סכום</th>
                        <th>חשבון בנק</th>
                        <th>חשבון נגדי</th>
                        <th>סניף</th>
                        <th>מס׳ בפריוריטי</th>
                        <th>סטטוס</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sentJournals.map(item => (
                        <tr key={item.id} style={{ opacity: item.is_final ? 0.55 : 0.85 }}>
                          <td>{fmt(item.curdate)}</td>
                          <td>{item.details}</td>
                          <td><AmountCell sum1={item.sum1} direction={item.direction} /></td>
                          <td className="receipts-mono" style={{ fontSize: 11 }}>
                            <div>{item.accname1}</div>
                            {item.accdes1 && <div style={{ color: '#9ca3af', fontSize: 10 }}>{item.accdes1}</div>}
                          </td>
                          <td className="receipts-mono" style={{ fontSize: 11 }}>
                            <div>{item.accname2}</div>
                            {item.accdes2 && <div style={{ color: '#9ca3af', fontSize: 10 }}>{item.accdes2}</div>}
                          </td>
                          <td>{item.branchname}</td>
                          <td className="receipts-mono" style={{ color: '#6c5ce7', fontWeight: 700 }}>
                            {item.priority_fncnum}
                          </td>
                          <td>
                            {item.is_final
                              ? <span style={{ color: '#15803d', fontWeight: 700, fontSize: 12 }}>סופי</span>
                              : <button
                                  onClick={() => finalizeJournal(item.priority_fncnum)}
                                  disabled={finalizingJournal === item.priority_fncnum}
                                  style={{ fontSize: 11, padding: '2px 8px', cursor: 'pointer',
                                           background: '#fff7ed', border: '1px solid #b45309',
                                           borderRadius: 4, color: '#b45309' }}
                                >
                                  {finalizingJournal === item.priority_fncnum ? '...' : 'הפוך לסופי'}
                                </button>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              )
            })()}

            {/* ── Section B: Unmatched bank lines ── */}
            <section className="receipts-section">
              <div className="receipts-section-header">
                <h2>תנועות בנק ללא התאמה</h2>
                <span className="receipts-badge">{bankTxns.length + draftReceipts.length}</span>
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

              {bankTxns.length === 0 && draftReceipts.length === 0 ? (
                <p className="receipts-empty">אין תנועות בנק פתוחות בתקופה זו</p>
              ) : (
                <div className="receipts-table-wrap">
                  <table className="receipts-table">
                    <thead>
                      <tr>
                        <th>תאריך</th>
                        <th>תיאור תנועה</th>
                        <th>סכום</th>
                        <th>חשבון בנק</th>
                        <th>סניף</th>
                        <th>פעולה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Draft receipts awaiting close */}
                      {draftReceipts.map(rec => (
                        <tr key={rec.id} style={{ background: '#fffbeb' }}>
                          <td>{fmt(rec.approved_at || rec.created_at)}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{rec.accdes || rec.accname}</div>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{rec.details}</div>
                          </td>
                          <td><AmountCell sum1={rec.totprice} direction="+" /></td>
                          <td className="receipts-small">{rec.cashname}</td>
                          <td>{rec.branchname}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8,
                                background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
                                טיוטה: {rec.priority_ivnum}
                              </span>
                              <button
                                className="receipts-btn receipts-btn-approve"
                                style={{ fontSize: 12, padding: '3px 10px' }}
                                onClick={() => closeReceipt(rec)}
                                disabled={closing === rec.id}
                              >
                                {closing === rec.id ? 'סוגר...' : 'סגור קבלה'}
                              </button>
                              <button
                                className="receipts-btn receipts-btn-reject"
                                style={{ fontSize: 12, padding: '3px 8px' }}
                                onClick={() => deleteReceipt(rec)}
                                disabled={deleting === rec.id}
                              >מחק</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {bankTxns.map(txn => {
                        const chosen = rowActions[txn.FNCNUM] || txn.suggested_action || 'journal'
                        const s = ACTION_STYLES[chosen] || ACTION_STYLES.journal
                        const busy = actioning === txn.FNCNUM
                        return (
                          <tr key={txn.FNCNUM}>
                            <td>{fmt(txn.CURDATE)}</td>
                            <td>{txn.DETAILS}</td>
                            <td><AmountCell sum1={txn.SUM1} direction={txn.direction} /></td>
                            <td className="receipts-small" title={txn.bank_code}>{txn.bank_desc || txn.bank_code}</td>
                            <td>{txn.BRANCHNAME}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <select
                                  className="receipts-action-select"
                                  style={{ minWidth: 170, color: s.color, borderColor: s.color + '88' }}
                                  value={chosen}
                                  onChange={e => setRowActions(prev => ({ ...prev, [txn.FNCNUM]: e.target.value }))}
                                >
                                  <option value="receipt">הפקת קבלה</option>
                                  <option value="invoice_receipt">חשבונית קבלה</option>
                                  <option value="journal">רישום פקודת יומן</option>
                                  <option value="transfer">הפקת העברה בנקאית</option>
                                </select>
                                <button
                                  className="receipts-action-btn"
                                  style={{ color: s.color, background: s.bg, borderColor: s.color + '88', whiteSpace: 'nowrap' }}
                                  disabled={busy}
                                  onClick={() => {
                                    if (chosen === 'receipt') openReceiptModal(txn, 'receipt')
                                    else if (chosen === 'invoice_receipt') openInvoiceReceiptModal(txn)
                                    else if (chosen === 'journal') openJournalModal(txn)
                                    else { setActioning(txn.FNCNUM); recordAction(txn, chosen) }
                                  }}
                                >
                                  {busy ? '...' : '← בצע'}
                                </button>
                              </div>
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

      {/* ── Receipt Modal ── */}
      {receiptModal && (
        <div className="receipts-modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setReceiptModal(null); setOpenInvoices([]); setSelectedInvoice(null) } }}>
          <div className="receipts-modal" dir="rtl">
            <h3 style={{ color: receiptDocType === 'invoice_receipt' ? '#7c3aed' : undefined }}>
              {receiptDocType === 'invoice_receipt' ? 'חשבונית קבלה' : 'הפקת קבלה'}
            </h3>

            <table className="receipts-modal-info">
              <tbody>
                <tr>
                  <th>תאריך:</th>
                  <td>{fmt(receiptModal.CURDATE)}</td>
                </tr>
                <tr>
                  <th>בנק:</th>
                  <td>{receiptModal.bank_desc || receiptModal.CASHNAME}</td>
                </tr>
                <tr>
                  <th>סניף:</th>
                  <td>{receiptModal.BRANCHNAME}</td>
                </tr>
                <tr>
                  <th>סכום:</th>
                  <td><strong style={{ color: '#16a34a' }}>{fmtAmount(receiptModal.SUM1)}</strong></td>
                </tr>
              </tbody>
            </table>

            {/* Customer suggestions */}
            {custSearching && (
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px' }}>מחפש לקוח...</p>
            )}
            {custSuggestions.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>התאמות שנמצאו — לחץ לבחירה:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {custSuggestions.map(c => (
                    <button
                      key={c.accname}
                      onClick={() => {
                        setModalAccname(c.accname)
                        setModalAccdes(c.accdes || '')
                        setCustSuggestions([])
                        if (c.existing_rc) {
                          importExistingReceipt(receiptModal, c)
                          return
                        } else if (c.ivnum) {
                          setExistingRc(null)
                          const inv = { IVNUM: c.ivnum, IVDATE: c.ivdate, TOTPRICE: c.totprice, STATDES: c.statdes }
                          setOpenInvoices([inv])
                          setSelectedInvoice(inv)
                        } else {
                          setExistingRc(null)
                          setOpenInvoices([])
                          setSelectedInvoice(null)
                          searchOpenInvoices(c.accname, receiptModal)
                        }
                      }}
                      style={{
                        textAlign: 'right', padding: '6px 10px', borderRadius: 6,
                        border: c.existing_rc ? '1px solid #bbf7d0' : '1px solid #bfdbfe',
                        background: c.existing_rc ? '#f0fdf4' : '#eff6ff',
                        cursor: 'pointer', fontSize: 13,
                      }}
                    >
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{c.accname}</span>
                      {' — '}{c.accdes}
                      {c.branchname && <span style={{ color: '#9ca3af', fontSize: 11, marginRight: 6 }}>סניף {c.branchname}</span>}
                      {c.existing_rc && (
                        <span style={{ display: 'block', color: '#16a34a', fontSize: 11, fontWeight: 600, marginTop: 2 }}>
                          קבלה קיימת: {c.existing_rc}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="receipts-modal-field">
              <label>קוד לקוח בפריוריטי (ACCNAME) *</label>
              <input
                type="text"
                placeholder='לדוגמה: 50440'
                value={modalAccname}
                onChange={e => {
                  setModalAccname(e.target.value)
                  setModalAccdes('')
                  setOpenInvoices([])
                  setSelectedInvoice(null)
                }}
                onBlur={e => {
                  const v = e.target.value.trim()
                  if (v.length >= 2) {
                    searchOpenInvoices(v, receiptModal)
                    // Lookup customer name if not already known
                    if (!modalAccdes) {
                      fetch(`${API}/api/receipts/priority-accounts?q=${encodeURIComponent(v)}`)
                        .then(r => r.json())
                        .then(d => {
                          const exact = (d.accounts || []).find(a => a.accname === v || a.accname === `${v}-${receiptModal?.BRANCHNAME}`)
                          if (exact) setModalAccdes(exact.accdes)
                          else if (d.accounts?.length === 1) setModalAccdes(d.accounts[0].accdes)
                        })
                        .catch(() => {})
                    }
                  }
                }}
                autoFocus={custSuggestions.length === 0}
              />
              {modalAccdes && (
                <div style={{ marginTop: 4, fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                  {modalAccdes}
                </div>
              )}
            </div>

            {/* Open invoice matches */}
            {invoiceSearching && (
              <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>מחפש חשבוניות...</p>
            )}
            {!invoiceSearching && openInvoices.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>חשבוניות בסכום זה — לחץ לקישור:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {openInvoices.map(inv => {
                    const selected = selectedInvoice?.IVNUM === inv.IVNUM
                    return (
                      <button
                        key={inv.IVNUM}
                        onClick={() => setSelectedInvoice(selected ? null : inv)}
                        style={{
                          textAlign: 'right', padding: '3px 8px', borderRadius: 5,
                          border: `1px solid ${selected ? '#16a34a' : '#bbf7d0'}`,
                          background: selected ? '#f0fdf4' : '#f9fffe',
                          cursor: 'pointer', fontSize: 12, display: 'flex',
                          alignItems: 'center', gap: 6, flexWrap: 'wrap',
                        }}
                      >
                        {selected && <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>}
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8', fontSize: 11 }}>{inv.IVNUM}</span>
                        <span style={{ color: '#374151', fontSize: 11 }}>{inv.CDES}</span>
                        <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 11 }}>{fmtAmount(inv.TOTPRICE)}</span>
                        <span style={{ color: '#9ca3af', fontSize: 10 }}>{fmt(inv.IVDATE)}</span>
                        <span style={{
                          fontSize: 10, padding: '1px 5px', borderRadius: 8,
                          background: inv.STATDES === 'סופית' ? '#f0fdf4' : '#fffbeb',
                          color:      inv.STATDES === 'סופית' ? '#15803d'  : '#b45309',
                        }}>{inv.STATDES}</span>
                      </button>
                    )
                  })}
                </div>
                {selectedInvoice && (
                  <p style={{ fontSize: 11, color: '#15803d', margin: '3px 0 0', fontStyle: 'italic' }}>
                    תקושר לחשבונית {selectedInvoice.IVNUM}
                  </p>
                )}
              </div>
            )}

            <div className="receipts-modal-field">
              <label>פרטים (תיאור)</label>
              <input
                type="text"
                value={modalDetails}
                onChange={e => setModalDetails(e.target.value)}
              />
            </div>

            {existingRc && (
              <div style={{
                margin: '8px 0', padding: '10px 14px', borderRadius: 8,
                background: '#f0fdf4', border: '1px solid #86efac',
                color: '#15803d', fontSize: 13, fontWeight: 600,
              }}>
                קבלה סופית קיימת בפריוריטי:&nbsp;
                <span style={{ fontFamily: 'monospace', fontSize: 14 }}>{existingRc}</span>
              </div>
            )}

            {modalError && <p className="receipts-error" style={{ margin: '8px 0' }}>{modalError}</p>}

            <div className="receipts-modal-actions">
              <button
                className="receipts-btn receipts-btn-approve"
                onClick={submitReceipt}
                disabled={modalSending || !!existingRc}
              >
                {modalSending ? 'שולח לפריוריטי...' : receiptDocType === 'invoice_receipt' ? 'הפק חשבונית קבלה' : 'הפק קבלה'}
              </button>
              <button
                className="receipts-btn receipts-btn-cancel"
                onClick={() => { setReceiptModal(null); setOpenInvoices([]); setSelectedInvoice(null); setExistingRc(null) }}
                disabled={modalSending}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice Receipt Modal ── */}
      {irModal && (
        <div className="receipts-modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setIrModal(null); setCustSuggestions([]) } }}>
          <div className="receipts-modal" dir="rtl" style={{ maxWidth: 600 }}>
            <h3 style={{ color: '#7c3aed' }}>חשבונית קבלה</h3>

            <table className="receipts-modal-info">
              <tbody>
                <tr><th>תאריך:</th><td>{fmt(irModal.CURDATE)}</td></tr>
                <tr><th>בנק:</th><td>{irModal.bank_desc || irModal.CASHNAME}</td></tr>
                <tr><th>סניף:</th><td>{irModal.BRANCHNAME}</td></tr>
                <tr><th>סכום:</th><td><strong style={{ color: '#16a34a' }}>{fmtAmount(irModal.SUM1)}</strong></td></tr>
              </tbody>
            </table>

            {custSearching && <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px' }}>מחפש לקוח...</p>}
            {custSuggestions.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>התאמות שנמצאו — לחץ לבחירה:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {custSuggestions.map(c => (
                    <button key={c.accname} onClick={async () => {
                      setIrAccname(c.accname)
                      setIrAccdes(c.accdes || '')
                      setCustSuggestions([])
                      await loadLastEinvoice(c.accname, irModal.BRANCHNAME || '')
                    }} style={{
                      textAlign: 'right', padding: '6px 10px', borderRadius: 6,
                      border: '1px solid #ddd6fe', background: '#f5f3ff',
                      cursor: 'pointer', fontSize: 13,
                    }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed' }}>{c.accname}</span>
                      {' — '}{c.accdes}
                      {c.branchname && <span style={{ color: '#9ca3af', fontSize: 11, marginRight: 6 }}>סניף {c.branchname}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="receipts-modal-field">
              <label>קוד לקוח (CUSTNAME) *</label>
              <input
                type="text"
                placeholder="לדוגמה: 50440"
                value={irAccname}
                onChange={e => { setIrAccname(e.target.value); setIrAccdes('') }}
                onBlur={async e => {
                  const v = e.target.value.trim()
                  if (v.length >= 2) {
                    await loadLastEinvoice(v, irModal?.BRANCHNAME || '')
                    if (!irAccdes) {
                      fetch(`${API}/api/receipts/priority-accounts?q=${encodeURIComponent(v)}`)
                        .then(r => r.json())
                        .then(d => {
                          const exact = (d.accounts || []).find(a => a.accname === v || a.accname === `${v}-${irModal?.BRANCHNAME}`)
                          if (exact) setIrAccdes(exact.accdes)
                          else if (d.accounts?.length === 1) setIrAccdes(d.accounts[0].accdes)
                        })
                        .catch(() => {})
                    }
                  }
                }}
                autoFocus={custSuggestions.length === 0}
              />
              {irAccdes && <div style={{ marginTop: 4, fontSize: 13, color: '#7c3aed', fontWeight: 600 }}>{irAccdes}</div>}
            </div>

            <div className="receipts-modal-field">
              <label>פרטים</label>
              <input type="text" value={irDetails} onChange={e => setIrDetails(e.target.value)} placeholder="פרטי החשבונית" />
              {irPrevNote && (
                <div style={{ fontSize: 11, marginTop: 3, color: irPrevNote.startsWith('שגיאה') || irPrevNote.startsWith('לא נמצא') ? '#b45309' : '#6b7280' }}>
                  {irPrevNote}
                </div>
              )}
            </div>

            {irLoading && <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0' }}>טוען פרטים מחשבונית קודמת...</p>}
            {!irLoading && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>פריטים (EINVOICEITEMS)</label>
                  <button
                    type="button"
                    onClick={() => setIrItems(prev => [...prev, { PARTNAME: '000', PDES: '', TQUANT: 1, PRICE: 0 }])}
                    style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, border: '1px solid #7c3aed', color: '#7c3aed', background: '#f5f3ff', cursor: 'pointer' }}
                  >+ הוסף שורה</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ textAlign: 'right', padding: '3px 4px', width: 60 }}>מקט</th>
                      <th style={{ textAlign: 'right', padding: '3px 4px' }}>פרטים</th>
                      <th style={{ textAlign: 'center', padding: '3px 4px', width: 60 }}>כמות</th>
                      <th style={{ textAlign: 'center', padding: '3px 4px', width: 80 }}>מחיר</th>
                      <th style={{ width: 24 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {irItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '3px 4px' }}>
                          <input type="text" value={item.PARTNAME}
                            onChange={e => setIrItems(prev => prev.map((it, i) => i === idx ? { ...it, PARTNAME: e.target.value } : it))}
                            style={{ width: '100%', fontSize: 12, padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: 3 }} />
                        </td>
                        <td style={{ padding: '3px 4px' }}>
                          <input type="text" value={item.PDES}
                            onChange={e => setIrItems(prev => prev.map((it, i) => i === idx ? { ...it, PDES: e.target.value } : it))}
                            style={{ width: '100%', fontSize: 12, padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: 3 }} />
                        </td>
                        <td style={{ padding: '3px 4px' }}>
                          <input type="number" value={item.TQUANT}
                            onChange={e => setIrItems(prev => prev.map((it, i) => i === idx ? { ...it, TQUANT: e.target.value } : it))}
                            style={{ width: '100%', fontSize: 12, padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: 3, textAlign: 'center' }} />
                        </td>
                        <td style={{ padding: '3px 4px' }}>
                          <input type="number" value={item.PRICE}
                            onChange={e => setIrItems(prev => prev.map((it, i) => i === idx ? { ...it, PRICE: e.target.value } : it))}
                            style={{ width: '100%', fontSize: 12, padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: 3, textAlign: 'center' }} />
                        </td>
                        <td style={{ padding: '3px 4px', textAlign: 'center' }}>
                          {irItems.length > 1 && (
                            <button type="button" onClick={() => setIrItems(prev => prev.filter((_, i) => i !== idx))}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {irError && <p className="receipts-error" style={{ margin: '8px 0' }}>{irError}</p>}

            <div className="receipts-modal-actions">
              <button className="receipts-btn receipts-btn-approve" onClick={submitInvoiceReceipt} disabled={irSending}>
                {irSending ? 'שולח לפריוריטי...' : 'הפק חשבונית קבלה'}
              </button>
              <button className="receipts-btn receipts-btn-cancel" onClick={() => { setIrModal(null); setCustSuggestions([]) }} disabled={irSending}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Journal Entry Modal ── */}
      {journalModal && (
        <div className="receipts-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setJournalModal(null) }}>
          <div className="receipts-modal" dir="rtl">
            <h3>רישום פקודת יומן</h3>

            <table className="receipts-modal-info">
              <tbody>
                <tr><th>תאריך:</th><td>{fmt(journalModal.CURDATE)}</td></tr>
                <tr><th>בנק:</th><td>{journalModal.bank_desc || journalModal.CASHNAME}</td></tr>
                <tr><th>סניף:</th><td>{journalModal.BRANCHNAME}</td></tr>
                <tr>
                  <th>סכום:</th>
                  <td><AmountCell sum1={journalModal.SUM1} direction={journalModal.direction} /></td>
                </tr>
              </tbody>
            </table>

            {/* Journal entry preview */}
            <div style={{ margin: '12px 0', padding: '10px 14px', borderRadius: 8,
              background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 13 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: '#374151' }}>תצוגה מקדימה של הפקודה:</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: '#6b7280' }}>
                    <th style={{ textAlign: 'right', paddingLeft: 8, fontWeight: 600 }}>חשבון</th>
                    <th style={{ textAlign: 'center', fontWeight: 600 }}>חובה</th>
                    <th style={{ textAlign: 'center', fontWeight: 600 }}>זכות</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const bankCell = (
                      <td style={{ paddingLeft: 8, color: '#1d4ed8', fontFamily: 'monospace' }}>
                        {journalBankGlResolved
                          ? <><strong>{journalBankGlResolved}</strong>{journalBankGlDesc && <span style={{ color: '#6b7280', fontFamily: 'sans-serif', marginRight: 6, fontWeight: 400 }}>{journalBankGlDesc}</span>}</>
                          : <span style={{ color: '#9ca3af' }}>מזהה...</span>
                        }
                      </td>
                    )
                    const cpAcc = journalCounterpart
                      ? `${journalCounterpart}${journalModal.BRANCHNAME && !journalCounterpart.endsWith(`-${journalModal.BRANCHNAME}`) ? `-${journalModal.BRANCHNAME}` : ''}`
                      : '???'
                    const cpCell = (
                      <td style={{ paddingLeft: 8, color: '#b45309', fontFamily: 'monospace' }}>
                        {cpAcc}
                        {journalCounterDesc && <span style={{ color: '#6b7280', fontFamily: 'sans-serif', marginRight: 6, fontWeight: 400 }}>{journalCounterDesc}</span>}
                      </td>
                    )
                    return journalModal.direction === '+' ? (
                      <>
                        <tr>{bankCell}<td style={{ textAlign: 'center', color: '#15803d', fontWeight: 700 }}>{fmtAmount(journalModal.SUM1)}</td><td style={{ textAlign: 'center', color: '#9ca3af' }}>—</td></tr>
                        <tr>{cpCell}<td style={{ textAlign: 'center', color: '#9ca3af' }}>—</td><td style={{ textAlign: 'center', color: '#dc2626', fontWeight: 700 }}>{fmtAmount(journalModal.SUM1)}</td></tr>
                      </>
                    ) : (
                      <>
                        <tr>{cpCell}<td style={{ textAlign: 'center', color: '#15803d', fontWeight: 700 }}>{fmtAmount(journalModal.SUM1)}</td><td style={{ textAlign: 'center', color: '#9ca3af' }}>—</td></tr>
                        <tr>{bankCell}<td style={{ textAlign: 'center', color: '#9ca3af' }}>—</td><td style={{ textAlign: 'center', color: '#dc2626', fontWeight: 700 }}>{fmtAmount(journalModal.SUM1)}</td></tr>
                      </>
                    )
                  })()}
                </tbody>
              </table>
            </div>

            {/* Counterpart account with autocomplete */}
            <div className="receipts-modal-field">
              <label>חשבון נגדי (ACCNAME) *</label>
              <input
                type="text"
                placeholder={`לדוגמה: 6200 (יושלם עם סיומת -${journalModal.BRANCHNAME})`}
                value={journalCounterpart}
                autoFocus
                onChange={e => {
                  setJournalCounterpart(e.target.value)
                  setJournalCounterDesc('')
                  searchJournalAccounts(e.target.value)
                }}
              />
              {journalAccSearching && (
                <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>מחפש חשבונות...</p>
              )}
              {journalAccSuggestions.length > 0 && (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, marginTop: 2, background: '#fff', maxHeight: 160, overflowY: 'auto' }}>
                  {journalAccSuggestions.map(a => (
                    <button
                      key={a.accname}
                      onClick={() => {
                        setJournalCounterpart(a.accname)
                        setJournalCounterDesc(a.accdes)
                        setJournalAccSuggestions([])
                      }}
                      style={{ display: 'block', width: '100%', textAlign: 'right', padding: '6px 10px',
                        border: 'none', background: 'none', cursor: 'pointer', fontSize: 13,
                        borderBottom: '1px solid #f3f4f6' }}
                    >
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{a.accname}</span>
                      {' — '}{a.accdes}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="receipts-modal-field">
              <label>פרטים</label>
              <input
                type="text"
                value={journalDetails}
                onChange={e => setJournalDetails(e.target.value)}
              />
            </div>



            {journalError   && <p className="receipts-error"  style={{ margin: '8px 0' }}>{journalError}</p>}
            {journalSuccess && <p style={{ margin: '8px 0', color: '#15803d', fontWeight: 600 }}>{journalSuccess}</p>}

            <div className="receipts-modal-actions">
              <button
                className="receipts-btn receipts-btn-approve"
                onClick={submitJournal}
                disabled={journalSending}
              >
                {journalSending ? 'שולח לפריוריטי...' : 'צור פקודת יומן'}
              </button>
              <button
                className="receipts-btn receipts-btn-cancel"
                onClick={() => setJournalModal(null)}
                disabled={journalSending}
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
