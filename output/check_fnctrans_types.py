# -*- coding: utf-8 -*-
"""Check FNCTRANS fields for type/journal type."""
import os, requests, json, urllib3
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv
from pathlib import Path
urllib3.disable_warnings()
load_dotenv(Path(__file__).parent.parent / ".env")
URL  = os.getenv("PRIORITY_URL_REAL", "").rstrip("/")
AUTH = HTTPBasicAuth(os.getenv("PRIORITY_USERNAME",""), os.getenv("PRIORITY_PASSWORD",""))
HDR  = {"Accept": "application/json", "OData-Version": "4.0"}

# 1. Look at a recent final FNCTRANS to see what fields it has (especially type-related)
r = requests.get(
    f"{URL}/FNCTRANS?$filter=FINAL eq 'Y'&$top=1&$select=FNCNUM,FNCTYPE,JOURNAL,TYPE,FNCTRANSTYPE,DESCRIPTION,FNCDATE",
    headers=HDR, auth=AUTH, timeout=15, verify=False)
print("Recent FINAL FNCTRANS fields:")
print(json.dumps(r.json(), ensure_ascii=False, indent=2))

# 2. Check $metadata for FNCTRANS to see all fields
print("\n--- Fetching $metadata for FNCTRANS ---")
rm = requests.get(f"{URL}/$metadata", headers={"Accept": "application/xml"}, auth=AUTH, timeout=30, verify=False)
if rm.ok:
    import re
    # Find FNCTRANS EntityType
    txt = rm.text
    start = txt.find('Name="FNCTRANS"')
    if start > 0:
        block = txt[max(0,start-50):start+3000]
        # Find type-related properties
        props = re.findall(r'<Property[^>]*Name="[^"]*(?:TYPE|JOURNAL|TRANS|FNCTYPE)[^"]*"[^>]*/>', block, re.IGNORECASE)
        print("Type-related properties:", props[:20])
        # Also show first 20 properties
        all_props = re.findall(r'<Property[^>]*Name="([^"]*)"[^>]*/>', block)
        print("All FNCTRANS properties (first 30):", all_props[:30])
