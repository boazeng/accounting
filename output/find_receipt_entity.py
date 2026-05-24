# -*- coding: utf-8 -*-
import os, requests, warnings, sys
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
warnings.filterwarnings('ignore')
load_dotenv(Path(r'c:/Users/משתמש/aiprojects/accounting/.env'))

url = os.getenv('PRIORITY_URL_REAL','').rstrip('/')
auth = HTTPBasicAuth(os.getenv('PRIORITY_USERNAME',''), os.getenv('PRIORITY_PASSWORD',''))
headers = {'Accept': 'application/json', 'OData-Version': '4.0'}

# Priority receipt-related entity candidates
# In Priority ERP, receipts (קבלות) are often under FNCN or similar
candidates = [
    # Receipt / journal voucher entities
    'FNCN',         # journal voucher header
    'FNCNLINES',    # journal voucher lines
    'FNCREC',       # receipt record
    'RECEIPTS',
    'RECEIPT',
    'RCPT',
    # Customer payment / receipt
    'CUSTPAYMENTS',
    'CUSTRECEIPTS',
    'CUSTPAY',
    'CUSTRCPT',
    # Priority-specific
    'PORDERS',
    'AINVOICES',
    'CINVOICES',
    'IVOUNCHERS',
    'VOUCHERS',
    'VOUCHERLINES',
    # Accounts receivable
    'ARCUSTMERS',
    'ARCUSTOMERLINES',
    'ARTRANS',
    # Possible receipt doc
    'RCTDOC',
    'RCTDOCS',
    'RCTTRANS',
    'RCTTRANS',
    'FNCNOPEN',
    'CUSTOPEN',
    'CUSTOPENTRANS',
    'OPENITEMS',
    # Priority uses sometimes hebrew-rooted abbreviations
    'IVRECON',
    'IVRECONCILE',
    'BANKTRANS',
    'BANKIMPORT',
    'FNCCHECK',
    'CHECKS',
    'CHECKLINES',
]

print(f"Probing {len(candidates)} entities...")
for name in candidates:
    try:
        r = requests.get(f'{url}/{name}?$top=1', headers=headers, auth=auth, verify=False, timeout=6)
        if r.status_code == 200:
            data = r.json()
            keys = list(data.get('value', [{}])[0].keys())[:8] if data.get('value') else []
            print(f'OK  {name} | {keys}')
        else:
            print(f'NO  {name} - {r.status_code}')
    except Exception as e:
        print(f'ERR {name} - {str(e)[:40]}')
