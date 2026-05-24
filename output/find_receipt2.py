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

print("=== AINVOICES sample ===")
r = requests.get(f'{url}/AINVOICES?$top=2', headers=headers, auth=auth, verify=False, timeout=10)
for rec in r.json().get('value', []):
    print(json.dumps({k:v for k,v in rec.items()}, ensure_ascii=False, indent=2))

print("\n=== CINVOICES sample ===")
r = requests.get(f'{url}/CINVOICES?$top=2', headers=headers, auth=auth, verify=False, timeout=10)
for rec in r.json().get('value', []):
    print(json.dumps({k:v for k,v in rec.items()}, ensure_ascii=False, indent=2))

# Try more receipt candidates
candidates2 = [
    'FNCTRANSREC', 'FNCPAY', 'FNCRCPT', 'CUSTRCPTS',
    'CRECEIPTS', 'CRECEIPTSLINES',
    'TRANSTYPES', 'IVTYPES', 'TRANSHEAD',
    'PJRNL', 'JRNLLINES',
    'FINTRANS', 'FINANCIAL',
    'CUSTLEDGER', 'CUSTTRANSACTIONS',
    'TAXINVOICES', 'TINVOICES',
    'SALESINVOICES', 'SALINVOICES',
    'FNCCUST', 'FNCSUPP',
    'IVGENERATOR', 'IVBATCH',
]
print("\n=== More candidates ===")
for name in candidates2:
    try:
        r = requests.get(f'{url}/{name}?$top=1', headers=headers, auth=auth, verify=False, timeout=5)
        if r.status_code == 200:
            keys = list(r.json().get('value', [{}])[0].keys())[:6]
            print(f'OK  {name} | {keys}')
        else:
            print(f'NO  {name} - {r.status_code}')
    except:
        print(f'ERR {name}')
