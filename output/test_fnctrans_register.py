# -*- coding: utf-8 -*-
"""Test various ways to register (finalize) a FNCTRANS journal entry in Priority."""
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
WRIT = {"Accept": "application/json", "Content-Type": "application/json", "OData-Version": "4.0"}

FNCNUM = "T127759"

print(f"=== Testing finalization of {FNCNUM} ===\n")

# 1. Current state
print("1. Current state:")
r = requests.get(f"{URL}/FNCTRANS('{FNCNUM}')?$select=FNCNUM,FINAL,FNCDATE,BRANCHNAME",
                 headers=HDR, auth=AUTH, timeout=15, verify=False)
print(f"   GET FNCTRANS: {r.status_code} -> {r.text[:300]}\n")

# 2. Try entity-level action (what we had before)
print("2. POST FNCTRANS(key)/CLOSEANFNCTRANS:")
r2 = requests.post(f"{URL}/FNCTRANS('{FNCNUM}')/CLOSEANFNCTRANS",
                   json={}, headers=WRIT, auth=AUTH, timeout=15, verify=False)
print(f"   {r2.status_code} -> {r2.text[:300]}\n")

# 3. Try collection-level action
print("3. POST FNCTRANS/CLOSEANFNCTRANS:")
r3 = requests.post(f"{URL}/FNCTRANS/CLOSEANFNCTRANS",
                   json={"FNCNUM": FNCNUM}, headers=WRIT, auth=AUTH, timeout=15, verify=False)
print(f"   {r3.status_code} -> {r3.text[:300]}\n")

# 4. Try root-level function import
print("4. POST /CLOSEANFNCTRANS:")
r4 = requests.post(f"{URL}/CLOSEANFNCTRANS",
                   json={"FNCNUM": FNCNUM}, headers=WRIT, auth=AUTH, timeout=15, verify=False)
print(f"   {r4.status_code} -> {r4.text[:300]}\n")

# 5. Try ACTIVATE variant
print("5. POST FNCTRANS(key)/ACTIVATE:")
r5 = requests.post(f"{URL}/FNCTRANS('{FNCNUM}')/ACTIVATE",
                   json={}, headers=WRIT, auth=AUTH, timeout=15, verify=False)
print(f"   {r5.status_code} -> {r5.text[:300]}\n")

# 6. Try GET $metadata to see what actions are defined for FNCTRANS
print("6. GET $metadata (first 3000 chars around FNCTRANS):")
rm = requests.get(f"{URL}/$metadata", headers={"Accept": "application/xml"}, auth=AUTH, timeout=30, verify=False)
print(f"   {rm.status_code}, content length: {len(rm.text)}")
if rm.ok:
    txt = rm.text
    # Find FNCTRANS-related actions
    import re
    actions = re.findall(r'<(?:Action|Function|EntityType)[^>]*Name="[^"]*(?:[Ff][Nn][Cc]|FNCTRANS|JOURNAL|journal)[^"]*"[^>]*>', txt)
    print(f"   FNCTRANS-related entities/actions: {actions[:20]}")
    # Also search for "CLOSE" actions
    close_actions = re.findall(r'<(?:Action|Function)[^>]*Name="[^"]*(?:CLOSE|REGISTER|ACTIVATE|POST)[^"]*"[^>]*>', txt)
    print(f"   CLOSE/REGISTER actions: {close_actions[:20]}")
print()

# 7. Try PATCH with FINAL='Y' and check response
print("7. PATCH FNCTRANS(key) FINAL=Y:")
r7 = requests.patch(f"{URL}/FNCTRANS('{FNCNUM}')",
                    json={"FINAL": "Y"}, headers=WRIT, auth=AUTH, timeout=15, verify=False)
print(f"   {r7.status_code} -> {r7.text[:300]}\n")

# 8. After patch - re-fetch
print("8. Re-fetch after PATCH:")
r8 = requests.get(f"{URL}/FNCTRANS('{FNCNUM}')?$select=FNCNUM,FINAL",
                  headers=HDR, auth=AUTH, timeout=15, verify=False)
print(f"   {r8.status_code} -> {r8.text[:300]}\n")
