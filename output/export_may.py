# -*- coding: utf-8 -*-
import sys, os, base64, io
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
import requests
from requests.auth import HTTPBasicAuth
import pypdf
from dotenv import load_dotenv
from pathlib import Path
import urllib3
urllib3.disable_warnings()

load_dotenv(Path(__file__).parent.parent / ".env")
URL  = os.getenv("PRIORITY_URL_REAL", "").rstrip("/")
AUTH = HTTPBasicAuth(os.getenv("PRIORITY_USERNAME", ""), os.getenv("PRIORITY_PASSWORD", ""))
HDR  = {"Accept": "application/json", "OData-Version": "4.0"}

flt = ("BRANCHNAME eq '009'"
       " and IVDATE ge 2026-05-01T00:00:00Z"
       " and IVDATE le 2026-05-31T23:59:59Z"
       " and FINAL eq 'Y'")
r = requests.get(
    f"{URL}/CINVOICES?$filter={flt}&$select=IVNUM,IVDATE,TOTPRICE,CUSTNAME,CDES,DEBIT&$orderby=IVDATE asc&$top=500",
    headers=HDR, auth=AUTH, timeout=30, verify=False)
r.raise_for_status()
rows = [x for x in r.json().get("value", []) if x.get("DEBIT", "D") != "C"]
print(f"נמצאו {len(rows)} חשבוניות")

merger = pypdf.PdfWriter()
errors = []
for i, inv in enumerate(rows, 1):
    ivnum = inv["IVNUM"]
    cdes  = inv.get("CDES", inv.get("CUSTNAME", ""))
    total = inv.get("TOTPRICE", "")
    print(f"  [{i}/{len(rows)}] {ivnum} | {cdes} | {total}...", end=" ")
    try:
        ar = requests.get(
            f"{URL}/CINVOICES(IVNUM='{ivnum}',IVTYPE='C',DEBIT='D')/EXTFILES_SUBFORM",
            headers=HDR, auth=AUTH, timeout=30, verify=False)
        ar.raise_for_status()
        atts = ar.json().get("value", [])
        if not atts:
            errors.append(f"{ivnum}: אין נספח"); print("אין נספח"); continue
        raw = atts[0].get("EXTFILENAME", "")
        b64 = raw.split(",", 1)[1] if "," in raw else raw
        merger.append(io.BytesIO(base64.b64decode(b64)))
        print("OK")
    except Exception as e:
        errors.append(f"{ivnum}: {e}"); print(f"שגיאה: {e}")

if len(merger.pages) == 0:
    print("לא הורדה אף חשבונית"); sys.exit(1)

out = r"c:\Users\משתמש\Downloads\cinvoices_009_2026-05.pdf"
with open(out, "wb") as f:
    merger.write(f)
merger.close()
print(f"\nנשמר: {out}")
if errors:
    print(f"דולגו ({len(errors)}):")
    for e in errors: print(f"  {e}")
