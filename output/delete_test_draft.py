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
headers = {'Accept': 'application/json', 'Content-Type': 'application/json', 'OData-Version': '4.0'}

IV = 77712
IVNUM = 'T12296'

# Try different DELETE URL formats
for endpoint in [
    f"{url}/TINVOICES({IV})",
    f"{url}/TINVOICES(IV={IV})",
    f"{url}/TINVOICES(IVNUM='{IVNUM}')",
]:
    r = requests.delete(endpoint, headers=headers, auth=auth, verify=False, timeout=10)
    print(f"DELETE {endpoint.split('TINVOICES')[1]}: {r.status_code} {r.text[:80]}")
    if r.status_code in (200, 204):
        print("DELETED OK")
        break

# Verify
r2 = requests.get(
    f"{url}/TINVOICES?$filter=IVNUM eq '{IVNUM}'&$select=IV,IVNUM,STATDES",
    headers=headers, auth=auth, verify=False, timeout=10
)
recs = r2.json().get('value', [])
if recs:
    print(f"\nסטטוס אחרי: עדיין קיים — {recs[0]}")
    print("לא ניתן למחוק דרך ה-API. יש למחוק ידנית בפריוריטי: TINVOICES T12296")
else:
    print("\nנמחק בהצלחה - לא קיים יותר")
