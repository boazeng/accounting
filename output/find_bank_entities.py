import os, requests, warnings
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth
from pathlib import Path
warnings.filterwarnings('ignore')
load_dotenv(Path(r'c:/Users/משתמש/aiprojects/accounting/.env'))

url = os.getenv('PRIORITY_URL_REAL','').rstrip('/')
auth = HTTPBasicAuth(os.getenv('PRIORITY_USERNAME',''), os.getenv('PRIORITY_PASSWORD',''))
headers = {'Accept': 'application/json', 'OData-Version': '4.0'}

# Priority entity names to try for bank reconciliation / receipts
candidates = [
    'FNCN',         # תקבולים
    'FNCREC',       # תקבולים
    'RECEIPTS',
    'TRANSREC',
    'BANKREC',
    'BANKRECEIPTS',
    'FNCNREP',
    'CRDTTRANS',    # זכות
    'FNCTRANS',
    'TRANS',
    'JOURNAL',
    'JRNL',
    'JRNLINES',
    'PAYMENTS',
    'PAMENTS',
]

for name in candidates:
    try:
        r = requests.get(f'{url}/{name}?$top=1&$select=*', headers=headers, auth=auth, verify=False, timeout=10)
        if r.status_code == 200:
            data = r.json()
            keys = list(data.get('value', [{}])[0].keys()) if data.get('value') else []
            print(f'OK  {name} - {r.status_code} | fields: {keys[:6]}')
        else:
            print(f'NO  {name} - {r.status_code}')
    except Exception as e:
        print(f'ERR {name} - {str(e)[:50]}')
