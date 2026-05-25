# -*- coding: utf-8 -*-
import sys, os, requests, urllib3
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv
from pathlib import Path
urllib3.disable_warnings()
load_dotenv(Path(__file__).parent.parent / ".env")
URL  = os.getenv("PRIORITY_URL_REAL", "").rstrip("/")
AUTH = HTTPBasicAuth(os.getenv("PRIORITY_USERNAME",""), os.getenv("PRIORITY_PASSWORD",""))
HDR  = {"Accept": "application/json", "OData-Version": "4.0"}

print(f"URL: {URL}\n")

# 1. Recent FNCTRANS entries
r = requests.get(f"{URL}/FNCTRANS?$select=FNCNUM,FINAL,FNCDATE,CHECKING&$orderby=FNCDATE desc&$top=5",
                 headers=HDR, auth=AUTH, timeout=15, verify=False)
print(f"Recent FNCTRANS: {r.status_code}")
if r.ok:
    for x in r.json().get("value", []):
        print(f"  FNCNUM={x.get('FNCNUM')!r:20} FINAL={x.get('FINAL')!r} CHECKING={x.get('CHECKING')!r} DATE={str(x.get('FNCDATE',''))[:10]}")

# 2. Direct key lookup for T127759
print()
for fncnum in ["T127759", "T127763", "T127769"]:
    r2 = requests.get(f"{URL}/FNCTRANS('{fncnum}')?$select=FNCNUM,FINAL,CHECKING",
                      headers=HDR, auth=AUTH, timeout=15, verify=False)
    print(f"{fncnum}: {r2.status_code} -> {r2.text[:150]}")
