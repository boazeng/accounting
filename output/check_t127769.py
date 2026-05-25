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

r = requests.get(f"{URL}/FNCTRANS('T127769')?$select=FNCNUM,FINAL,CHECKING,FNCTRANS,FNCDATE,BRANCHNAME",
                 headers=HDR, auth=AUTH, timeout=15, verify=False)
print(f"T127769: {r.status_code}")
print(json.dumps(r.json(), ensure_ascii=False, indent=2))
