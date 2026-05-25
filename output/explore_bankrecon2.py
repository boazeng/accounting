# -*- coding: utf-8 -*-
"""Test bank reconciliation API options."""
import os, requests, warnings, json
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth
from pathlib import Path
warnings.filterwarnings('ignore')
load_dotenv(Path(r'c:/Users/משתמש/aiprojects/accounting/.env'))

URL  = os.getenv('PRIORITY_URL_REAL', '').rstrip('/')
AUTH = HTTPBasicAuth(os.getenv('PRIORITY_USERNAME',''), os.getenv('PRIORITY_PASSWORD',''))
HDR  = {'Accept': 'application/json', 'OData-Version': '4.0'}
WRT  = {'Accept': 'application/json', 'Content-Type': 'application/json', 'OData-Version': '4.0'}

def get(ep, top=2):
    r = requests.get(f'{URL}/{ep}?$top={top}', headers=HDR, auth=AUTH, verify=False, timeout=15)
    print(f'\n=== GET {ep} [{r.status_code}] ===')
    if r.status_code == 200:
        for item in r.json().get('value', []):
            print(json.dumps(item, ensure_ascii=False)[:500])
    else:
        print(r.text[:300])

# 1. Try BANKRECONQ (query view)
get('BANKRECONQ')

# 2. Fetch unreconciled bank line and get its BANKPAGE/KLINE
r = requests.get(f'{URL}/BANKLINESA?$filter=ERECONNUM eq 0&$top=1'
                 '&$select=BANKPAGE,KLINE,CASHNAME,FNCNUM,BTCODE,DETAILS,CREDIT,DEBIT,BPNUMA',
                 headers=HDR, auth=AUTH, verify=False, timeout=15)
print(f'\n=== Unreconciled BANKLINESA [{r.status_code}] ===')
line = None
if r.status_code == 200:
    vals = r.json().get('value', [])
    if vals:
        line = vals[0]
        print(json.dumps(line, ensure_ascii=False))

# 3. Try to PATCH BANKLINESA line with ERECONNUM or FNCNUM
if line:
    bp = line.get('BANKPAGE')
    kl = line.get('KLINE')
    # Try PATCH to set FNCNUM on bank line
    patch_url = f'{URL}/BANKLINESA(BANKPAGE={bp},KLINE={kl})'
    r2 = requests.patch(patch_url, json={'FNCNUM': 'TEST'}, headers=WRT, auth=AUTH, verify=False, timeout=15)
    print(f'\n=== PATCH BANKLINESA FNCNUM [{r2.status_code}] ===')
    print(r2.text[:300])

# 4. Try POST to BANKRECONSP with explicit fields
payload_sp = {
    'FRST_FNCNUM': 'T127763',
    'SCND_BPNUMA': str(line.get('BANKPAGE', '')) if line else '',
    'SCND_BTCODE': line.get('BTCODE', '') if line else '',
}
r3 = requests.post(f'{URL}/BANKRECONSP', json=payload_sp, headers=WRT, auth=AUTH, verify=False, timeout=15)
print(f'\n=== POST BANKRECONSP [{r3.status_code}] ===')
print(r3.text[:300])

# 5. Try the MANBANKRECON approach
get('MANBANKRECON')
