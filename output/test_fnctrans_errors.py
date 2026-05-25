# -*- coding: utf-8 -*-
"""Decode Priority interface errors and test PATCH FINAL=Y approach."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
import requests, json
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv
from pathlib import Path
import urllib3
urllib3.disable_warnings()

load_dotenv(Path(__file__).parent.parent / ".env")
URL  = os.getenv("PRIORITY_URL_REAL", "").rstrip("/")
AUTH = HTTPBasicAuth(os.getenv("PRIORITY_USERNAME", ""), os.getenv("PRIORITY_PASSWORD", ""))
HDR  = {"Accept": "application/json", "OData-Version": "4.0"}
WRIT = {"Accept": "application/json", "Content-Type": "application/json", "OData-Version": "4.0"}

FNCNUM = "T127759"

# Step 1: fetch existing draft with items
print("Fetching T127759 details...")
r = requests.get(
    f"{URL}/FNCTRANS('{FNCNUM}')?$expand=FNCITEMS_SUBFORM($select=ACCNAME,DEBIT1,CREDIT1,DETAILS)",
    headers=HDR, auth=AUTH, timeout=20, verify=False)
print(f"Status: {r.status_code}")
draft = r.json()
print(json.dumps(draft, ensure_ascii=False, indent=2))

print("\n--- Trying POST with FINAL=Y (showing full error) ---")
fncdate = (draft.get("FNCDATE") or "")[:10]
items = draft.get("FNCITEMS_SUBFORM") or []
payload = {
    "FNCDATE": fncdate, "BALDATE": fncdate,
    "BRANCHNAME": draft.get("BRANCHNAME",""),
    "DETAILS": draft.get("DETAILS",""),
    "FINAL": "Y",
    "FNCITEMS_SUBFORM": [
        {"ACCNAME": it.get("ACCNAME",""), "DEBIT1": it.get("DEBIT1",0),
         "CREDIT1": it.get("CREDIT1",0), "DETAILS": it.get("DETAILS","")}
        for it in items
    ],
}
print("Payload:", json.dumps(payload, ensure_ascii=False, indent=2))
r2 = requests.post(f"{URL}/FNCTRANS", json=payload, headers=WRIT, auth=AUTH, timeout=20, verify=False)
print(f"POST status: {r2.status_code}")
try:
    print("Response:", json.dumps(r2.json(), ensure_ascii=False, indent=2))
except Exception:
    print("Response text:", r2.text[:1000])
