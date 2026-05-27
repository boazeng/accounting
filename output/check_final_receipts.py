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

# Show all fields of the most recent final receipt
print("=== Most recent final receipt (all fields) ===")
st, d = get("/TINVOICES?$filter=FINAL eq 'Y'&$orderby=IV desc&$top=1")
print("Status:", st)
print(json.dumps(d.get('value', d) if isinstance(d, dict) else d, indent=2, ensure_ascii=False))
