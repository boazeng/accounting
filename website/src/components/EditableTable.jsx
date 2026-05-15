import { useRef, useState } from 'react'
import './EditableTable.css'

/* Reusable editable grid.
   columns: [{ key, label, type }]  type: 'text' | 'money' | 'select'
            select columns also pass `options: [{v,l}]`
   data:    rows to display (each must have a stable `id`)
   onChange(id, key, value) · onAddBelow(id) · onDelete(id)

   Keys: Tab moves field→field (native); ArrowUp / ArrowDown move to the
   same field one row up/down; F10 copies the value from the field one
   row above. Focusing a field selects all its text. Money fields show
   thousands commas + up to 2 decimals (no trailing zeros) when not
   being edited, and the raw number while focused. */

const moneyNum = (v) => Number(String(v).replace(/[^\d.-]/g, ''))

const fmtMoney = (v) => {
  if (v === '' || v === null || v === undefined) return ''
  const n = moneyNum(v)
  if (!isFinite(n)) return v
  const abs = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return n < 0 ? `(${abs})` : abs // negatives shown in parentheses
}

// "1225" -> "12.25" ; inserts the dot automatically as digits are typed
const fmtMMYY = (v) => {
  const d = String(v).replace(/\D/g, '').slice(0, 4)
  return d.length <= 2 ? d : d.slice(0, 2) + '.' + d.slice(2)
}

const moneySign = (v) => {
  const n = moneyNum(v)
  if (!isFinite(n) || n === 0) return ''
  return n < 0 ? 'et-money-neg' : 'et-money-pos'
}

export default function EditableTable({ columns, data, onChange, onAddBelow, onDelete }) {
  const cells = useRef({})
  const [focused, setFocused] = useState(null) // "ri:key"

  const ck = (ri, key) => `${ri}:${key}`

  // select() must run AFTER the value re-renders (money fields swap
  // formatted→raw on focus, which would otherwise clear the selection)
  const selectSoon = (el) => {
    if (el && el.select) setTimeout(() => { try { el.select() } catch {} }, 0)
  }

  const focusCell = (ri, key) => {
    const el = cells.current[ck(ri, key)]
    if (el) el.focus() // onFocus handler does the deferred select
  }

  const handleKeyDown = (e, ri, col) => {
    if (e.key === 'F10') {
      e.preventDefault()
      if (ri > 0) onChange(data[ri].id, col.key, data[ri - 1][col.key])
      return
    }
    if (e.key === 'ArrowUp' && ri > 0) {
      e.preventDefault()
      focusCell(ri - 1, col.key)
    } else if (e.key === 'ArrowDown' && ri < data.length - 1) {
      e.preventDefault()
      focusCell(ri + 1, col.key)
    }
  }

  const renderField = (row, ri, col) => {
    const key = ck(ri, col.key)
    if (col.type === 'select') {
      return (
        <select
          ref={(el) => (cells.current[key] = el)}
          className="et-input et-select"
          value={String(row[col.key])}
          onChange={(e) => {
            const opt = col.options.find((o) => String(o.v) === e.target.value)
            onChange(row.id, col.key, opt ? opt.v : e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'F10') handleKeyDown(e, ri, col)
          }}
        >
          {col.options.map((o) => (
            <option key={String(o.v)} value={String(o.v)}>
              {o.l}
            </option>
          ))}
        </select>
      )
    }
    const isMoney = col.type === 'money'
    const raw = row[col.key] ?? ''
    const blurredMoney = isMoney && focused !== key
    const display = blurredMoney ? fmtMoney(raw) : raw
    const moneyCls = blurredMoney ? moneySign(raw) : ''
    const sizeCls = col.w
      ? `et-w-${col.w}`
      : isMoney
      ? 'et-w-sm'
      : col.key === 'details' || col.key === 'notes'
      ? 'et-w-lg'
      : ''
    return (
      <input
        ref={(el) => (cells.current[key] = el)}
        className={`et-input ${isMoney ? 'et-num' : ''} ${moneyCls} ${sizeCls}`}
        type="text"
        inputMode={isMoney || col.type === 'mmyy' ? 'numeric' : undefined}
        value={display}
        onChange={(e) =>
          onChange(
            row.id,
            col.key,
            col.type === 'mmyy' ? fmtMMYY(e.target.value) : e.target.value
          )
        }
        onFocus={(e) => {
          const el = e.target
          setFocused(key)
          selectSoon(el)
        }}
        onBlur={() => setFocused((f) => (f === key ? null : f))}
        onKeyDown={(e) => handleKeyDown(e, ri, col)}
      />
    )
  }

  return (
    <div className="et-wrap">
      <table className="et-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
            <th className="et-actions-h">פעולות</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, ri) => (
            <tr key={row.id}>
              {columns.map((c) => (
                <td key={c.key}>{renderField(row, ri, c)}</td>
              ))}
              <td className="et-actions">
                <button
                  type="button"
                  className="et-act et-add"
                  title="הוסף שורה זהה מתחת"
                  onClick={() => onAddBelow(row.id)}
                >
                  +
                </button>
                <button
                  type="button"
                  className="et-act et-del"
                  title="מחק שורה"
                  onClick={() => onDelete(row.id)}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
