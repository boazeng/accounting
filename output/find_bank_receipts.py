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
headers = {'Accept': 'application/json', 'Content-Type': 'application/json', 'OData-Version': '4.0'}

# 1. Find FNCTRANS entries that are customer receipts
# bank (40x) debit AND customer (50x) credit
print("=== FNCTRANS: ACCNAME2 startswith '50' ===")
r = requests.get(
    f"{url}/FNCTRANS?$top=10&$filter=startswith(ACCNAME2,'50') and SUMCREDIT gt 0"
    f"&$select=FNCNUM,FNCDATE,ACCNAME1,ACCDES1,ACCNAME2,ACCDES2,SUMCREDIT,BRANCHNAME,IVRECONDATE"
    f"&$orderby=FNCDATE desc",
    headers=headers, auth=auth, verify=False, timeout=15
)
print(f"Status: {r.status_code}")
for rec in r.json().get('value', []):
    print(rec)

# 2. Get unique CASHNAME values from TINVOICES (bank account codes used in receipts)
print("\n=== Available CASHNAME bank codes in TINVOICES ===")
r2 = requests.get(
    f'{url}/TINVOICES?$top=50&$select=CASHNAME,BRANCHNAME&$orderby=IVDATE desc',
    headers=headers, auth=auth, verify=False, timeout=15
)
cashnames = {}
for rec in r2.json().get('value', []):
    key = (rec.get('CASHNAME'), rec.get('BRANCHNAME'))
    cashnames[key] = True
for k in sorted(cashnames.keys()):
    print(f"  CASHNAME: {k[0]}  BRANCH: {k[1]}")

# 3. Delete the test draft T12296 (IV=77712)
print("\n=== DELETE test draft T12296 (IV=77712) ===")
r3 = requests.delete(
    f'{url}/TINVOICES(77712)',
    headers=headers, auth=auth, verify=False, timeout=10
)
print(f"DELETE status: {r3.status_code}")
if r3.text:
    print(r3.text[:200])
