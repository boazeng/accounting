# -*- coding: utf-8 -*-
"""Download and merge CINVOICES PDFs for a branch + date range."""
import sys, os, base64, io
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import requests
from requests.auth import HTTPBasicAuth
import pypdf
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / ".env")

PRIORITY_URL  = os.getenv("PRIORITY_URL_REAL", "").rstrip("/")
USERNAME      = os.getenv("PRIORITY_USERNAME", "")
PASSWORD      = os.getenv("PRIORITY_PASSWORD", "")
AUTH          = HTTPBasicAuth(USERNAME, PASSWORD)
HEADERS       = {"Accept": "application/json", "OData-Version": "4.0"}

BRANCH    = "009"
DATE_FROM = "2026-03-01"
DATE_TO   = "2026-04-30"
OUT_FILE  = Path(__file__).parent / f"cinvoices_{BRANCH}_{DATE_FROM[:7]}_to_{DATE_TO[:7]}.pdf"

def fetch_invoice_list():
    url = (
        f"{PRIORITY_URL}/CINVOICES"
        f"?$filter=BRANCHNAME eq '{BRANCH}'"
        f" and IVDATE ge {DATE_FROM}T00:00:00Z"
        f" and IVDATE le {DATE_TO}T23:59:59Z"
        f" and FINAL eq 'Y'"
        f"&$select=IVNUM,IVDATE,TOTPRICE,CUSTNAME,CDES,DEBIT"
        f"&$orderby=IVDATE asc&$top=500"
    )
    r = requests.get(url, headers=HEADERS, auth=AUTH, timeout=30, verify=False)
    r.raise_for_status()
    rows = r.json().get("value", [])
    # Keep originals only (DEBIT='D')
    return [row for row in rows if row.get("DEBIT", "D") != "C"]

def fetch_pdf(ivnum):
    att_url = (
        f"{PRIORITY_URL}/CINVOICES"
        f"(IVNUM='{ivnum}',IVTYPE='C',DEBIT='D')/EXTFILES_SUBFORM"
    )
    r = requests.get(att_url, headers=HEADERS, auth=AUTH, timeout=30, verify=False)
    r.raise_for_status()
    attachments = r.json().get("value", [])
    if not attachments:
        return None
    raw = attachments[0].get("EXTFILENAME", "")
    b64 = raw.split(",", 1)[1] if "," in raw else raw
    return base64.b64decode(b64)

def main():
    import urllib3
    urllib3.disable_warnings()

    print(f"שולף חשבוניות סניף {BRANCH} {DATE_FROM} עד {DATE_TO}...")
    invoices = fetch_invoice_list()
    print(f"נמצאו {len(invoices)} חשבוניות")

    merger = pypdf.PdfWriter()
    errors = []

    for i, inv in enumerate(invoices, 1):
        ivnum = inv["IVNUM"]
        total = inv.get("TOTPRICE", "")
        cdes  = inv.get("CDES", inv.get("CUSTNAME", ""))
        print(f"  [{i}/{len(invoices)}] {ivnum} | {cdes} | {total}...", end=" ")
        try:
            pdf_bytes = fetch_pdf(ivnum)
            if pdf_bytes:
                merger.append(io.BytesIO(pdf_bytes))
                print("OK")
            else:
                errors.append(f"{ivnum}: אין נספח")
                print("אין נספח")
        except Exception as e:
            errors.append(f"{ivnum}: {e}")
            print(f"שגיאה: {e}")

    if len(merger.pages) == 0:
        print("שגיאה: לא הצלחתי להוריד אף חשבונית")
        sys.exit(1)

    with open(OUT_FILE, "wb") as f:
        merger.write(f)
    merger.close()

    print(f"\nנשמר: {OUT_FILE}")
    print(f"עמודים: {len(merger.pages)}")
    if errors:
        print(f"חשבוניות שדולגו ({len(errors)}):")
        for e in errors:
            print(f"  {e}")

if __name__ == "__main__":
    main()
