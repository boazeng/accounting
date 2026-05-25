'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const odataUrl = (process.env.PRIORITY_URL_REAL || '').replace(/\/$/, '');
const user = process.env.PRIORITY_USERNAME;
const pass = process.env.PRIORITY_PASSWORD;
const auth = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
const hdr  = { Authorization: auth, Accept: 'application/json', 'OData-Version': '4.0' };

async function get(url) {
  const r = await fetch(url, { headers: hdr });
  return r.json();
}

(async () => {
  // Search for ALL distinct FNCPATNAME values across more entries
  console.log('=== Scanning 500 recent FNCTRANS for all FNCPATNAME values ===');
  const d = await get(`${odataUrl}/FNCTRANS?$filter=FINAL eq 'Y'&$top=500&$select=FNCPATNAME,FNCPATDES2`);
  const pats = {};
  for (const e of (d.value||[])) {
    const key = e.FNCPATNAME || '(empty)';
    pats[key] = e.FNCPATDES2 || '';
  }
  console.log('All FNCPATNAME values found:');
  Object.entries(pats).forEach(([k,v]) => console.log(`  PAT=${JSON.stringify(k)}  DES2=${JSON.stringify(v)}`));

  // Try to create a test entry with FNCPATNAME='ה' to see if it's accepted
  console.log('\n=== Testing FNCPATNAME values ===');
  // First: list via FNCPAT with $search or filter
  const fp = await get(`${odataUrl}/FNCPAT?$top=50&$select=FNCPATNAME,FNCPATDES,FNCPATDES2`);
  if (fp.value) {
    console.log('FNCPAT entries:');
    fp.value.forEach(p => console.log(`  ${JSON.stringify(p.FNCPATNAME)}  ${JSON.stringify(p.FNCPATDES)}  ${JSON.stringify(p.FNCPATDES2)}`));
  } else {
    console.log('FNCPAT result:', JSON.stringify(fp).substring(0, 200));
  }
})();
