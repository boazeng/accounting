import os, requests, json, warnings
warnings.filterwarnings('ignore')
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

url  = (os.getenv('PRIORITY_URL_REAL') or os.getenv('PRIORITY_URL', '')).rstrip('/')
user = os.getenv('PRIORITY_USERNAME', '')
pw   = os.getenv('PRIORITY_PASSWORD', '')

def get(path):
    r = requests.get(url + path, auth=(user, pw),
                     headers={'Accept': 'application/json', 'OData-Version': '4.0'}, verify=False, timeout=15)
    return r.status_code, r.json() if r.ok else r.text

for fncnum in ['T127857', 'T127867']:
    print(f"\n=== FNCTRANS('{fncnum}') ===")
    st, d = get(f"/FNCTRANS('{fncnum}')?$select=FNCTRANS,FNCNUM,FINAL,FNCPATNAME,IVDATE,DEBIT1,SUM1")
    print("Status:", st)
    print(json.dumps(d, indent=2, ensure_ascii=False))

print("\n=== Last 5 FINAL FNCTRANS ===")
st, d = get("/FNCTRANS?$filter=FINAL eq 'Y'&$select=FNCTRANS,FNCNUM,FINAL,FNCPATNAME,IVDATE,SUM1&$orderby=FNCTRANS desc&$top=5")
print("Status:", st)
items = d.get('value', d) if isinstance(d, dict) else d
print(json.dumps(items[:2], indent=2, ensure_ascii=False))
