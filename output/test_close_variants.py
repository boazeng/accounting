# -*- coding: utf-8 -*-
"""Try all CLOSEANFNCTRANS URL variants and new-draft-then-patch approach."""
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
WRIT2 = {"Accept": "application/json;odata.metadata=minimal", "Content-Type": "application/json;odata.metadata=minimal", "OData-Version": "4.0"}

FNCNUM = "T127759"

tests = [
    # Named key format
    ("POST", f"{URL}/FNCTRANS(FNCNUM='{FNCNUM}')/CLOSEANFNCTRANS", {}),
    # Namespace-qualified action
    ("POST", f"{URL}/FNCTRANS('{FNCNUM}')/Priority.CLOSEANFNCTRANS", {}),
    ("POST", f"{URL}/FNCTRANS('{FNCNUM}')/Tabz.CLOSEANFNCTRANS", {}),
    # With FNCNUM in body
    ("POST", f"{URL}/FNCTRANS/CLOSEANFNCTRANS", {"FNCNUM": FNCNUM}),
    ("POST", f"{URL}/CLOSEANFNCTRANS", {"FNCNUM": FNCNUM}),
    # Try different action names
    ("POST", f"{URL}/FNCTRANS('{FNCNUM}')/POST", {}),
    ("POST", f"{URL}/FNCTRANS('{FNCNUM}')/POSTFNCTRANS", {}),
    ("POST", f"{URL}/FNCTRANS('{FNCNUM}')/RECORDFNCTRANS", {}),
    ("POST", f"{URL}/FNCTRANS('{FNCNUM}')/REGISTERFNCTRANS", {}),
    # PATCH with all fields to trigger full registration
    ("PATCH", f"{URL}/FNCTRANS('{FNCNUM}')", {"FINAL": "Y", "MANUAL": "Y"}),
    ("PATCH", f"{URL}/FNCTRANS('{FNCNUM}')", {"FINAL": "Y", "BOOKNUM": ""}),
]

for method, url, body in tests:
    short = url.replace(URL, "").replace(f"('{FNCNUM}')", "(..)")[:]
    try:
        if method == "POST":
            r = requests.post(url, json=body, headers=WRIT, auth=AUTH, timeout=10, verify=False)
        else:
            r = requests.patch(url, json=body, headers=WRIT, auth=AUTH, timeout=10, verify=False)
        try:
            resp_data = r.json()
            # Extract error text if present
            err = ""
            if isinstance(resp_data, dict):
                form = resp_data.get("FORM", {})
                if isinstance(form, dict):
                    err = form.get("InterfaceErrors", {}).get("text", "")
                oerr = resp_data.get("error", {})
                if isinstance(oerr, dict):
                    err = oerr.get("message", "")
        except Exception:
            err = r.text[:100]
        print(f"[{r.status_code}] {method} {short}: {err or 'ok'}")
    except Exception as e:
        print(f"[ERR] {method} {short}: {e}")
