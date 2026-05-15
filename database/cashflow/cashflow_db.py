"""
cashflow_db - local JSON storage for the cash-flow ledger (תזרים).

The main store holds all FUTURE transactions. Each transaction:
  company   - שם חברה
  kind      - סיווג: "income" (הכנסה) / "expense" (הוצאה)
  category  - סיווג התנועה (e.g. שכירות, שכר, ספקים, לקוחות)
  pay_date  - תאריך תשלום (YYYY-MM-DD)
  details   - פרטים
  amount    - סכום בש"ח (number)

Local-first (JSON file) so it runs without AWS. Same shape can move to
DynamoDB later (like delivery_notes_db) when the system goes to AWS.
"""

import os
import json
import uuid
import logging
from datetime import datetime

logger = logging.getLogger("tact.cashflow_db")

_DATA_FILE = os.path.join(os.path.dirname(__file__), "cashflow_data.json")


def _load():
    if not os.path.isfile(_DATA_FILE) or os.path.getsize(_DATA_FILE) == 0:
        return []
    try:
        with open(_DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception as e:  # noqa: BLE001
        logger.error(f"cashflow load failed: {e}")
        return []


def _save(rows):
    tmp = _DATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    os.replace(tmp, _DATA_FILE)


def _num(v, default=0.0):
    try:
        return float(str(v).replace(",", "").replace("₪", "").strip())
    except (TypeError, ValueError):
        return default


def save_transactions(rows):
    """Replace the whole transactions store (from the editable grid)."""
    clean = []
    for r in rows or []:
        clean.append({
            "id": r.get("id") or str(uuid.uuid4()),
            "company": r.get("company", ""),
            "kind": r.get("kind") if r.get("kind") in ("income", "expense") else "expense",
            "category": r.get("category", ""),
            "pay_date": r.get("pay_date", ""),
            "details": r.get("details", ""),
            "amount": _num(r.get("amount")),
            "created_at": r.get("created_at") or datetime.utcnow().isoformat() + "Z",
        })
    _save(clean)
    return len(clean)


def list_transactions(company=None):
    """Return transactions, optionally filtered by company, sorted by pay date."""
    rows = _load()
    if company and company != "all":
        rows = [r for r in rows if r.get("company") == company]
    return sorted(rows, key=lambda r: r.get("pay_date", ""))


def add_transaction(company, kind, category, pay_date, details, amount):
    rows = _load()
    row = {
        "id": str(uuid.uuid4()),
        "company": company,
        "kind": kind if kind in ("income", "expense") else "expense",
        "category": category,
        "pay_date": pay_date,
        "details": details,
        "amount": float(amount),
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    rows.append(row)
    _save(rows)
    logger.info(f"cashflow add {row['id']} {company} {kind} {amount}")
    return row


def seed_defaults():
    """Seed a few sample future transactions on first run (idempotent)."""
    if _load():
        return
    samples = [
        ("חניה אורבנית", "income", "לקוחות", "2026-06-05", "תקבול דמי חניה חודשי", 48500),
        ("חניה אורבנית", "expense", "ספקים", "2026-06-10", "תשלום אחזקת מתקנים", 12300),
        ("אחזקה אורבנית", "income", "לקוחות", "2026-06-08", "חוזה אחזקה רבעוני", 64000),
        ("אחזקה אורבנית", "expense", "שכר", "2026-06-28", "שכר עובדי שטח", 38900),
        ("אנרגיה אורבנית", "income", "לקוחות", "2026-06-15", "חשבוניות אנרגיה", 152000),
        ("אנרגיה אורבנית", "expense", "ספקים", "2026-06-20", "רכש ציוד", 27450),
        ("אנרגיה אורבנית", "expense", "מסים", "2026-07-15", "מקדמות מס", 19000),
        ("חניה אורבנית", "income", "לקוחות", "2026-07-05", "תקבול דמי חניה חודשי", 49100),
    ]
    for c, k, cat, d, det, amt in samples:
        add_transaction(c, k, cat, d, det, amt)
    logger.info("cashflow seeded sample transactions")


# ===== Related lists: employees / vehicles / loans / mgmt fees =====
_DIR = os.path.dirname(__file__)
_EMP_FILE = os.path.join(_DIR, "employees.json")
_VEH_FILE = os.path.join(_DIR, "vehicles.json")
_LOAN_FILE = os.path.join(_DIR, "loans.json")
_MGMT_FILE = os.path.join(_DIR, "mgmt_fees.json")


def _read(path):
    if not os.path.isfile(path) or os.path.getsize(path) == 0:
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            d = json.load(f)
            return d if isinstance(d, list) else []
    except Exception as e:  # noqa: BLE001
        logger.error(f"read {path} failed: {e}")
        return []


def _write(path, rows):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def _add(path, row):
    rows = _read(path)
    row = {"id": str(uuid.uuid4()), **row}
    rows.append(row)
    _write(path, rows)
    return row


def list_employees():
    return _read(_EMP_FILE)


def add_employee(company, name, gross, net, social, extra, notes, active):
    return _add(_EMP_FILE, {
        "company": company, "name": name,
        "gross": float(gross), "net": float(net),
        "social": float(social), "extra": float(extra),
        "notes": notes, "active": bool(active),
    })


def list_vehicles():
    return _read(_VEH_FILE)


def add_vehicle(company, employee, belongs_to, vtype, plate, leasing, fuel, notes=""):
    return _add(_VEH_FILE, {
        "company": company, "employee": employee, "belongs_to": belongs_to,
        "vtype": vtype, "plate": plate,
        "leasing": float(leasing), "fuel": float(fuel),
        "notes": notes or f"רכב - {employee}",
    })


def list_loans():
    return _read(_LOAN_FILE)


def add_loan(company, total, monthly, start_date, end_date,
             loan_type="", bank="", notes="", move_date=""):
    return _add(_LOAN_FILE, {
        "company": company, "loan_type": loan_type, "bank": bank,
        "total": float(total), "monthly": float(monthly),
        "start_date": start_date, "end_date": end_date,
        "move_date": move_date, "notes": notes,
    })


def list_mgmt():
    return _read(_MGMT_FILE)


def add_mgmt(company, employee, fee_before, fee_incl, move_date="", notes=""):
    return _add(_MGMT_FILE, {
        "company": company, "employee": employee,
        "fee_before": float(fee_before), "fee_incl": float(fee_incl),
        "move_date": move_date, "notes": notes or f"דמי ניהול - {employee}",
    })


def seed_extras():
    """Seed sample employees / vehicles / loans on first run (idempotent)."""
    if not _read(_EMP_FILE):
        for r in [
            ("חניה אורבנית", "דנה לוי", 18000, 13200, 4100, 600, "", True),
            ("אחזקה אורבנית", "יוסי כהן", 14500, 10800, 3300, 400, "", True),
            ("אנרגיה אורבנית", "מירב אזולאי", 22000, 15600, 5000, 900, "", True),
            ("אנרגיה אורבנית", "רון ביטון", 16000, 11900, 3600, 0, "", False),
        ]:
            c, name = r[0], r[1]
            add_employee(c, name, r[2], r[3], r[4], r[5], f"משכורת - {name}", r[7])
        logger.info("seeded employees")
    if not _read(_VEH_FILE):
        for r in [
            ("חניה אורבנית", "דנה לוי", "החברה", "מסחרי", "12-345-67", 2300, 1400),
            ("אחזקה אורבנית", "יוסי כהן", "עובד", "פרטי", "89-012-34", 1800, 1100),
            ("אנרגיה אורבנית", "מירב אזולאי", "החברה", "ג'יפ", "56-789-01", 3100, 1700),
        ]:
            add_vehicle(*r)
        logger.info("seeded vehicles")
    if not _read(_LOAN_FILE):
        for r in [
            ("חניה אורבנית", 480000, 9800, "01.25", "12.29",
             "הלוואת פיתוח", "בנק הפועלים", "מימון הקמת מתקן", "10"),
            ("אנרגיה אורבנית", 1200000, 21500, "06.24", "05.30",
             "הלוואת ציוד", "בנק לאומי", "רכש מערכות", "1"),
        ]:
            add_loan(*r)
        logger.info("seeded loans")
    if not _read(_MGMT_FILE):
        for r in [
            ("חניה אורבנית", "דנה לוי", 8000, 9360, "10"),
            ("אנרגיה אורבנית", "מירב אזולאי", 12000, 14040, "5"),
        ]:
            add_mgmt(*r)
        logger.info("seeded mgmt fees")


def _save_list(path, rows, money_keys):
    clean = []
    for r in rows or []:
        row = {"id": r.get("id") or str(uuid.uuid4())}
        for k, v in r.items():
            if k == "id":
                continue
            row[k] = _num(v) if k in money_keys else v
        clean.append(row)
    _write(path, clean)
    return len(clean)


def save_employees(rows):
    return _save_list(_EMP_FILE, rows, {"gross", "net", "social", "extra"})


def save_vehicles(rows):
    return _save_list(_VEH_FILE, rows, {"leasing", "fuel"})


def save_loans(rows):
    return _save_list(_LOAN_FILE, rows, {"total", "monthly"})


def save_mgmt(rows):
    return _save_list(_MGMT_FILE, rows, {"fee_before", "fee_incl"})
