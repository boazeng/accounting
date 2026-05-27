import os, requests, json, warnings
warnings.filterwarnings('ignore')
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

url  = (os.getenv('PRIORITY_URL_REAL') or os.getenv('PRIORITY_URL', '')).rstrip('/')
user = os.getenv('PRIORITY_USERNAME', '')
pw   = os.getenv('PRIORITY_PASSWORD', '')

def get(path):
    r = requests.get(url + path, auth=(user, pw),
                     headers={'Accept': 'application/json'}, verify=False, timeout=15)
    return r.status_code, r.json() if r.ok else r.text

print("=== Last 3 FINAL EINVOICES ===")
st, d = get("/EINVOICES?$filter=FINAL eq 'Y'&$orderby=IV desc&$top=3")
print("Status:", st)
items = d.get('value', d) if isinstance(d, dict) else d
for item in items:
    print(json.dumps(item, indent=2, ensure_ascii=False))
    print('---')

print("\n=== Last 3 DRAFT EINVOICES ===")
st2, d2 = get("/EINVOICES?$filter=FINAL ne 'Y'&$select=IVNUM,FNCNUM,IV,FINAL,STATDES,IVTYPE,DEBIT,ACCNAME,CUSTNAME,TOTPRICE,IVDATE&$orderby=IV desc&$top=3")
print("Status:", st2)
items2 = d2.get('value', d2) if isinstance(d2, dict) else d2
for item in items2:
    print(json.dumps(item, indent=2, ensure_ascii=False))
    print('---')
