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

candidates = [
    'BANKSTMNT', 'BANKSTAT', 'BANKACC', 'BANKACCOUNTS',
    'BANKRECORD', 'BANKMATCHING', 'FNCNREC', 'TQBULIM',
    'FNCTRANSREC', 'FNCNOPEN', 'CUSTPAYMENTS', 'CUSTTRANS',
    'FNCN', 'FNCNLINES', 'TRANSDEF',
]

for name in candidates:
    try:
        r = requests.get(f'{url}/{name}?$top=1', headers=headers, auth=auth, verify=False, timeout=8)
        if r.status_code == 200:
            data = r.json()
            keys = list(data.get('value', [{}])[0].keys())[:5] if data.get('value') else []
            print(f'OK  {name} | {keys}')
        else:
            print(f'NO  {name} - {r.status_code}')
    except:
        print(f'ERR {name}')
