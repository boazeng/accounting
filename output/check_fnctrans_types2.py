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

# Get all fields of a recent final FNCTRANS
r = requests.get(
    f"{URL}/FNCTRANS?$filter=FINAL eq 'Y'&$top=1",
    headers=HDR, auth=AUTH, timeout=20, verify=False)
print("Recent FINAL FNCTRANS (all fields):")
data = r.json()
if "value" in data and data["value"]:
    entry = data["value"][0]
    for k, v in sorted(entry.items()):
        if not k.startswith("@") and v is not None and v != "" and v != 0:
            print(f"  {k}: {v!r}")
else:
    print(json.dumps(data, ensure_ascii=False, indent=2)[:500])
