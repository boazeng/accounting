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
headers = {'Accept': 'application/json', 'OData-Version': '4.0'}

# Try FNCPATNAME filter
print("=== FNCTRANS FNCPATNAME eq 'ק' (receipt transactions) ===")
r = requests.get(
    f"{url}/FNCTRANS?$top=10&$filter=FNCPATNAME eq 'ק' and IVRECONDATE eq null"
    f"&$select=FNCNUM,FNCDATE,ACCNAME1,ACCDES1,ACCNAME2,ACCDES2,SUMCREDIT,SUMDEBIT,BRANCHNAME,FNCPATNAME,DETAILS,IVRECONDATE"
    f"&$orderby=FNCDATE desc",
    headers=headers, auth=auth, verify=False, timeout=15
)
print(f"Status: {r.status_code}")
records = r.json().get('value', [])
print(f"Count: {len(records)}")
for rec in records:
    print(json.dumps(rec, ensure_ascii=False))

# Also try without IVRECONDATE filter
print("\n=== FNCTRANS FNCPATNAME eq 'ק' (all, last 5) ===")
r2 = requests.get(
    f"{url}/FNCTRANS?$top=5&$filter=FNCPATNAME eq 'ק'"
    f"&$select=FNCNUM,FNCDATE,ACCNAME1,ACCDES1,ACCNAME2,ACCDES2,SUMCREDIT,SUMDEBIT,BRANCHNAME,DETAILS,IVRECONDATE"
    f"&$orderby=FNCDATE desc",
    headers=headers, auth=auth, verify=False, timeout=15
)
print(f"Status: {r2.status_code}")
for rec in r2.json().get('value', []):
    print(json.dumps(rec, ensure_ascii=False))

# Try to delete the test draft T12296
print("\n=== DELETE test draft by IVNUM='T12296' ===")
r3 = requests.get(
    f"{url}/TINVOICES?$filter=IVNUM eq 'T12296'&$select=IV,IVNUM,STATDES",
    headers=headers, auth=auth, verify=False, timeout=10
)
recs = r3.json().get('value', [])
print(f"Found: {recs}")
if recs:
    iv = recs[0]['IV']
    rd = requests.delete(f'{url}/TINVOICES({iv})', headers=headers, auth=auth, verify=False, timeout=10)
    print(f"DELETE IV={iv}: {rd.status_code} {rd.text[:100]}")
