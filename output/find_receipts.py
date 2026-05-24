# -*- coding: utf-8 -*-
import os, requests, warnings, json, sys
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
warnings.filterwarnings('ignore')
load_dotenv(Path(r'c:/Users/משתמש/aiprojects/accounting/.env'))

url = os.getenv('PRIORITY_URL_REAL','').rstrip('/')
auth = HTTPBasicAuth(os.getenv('PRIORITY_USERNAME',''), os.getenv('PRIORITY_PASSWORD',''))
headers = {'Accept': 'application/json', 'OData-Version': '4.0'}

# Filter: credit transactions (receipts = זכות)
r = requests.get(
    f'{url}/FNCTRANS?$top=5&$filter=SUMCREDIT gt 0&$orderby=FNCDATE desc',
    headers=headers, auth=auth, verify=False, timeout=15
)
data = r.json()
records = data.get('value', [])
print(f"Receipts (SUMCREDIT>0): {len(records)} found")
for rec in records:
    print(json.dumps({
        'FNCNUM': rec.get('FNCNUM'),
        'FNCDATE': rec.get('FNCDATE','')[:10],
        'FNCPATNAME': rec.get('FNCPATNAME'),
        'FNCPATDES2': rec.get('FNCPATDES2'),
        'ACCNAME1': rec.get('ACCNAME1'),
        'ACCDES1': rec.get('ACCDES1'),
        'ACCNAME2': rec.get('ACCNAME2'),
        'ACCDES2': rec.get('ACCDES2'),
        'SUMCREDIT': rec.get('SUMCREDIT'),
        'SUMDEBIT': rec.get('SUMDEBIT'),
        'DETAILS': rec.get('DETAILS'),
        'IVRECONDATE': rec.get('IVRECONDATE'),
        'CHECKING': rec.get('CHECKING'),
    }, ensure_ascii=False, indent=2))

# Also check what CHECKING values exist
print("\n--- checking CHECKING field values ---")
r2 = requests.get(
    f'{url}/FNCTRANS?$top=10&$select=FNCNUM,SUMCREDIT,SUMDEBIT,CHECKING,IVRECONDATE,FNCPATNAME&$filter=SUMCREDIT gt 0',
    headers=headers, auth=auth, verify=False, timeout=15
)
for rec in r2.json().get('value', []):
    print(rec)
