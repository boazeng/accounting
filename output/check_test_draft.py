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

r = requests.get(
    f"{url}/TINVOICES?$filter=IVNUM eq 'T12296'&$select=IV,IVNUM,STATDES,TOTPRICE,CDES,OWNERLOGIN,IVDATE",
    headers=headers, auth=auth, verify=False, timeout=10
)
recs = r.json().get('value', [])
if recs:
    print("EXISTS:", recs[0])
else:
    print("NOT FOUND - לא קיים בפריוריטי")
