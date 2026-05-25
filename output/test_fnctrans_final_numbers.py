# -*- coding: utf-8 -*-
"""Check what final FNCTRANS numbers look like in Priority."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
import requests
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv
from pathlib import Path
import urllib3
urllib3.disable_warnings()

load_dotenv(Path(__file__).parent.parent / ".env")
URL  = os.getenv("PRIORITY_URL_REAL", "").rstrip("/")
AUTH = HTTPBasicAuth(os.getenv("PRIORITY_USERNAME", ""), os.getenv("PRIORITY_PASSWORD", ""))
HDR  = {"Accept": "application/json", "OData-Version": "4.0"}

# Fetch recent FINALIZED FNCTRANS entries to see their number format
r = requests.get(
    f"{URL}/FNCTRANS?$filter=FINAL eq 'Y' and BRANCHNAME eq '110'"
    "&$select=FNCNUM,FINAL,FNCDATE,DETAILS,BRANCHNAME"
    "&$orderby=FNCDATE desc&$top=10",
    headers=HDR, auth=AUTH, timeout=20, verify=False
)
print(f"Final FNCTRANS for branch 110: {r.status_code}")
if r.ok:
    for item in r.json().get("value", []):
        print(f"  FNCNUM={item.get('FNCNUM')!r:20} FINAL={item.get('FINAL')!r} DATE={item.get('FNCDATE','')[:10]} DETAILS={str(item.get('DETAILS',''))[:40]}")

print()

# Also check T127759 specifically
r2 = requests.get(f"{URL}/FNCTRANS('T127759')?$select=FNCNUM,FINAL,FNCDATE,DETAILS",
                  headers=HDR, auth=AUTH, timeout=15, verify=False)
print(f"T127759 details: {r2.status_code} -> {r2.text[:400]}")
