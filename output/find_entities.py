import os, requests, re, warnings
from pathlib import Path
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth
warnings.filterwarnings('ignore')
load_dotenv(Path(r'c:/Users/משתמש/aiprojects/accounting/.env'))

url = os.getenv('PRIORITY_URL_REAL','').rstrip('/')
user = os.getenv('PRIORITY_USERNAME','')
pw = os.getenv('PRIORITY_PASSWORD','')
auth = HTTPBasicAuth(user, pw)

print(f"Connecting to: {url}")
resp = requests.get(f'{url}/$metadata', headers={'Accept': 'application/xml'}, auth=auth, verify=False, timeout=30)
print(f"Status: {resp.status_code}")
entities = re.findall(r'EntitySet Name="([^"]+)"', resp.text)
keywords = ['RECEIPT','TRANS','BANK','FNCT','PAY','KREDIT','CREDIT','FNCREC','FNCN']
relevant = [e for e in entities if any(k in e.upper() for k in keywords)]
print(f'Total entities: {len(entities)}')
print('Relevant:')
for e in relevant:
    print(' ', e)
