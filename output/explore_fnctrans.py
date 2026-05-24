import os, requests, warnings, json
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth
from pathlib import Path
warnings.filterwarnings('ignore')
load_dotenv(Path(r'c:/Users/משתמש/aiprojects/accounting/.env'))

url = os.getenv('PRIORITY_URL_REAL','').rstrip('/')
auth = HTTPBasicAuth(os.getenv('PRIORITY_USERNAME',''), os.getenv('PRIORITY_PASSWORD',''))
headers = {'Accept': 'application/json', 'OData-Version': '4.0'}

# Get a few records to understand structure
r = requests.get(f'{url}/FNCTRANS?$top=3', headers=headers, auth=auth, verify=False, timeout=15)
data = r.json()
records = data.get('value', [])
if records:
    print("All fields:")
    for k, v in records[0].items():
        print(f"  {k}: {v}")
    print(f"\nTotal sample records: {len(records)}")
    print("\nAll records:")
    for rec in records:
        print(json.dumps(rec, ensure_ascii=False, indent=2))
else:
    print("No records")
