"""
450-Receipts Writer Agent
Creates a receipt (קבלה) in Priority TINVOICES — three-step flow:
  1. POST TINVOICES       → creates draft (טיוטה)
  2. POST TPAYMENT_SUBFORM → fills payment sub-form (פרטי תשלום)
  3. Leave as draft        → accountant reviews and clicks "סגירת קבלה"

Main-screen fields (TINVOICES):
  ACCNAME     — חשבון לקוח כולל סניף, e.g. "50440-026"
                Rule: CUSTCODE + "-" + BRANCH (except branch "000" → no suffix)
  IVDATE      — תאריך
  TOTPRICE    — סכום
  DETAILS     — פירוט
  CASHNAME    — קופה (prefix = branch number, e.g. "026-201")
  BRANCHNAME  — סניף
  PAYDATE     — תאריך פירעון (= IVDATE)
  CASHPAYMENT — סכום לתשלום (= TOTPRICE)

Payment sub-form fields (TPAYMENT_SUBFORM):
  CARDNUM  — מספר אסמכתא (FNCNUM מתנועת הבנק)
  QPRICE   — סכום
  TOTPRICE — סכום כולל
  PAYDATE  — תאריך פירעון
  DETAILS  — פירוט
"""

import sys
import os
import io
from pathlib import Path

if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import requests
from requests.auth import HTTPBasicAuth

if os.environ.get("IS_LAMBDA") != "true":
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent.parent.parent.parent / ".env"
    load_dotenv(env_path)

PRIORITY_URL = os.getenv("PRIORITY_URL_REAL", os.getenv("PRIORITY_URL", "")).rstrip("/")
PRIORITY_USERNAME = os.getenv("PRIORITY_USERNAME", "")
PRIORITY_PASSWORD = os.getenv("PRIORITY_PASSWORD", "")


def _auth():
    return HTTPBasicAuth(PRIORITY_USERNAME, PRIORITY_PASSWORD)


def _headers():
    return {"Accept": "application/json", "Content-Type": "application/json"}


def build_accname(custname, branchname):
    """Build full account code: 'CUSTCODE-BRANCH', or just 'CUSTCODE' for branch 000."""
    branch = (branchname or "").strip()
    base = (custname or "").strip()
    if not branch or branch == "000":
        return base
    if base.endswith(f"-{branch}"):
        return base
    return f"{base}-{branch}"


def create_receipt(custname, ivdate, totprice, details, cashname, branchname, fncnum=None):
    """Create a draft receipt in Priority TINVOICES with payment sub-form filled.

    Args:
        custname   : Base customer code, e.g. "50440"
        ivdate     : Receipt date, YYYY-MM-DD
        totprice   : Total amount (float)
        details    : Free-text description (פירוט)
        cashname   : Cash/bank account code (קופה), e.g. "026-201"
        branchname : Branch code, e.g. "026"
        fncnum     : Bank transaction number (FNCNUM) — used as payment reference

    Returns:
        dict: ok (bool), ivnum (str|None), error (str|None)
    """
    ivdate_str = (ivdate or "")[:10]
    accname = build_accname(custname, branchname)
    amount = float(totprice)

    print("Creating TINVOICES draft...")
    print(f"  Account  : {accname}")
    print(f"  Date     : {ivdate_str}")
    print(f"  Amount   : {amount}")
    print(f"  Details  : {details}")
    print(f"  Cash     : {cashname}")
    print(f"  Branch   : {branchname}")

    # ── Step 1: Create draft ──────────────────────────────────────────
    try:
        r1 = requests.post(
            f"{PRIORITY_URL}/TINVOICES",
            headers=_headers(), auth=_auth(), timeout=30,
            json={
                "ACCNAME":     accname,
                "IVDATE":      ivdate_str,
                "TOTPRICE":    amount,
                "DETAILS":     details,
                "CASHNAME":    cashname,
                "BRANCHNAME":  branchname,
                "PAYDATE":     ivdate_str,
                "CASHPAYMENT": amount,
            },
        )
        r1.raise_for_status()
    except requests.exceptions.HTTPError as e:
        body = _parse_err(e)
        print(f"  ERROR (step 1): {e}\n  {body}")
        return {"ok": False, "ivnum": None, "error": str(e), "detail": body}
    except Exception as e:
        print(f"  ERROR (step 1): {e}")
        return {"ok": False, "ivnum": None, "error": str(e)}

    data1 = r1.json()
    ivnum  = data1.get("IVNUM")
    ivtype = data1.get("IVTYPE", "T")
    debit  = data1.get("DEBIT",  "D")
    print(f"  Created  : {ivnum}")

    # ── Step 2: Fill TPAYMENT2_SUBFORM (פירוט תשלומים אחרים) ──────────
    # PAYMENTCODE "3" = העברה בנקאית
    key = f"IVNUM='{ivnum}',IVTYPE='{ivtype}',DEBIT='{debit}'"
    pay_payload = {
        "PAYMENTCODE": "3",       # העברה בנקאית
        "PAYDATE":     ivdate_str,
        "QPRICE":      amount,
        "FIRSTPAY":    amount,
        "TOTPRICE":    amount,
        "DETAILS":     details,
    }

    try:
        r2 = requests.post(
            f"{PRIORITY_URL}/TINVOICES({key})/TPAYMENT2_SUBFORM",
            headers=_headers(), auth=_auth(), timeout=20,
            json=pay_payload,
        )
        r2.raise_for_status()
        print(f"  Payment  : TPAYMENT2_SUBFORM filled (קוד 3 - העברה בנקאית)")
    except requests.exceptions.HTTPError as e:
        body = _parse_err(e)
        print(f"  WARN (step 2 — payment subform): {e}\n  {body}")
        # Non-fatal: main receipt was created; accountant can fill manually

    return {"ok": True, "ivnum": ivnum, "accname": accname}


def _parse_err(e):
    try:
        return e.response.json()
    except Exception:
        return e.response.text if e.response else ""


def main():
    print("=" * 60)
    print("  450-Receipts Writer - Priority Cloud")
    print("=" * 60)
    print()
    print(f"Priority URL: {PRIORITY_URL}")
    print()

    result = create_receipt(
        custname="50904",
        ivdate="2026-05-19",
        totprice=20.00,
        details="נסיון",
        cashname="026-201",
        branchname="026",
        fncnum="99999",   # FNCNUM לדוגמה
    )

    print()
    if result["ok"]:
        print(f"SUCCESS — IVNUM: {result['ivnum']}  ACCNAME: {result.get('accname')}")
    else:
        print(f"FAILED  — {result['error']}")
        if result.get("detail"):
            print(f"Detail  — {result['detail']}")


if __name__ == "__main__":
    main()
