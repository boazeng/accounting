import os, requests, json, warnings
warnings.filterwarnings('ignore')
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

url  = (os.getenv('PRIORITY_URL_REAL') or os.getenv('PRIORITY_URL', '')).rstrip('/')
user = os.getenv('PRIORITY_USERNAME', '')
pw   = os.getenv('PRIORITY_PASSWORD', '')
h    = {'Accept': 'application/json', 'OData-Version': '4.0'}

def get(path):
    r = requests.get(url + path, auth=(user, pw), headers=h, verify=False, timeout=15)
    return r.status_code, r.json() if r.ok else r.text

# Test 1: search by DETAILS with apostrophe (OData escaping: '' for ')
details_esc = "ביט'' לא"
path = f"/FNCTRANS?$filter=DETAILS eq '{details_esc}' and FINAL eq 'Y'&$select=FNCNUM,CURDATE,DETAILS&$orderby=FNCTRANS desc&$top=5"
print("=== Search by DETAILS 'ביט' לא' ===")
st, d = get(path)
print("Status:", st)
print(json.dumps(d if isinstance(d, list) else d.get('value', d), indent=2, ensure_ascii=False))

# Test 2: search by DETAILS for 'זיכוי -חניה אורבנית'
details2 = "זיכוי -חניה אורבנית"
path2 = f"/FNCTRANS?$filter=DETAILS eq '{details2}' and FINAL eq 'Y'&$select=FNCNUM,CURDATE,DETAILS&$orderby=FNCTRANS desc&$top=5"
print("\n=== Search by DETAILS 'זיכוי -חניה אורבנית' ===")
st2, d2 = get(path2)
print("Status:", st2)
print(json.dumps(d2 if isinstance(d2, list) else d2.get('value', d2), indent=2, ensure_ascii=False))
