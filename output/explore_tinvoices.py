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

print("=== TINVOICES - all fields ===")
r = requests.get(f'{url}/TINVOICES?$top=3&$orderby=IVDATE desc', headers=headers, auth=auth, verify=False, timeout=15)
data = r.json()
records = data.get('value', [])
print(f"Count: {len(records)}")
if records:
    print("Fields:", list(records[0].keys()))
    for rec in records:
        print(json.dumps(rec, ensure_ascii=False, indent=2))

# Check if TINVOICES supports subforms / navigation
print("\n=== Try TINVOICESLINES ===")
r2 = requests.get(f'{url}/TINVOICESLINES?$top=1', headers=headers, auth=auth, verify=False, timeout=8)
print(f"TINVOICESLINES: {r2.status_code}")

# Also try to GET metadata for TINVOICES
print("\n=== Recent TINVOICES (last 10) ===")
r3 = requests.get(f'{url}/TINVOICES?$top=10&$select=IVNUM,IVDATE,ACCNAME,CDES,CASHNAME,TOTPRICE,STATDES&$orderby=IVDATE desc',
                  headers=headers, auth=auth, verify=False, timeout=15)
for rec in r3.json().get('value', []):
    print(rec)
