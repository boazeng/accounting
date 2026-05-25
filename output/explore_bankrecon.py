# -*- coding: utf-8 -*-
"""Explore BANKRECON / BANKRECONSP structure in Priority OData."""
import os, requests, warnings, json
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth
from pathlib import Path
warnings.filterwarnings('ignore')
load_dotenv(Path(r'c:/Users/משתמש/aiprojects/accounting/.env'))

URL  = os.getenv('PRIORITY_URL_REAL', '').rstrip('/')
AUTH = HTTPBasicAuth(os.getenv('PRIORITY_USERNAME',''), os.getenv('PRIORITY_PASSWORD',''))
HDR  = {'Accept': 'application/json', 'OData-Version': '4.0'}

def get(endpoint, top=3):
    r = requests.get(f'{URL}/{endpoint}?$top={top}', headers=HDR, auth=AUTH, verify=False, timeout=15)
    print(f'\n=== {endpoint} [{r.status_code}] ===')
    if r.status_code == 200:
        val = r.json().get('value', [])
        for item in val:
            print(json.dumps(item, ensure_ascii=False, indent=2)[:800])
    else:
        print(r.text[:300])

# 1. Sample BANKRECON entries
get('BANKRECON')

# 2. Sample BANKRECONSP entries
get('BANKRECONSP')

# 3. Sample BANKLINESA to see KLINE relationship
r = requests.get(f'{URL}/BANKLINESA?$top=3&$select=BANKPAGE,KLINE,CASHNAME,FNCNUM,BTCODE,DETAILS,CREDIT,DEBIT,ERECONNUM',
                 headers=HDR, auth=AUTH, verify=False, timeout=15)
print(f'\n=== BANKLINESA (sample) [{r.status_code}] ===')
if r.status_code == 200:
    for item in r.json().get('value', []):
        print(json.dumps(item, ensure_ascii=False))

# 4. Try to find BANKLINESA lines with ERECONNUM > 0 (already reconciled) to understand the pattern
r2 = requests.get(f'{URL}/BANKLINESA?$filter=ERECONNUM gt 0&$top=3&$select=BANKPAGE,KLINE,FNCNUM,BTCODE,ERECONNUM,DETAILS',
                  headers=HDR, auth=AUTH, verify=False, timeout=15)
print(f'\n=== BANKLINESA (reconciled) [{r2.status_code}] ===')
if r2.status_code == 200:
    for item in r2.json().get('value', []):
        print(json.dumps(item, ensure_ascii=False))
