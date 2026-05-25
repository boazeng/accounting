# -*- coding: utf-8 -*-
import os, requests, json, urllib3
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv
from pathlib import Path
urllib3.disable_warnings()
load_dotenv(Path(__file__).parent.parent / ".env")
URL  = os.getenv("PRIORITY_URL_REAL", "").rstrip("/")
AUTH = HTTPBasicAuth(os.getenv("PRIORITY_USERNAME",""), os.getenv("PRIORITY_PASSWORD",""))
HDR  = {"Accept": "application/json", "OData-Version": "4.0"}

# 1. List FNCPAT patterns to find the reconciliation one
print("=== FNCPAT patterns ===")
r = requests.get(f"{URL}/FNCPAT?$top=20", headers=HDR, auth=AUTH, timeout=20, verify=False)
print(f"Status: {r.status_code}")
if r.ok:
    for p in r.json().get("value", []):
        print(f"  FNCPATNAME={p.get('FNCPATNAME')!r}  FNCPATDES={p.get('FNCPATDES','')!r}  FNCPATDES2={p.get('FNCPATDES2','')!r}")
else:
    print(r.text[:300])

# 2. Compare a recent "התאמה" entry vs simple entry
print("\n=== Recent FNCTRANS with FNCPATNAME ===")
r2 = requests.get(
    f"{URL}/FNCTRANS?$filter=FINAL eq 'Y'&$top=5&$select=FNCNUM,FNCPATNAME,FNCPATDES2,DETAILS,BRANCHNAME",
    headers=HDR, auth=AUTH, timeout=20, verify=False)
if r2.ok:
    for e in r2.json().get("value", []):
        print(f"  FNCNUM={e.get('FNCNUM')!r} PAT={e.get('FNCPATNAME')!r} PATDES={e.get('FNCPATDES2','')!r} DETAILS={str(e.get('DETAILS',''))[:30]!r}")
else:
    print(r2.text[:300])
