"""
450-Receipts Writer Agent
Creates a receipt (קבלה) in Priority TINVOICES — three-step flow:
  1. POST TINVOICES           → creates draft (טיוטה)
  2. POST TPAYMENT2_SUBFORM   → fills bank-transfer payment details (פרטי תשלום — העברה בנקאית)
  3. GET+PATCH TFNCITEMS2_SUBFORM → marks selected open invoices with PAYFLAG='Y' (קישור חשבוניות)
  4. Leave as draft            → accountant reviews and clicks "סגירת קבלה"

Main-screen fields (TINVOICES):
  ACCNAME     — חשבון לקוח כולל סניף, e.g. "50440-026"
                Rule: CUSTCODE + "-" + BRANCH (except branch "000" → no suffix)
  IVDATE      — תאריך
  TOTPRICE    — סכום
  DETAILS     — פירוט
  CASHNAME    — קופה (prefix = branch number, e.g. "026-201")
  BRANCHNAME  — סניף
  PAYDATE     — תאריך פירעון (= IVDATE)
  CASHPAYMENT — 0 for bank transfer (amount goes in TPAYMENT2_SUBFORM, not here)
  NOTE: do NOT send REFERENCE field — Priority treats it as order number (הזמנת לקוח) and returns 400

Payment sub-form fields (TPAYMENT2_SUBFORM — פירוט תשלומים אחרים):
  PAYMENTCODE — "3" = העברה בנקאית
  PAYDATE     — תאריך פירעון
  QPRICE      — סכום
  FIRSTPAY    — סכום
  TOTPRICE    — סכום כולל
  DETAILS     — פירוט

Open invoice linking (TFNCITEMS2_SUBFORM — חשבוניות לתשלום):
  Priority auto-populates this sub-form with all open customer balances after step 2.
  Key: FNCTRANS + KLINE (composite).
  PATCH each matching row with {"PAYFLAG": "Y"} to link it to the receipt.
  Matching: compare row IVNUM against the list of selected invoice IVNUMs.

Open invoice detection (CINVOICES):
  IVRECONDATE = null  → invoice not yet paid (open)
  IVRECONDATE ≠ null  → invoice already reconciled (closed)
  NOTE: OData $filter with 'eq null' is unsupported in Priority (returns 500).
        Fetch without IVRECONDATE filter, then filter in Python:
        open = [inv for inv in all_inv if not inv.get("IVRECONDATE")]
        IVRECONDATE must be included in $select for this to work.
  DIFF=0 and STATDES do NOT reliably indicate paid status — use IVRECONDATE only.
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


def create_receipt(custname, ivdate, totprice, details, cashname, branchname, fncnum=None, open_invoices=None):
    """Create a draft receipt in Priority TINVOICES with payment sub-form filled.

    Args:
        custname      : Base customer code, e.g. "50440"
        ivdate        : Receipt date, YYYY-MM-DD
        totprice      : Total amount (float)
        details       : Free-text description (פירוט)
        cashname      : Cash/bank account code (קופה), e.g. "026-201"
        branchname    : Branch code, e.g. "026"
        fncnum        : Bank transaction number (FNCNUM) — for reference only
        open_invoices : List of invoice dicts with at least {"IVNUM": "..."} to link via PAYFLAG='Y'

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
                "CASHPAYMENT": 0,  # 0 for bank transfer — amount goes in TPAYMENT2_SUBFORM
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

    # ── Step 3: Link open invoices via TFNCITEMS2_SUBFORM ─────────────
    # Priority auto-populates this sub-form with all open customer balances.
    # PATCH PAYFLAG='Y' on each row whose IVNUM matches a selected invoice.
    if open_invoices:
        inv_ivnums = {(inv.get("IVNUM") or "").strip() for inv in open_invoices if inv.get("IVNUM")}
        print(f"  Linking {len(inv_ivnums)} invoice(s) via TFNCITEMS2_SUBFORM: {inv_ivnums}")
        try:
            rows_resp = requests.get(
                f"{PRIORITY_URL}/TINVOICES({key})/TFNCITEMS2_SUBFORM",
                headers=_headers(), auth=_auth(), timeout=15,
            )
            if rows_resp.ok:
                for row in rows_resp.json().get("value", []):
                    row_ivnum = (row.get("IVNUM") or "").strip()
                    if row_ivnum not in inv_ivnums:
                        continue
                    fnctrans = row.get("FNCTRANS")
                    kline    = row.get("KLINE")
                    if fnctrans is None:
                        continue
                    row_key = f"FNCTRANS={fnctrans},KLINE={kline}"
                    try:
                        patch_resp = requests.patch(
                            f"{PRIORITY_URL}/TINVOICES({key})/TFNCITEMS2_SUBFORM({row_key})",
                            json={"PAYFLAG": "Y"},
                            headers=_headers(), auth=_auth(), timeout=15,
                        )
                        if patch_resp.ok:
                            print(f"    PAYFLAG=Y set for {row_ivnum}")
                        else:
                            print(f"    WARN: PATCH {row_ivnum} failed {patch_resp.status_code}: {patch_resp.text[:200]}")
                    except Exception as pe:
                        print(f"    WARN: PATCH {row_ivnum} error: {pe}")
            else:
                print(f"  WARN: TFNCITEMS2_SUBFORM GET failed {rows_resp.status_code}: {rows_resp.text[:200]}")
        except Exception as e:
            print(f"  WARN (step 3 — invoice linking): {e}")
        # Non-fatal: accountant can link manually in Priority

    return {"ok": True, "ivnum": ivnum, "accname": accname}


def _parse_err(e):
    try:
        return e.response.json()
    except Exception:
        return e.response.text if e.response else ""


def main():
    import argparse, json as _json
    parser = argparse.ArgumentParser(description="Create a Priority receipt draft")
    parser.add_argument("--custname",   required=True,  help="Customer code, e.g. 50440")
    parser.add_argument("--branch",     required=True,  help="Branch code, e.g. 026")
    parser.add_argument("--amount",     required=True,  type=float, help="Total amount")
    parser.add_argument("--date",       required=True,  help="Receipt date YYYY-MM-DD")
    parser.add_argument("--cashname",   required=True,  help="Cash/bank account, e.g. 026-201")
    parser.add_argument("--details",    default="",     help="Free-text description")
    parser.add_argument("--fncnum",     default=None,   help="Bank transaction reference number")
    parser.add_argument("--invoices",   default=None,   help='JSON list of invoices to link, e.g. \'[{"IVNUM":"026-26-3000370"}]\'')
    parser.add_argument("--json",       action="store_true", help="Output result as JSON to stdout")
    args = parser.parse_args()

    open_invoices = None
    if args.invoices:
        import json as _json2
        try:
            open_invoices = _json2.loads(args.invoices)
        except Exception:
            print(f"WARN: could not parse --invoices JSON: {args.invoices}")

    if not args.json:
        print("=" * 60)
        print("  450-Receipts Writer - Priority Cloud")
        print("=" * 60)
        print(f"Priority URL: {PRIORITY_URL}")
        print()

    result = create_receipt(
        custname=args.custname,
        ivdate=args.date,
        totprice=args.amount,
        details=args.details,
        cashname=args.cashname,
        branchname=args.branch,
        fncnum=args.fncnum,
        open_invoices=open_invoices,
    )

    if args.json:
        import sys as _sys
        _sys.stdout.write(_json.dumps(result, ensure_ascii=False))
        return

    print()
    if result["ok"]:
        print(f"SUCCESS — IVNUM: {result['ivnum']}  ACCNAME: {result.get('accname')}")
    else:
        print(f"FAILED  — {result['error']}")
        if result.get("detail"):
            print(f"Detail  — {result['detail']}")


if __name__ == "__main__":
    main()
