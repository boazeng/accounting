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
  // 1. List FNCPAT patterns
  console.log('=== FNCPAT patterns ===');
  try {
    const d = await get(`${odataUrl}/FNCPAT?$top=20`);
    (d.value || []).forEach(p => console.log(`  FNCPATNAME=${JSON.stringify(p.FNCPATNAME)}  DES=${JSON.stringify(p.FNCPATDES)}  DES2=${JSON.stringify(p.FNCPATDES2)}`));
  } catch(e) { console.log('  Error:', e.message); }

  // 2. Recent final FNCTRANS with FNCPATNAME
  console.log('\n=== Recent FINAL FNCTRANS with FNCPATNAME ===');
  try {
    const d2 = await get(`${odataUrl}/FNCTRANS?$filter=FINAL eq 'Y'&$top=5&$select=FNCNUM,FNCPATNAME,FNCPATDES2,DETAILS,BRANCHNAME`);
    (d2.value || []).forEach(e => console.log(`  ${e.FNCNUM} PAT=${JSON.stringify(e.FNCPATNAME)} PATDES=${JSON.stringify(e.FNCPATDES2)} DETAILS=${JSON.stringify((e.DETAILS||'').substring(0,30))}`));
  } catch(e) { console.log('  Error:', e.message); }
})();
