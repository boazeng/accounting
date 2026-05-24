# -*- coding: utf-8 -*-
import os, requests, warnings, sys, json
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
warnings.filterwarnings('ignore')
load_dotenv(Path(r'c:/Users/משתמש/aiprojects/accounting/.env'))

url = os.getenv('PRIORITY_URL_REAL','').rstrip('/')
auth = HTTPBasicAuth(os.getenv('PRIORITY_USERNAME',''), os.getenv('PRIORITY_PASSWORD',''))
headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'OData-Version': '4.0'
}

# First, look at what CASHNAME values are available for bank accounts
# Look at FNCTRANS to find ACCNAME1 (bank) for a recent receipt and cross-ref
print("=== FNCTRANS recent receipts (ACCNAME1 starts with 40) ===")
r = requests.get(
    f'{url}/FNCTRANS?$top=5&$filter=SUMCREDIT gt 0&$select=FNCNUM,FNCDATE,ACCNAME1,ACCDES1,ACCNAME2,ACCDES2,SUMCREDIT,SUMDEBIT,BRANCHNAME',
    headers=headers, auth=auth, verify=False, timeout=15
)
fnctrans_recs = r.json().get('value', [])
for rec in fnctrans_recs:
    print(rec)

# Now try to create a draft TINVOICES
print("\n=== POST TINVOICES draft ===")
# Use real customer from the TINVOICES we found:  50785-110 / 110-103
payload = {
    "CUSTNAME": "50785",       # customer number
    "ACCNAME": "50785-110",    # customer account with branch
    "CASHNAME": "110-103",     # bank account code in receipts
    "TOTPRICE": 100.0,
    "IVDATE": "2026-05-18T00:00:00Z",
    "BRANCHNAME": "110",
    "DETAILS": "בדיקה - תקבול טיוטא מ-API",
    "FNCPATNAME": "ק",
}
r_post = requests.post(f'{url}/TINVOICES', json=payload, headers=headers, auth=auth, verify=False, timeout=15)
print(f"Status: {r_post.status_code}")
try:
    resp = r_post.json()
    print(json.dumps(resp, ensure_ascii=False, indent=2))
except:
    print(r_post.text[:500])
