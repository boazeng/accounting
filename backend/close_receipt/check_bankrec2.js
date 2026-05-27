'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const odataUrl = (process.env.PRIORITY_URL_REAL || '').replace(/\/$/, '');
const user = process.env.PRIORITY_USERNAME;
const pass = process.env.PRIORITY_PASSWORD;
const auth = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
const hdr = { Authorization: auth, Accept: 'application/json', 'OData-Version': '4.0', 'Content-Type': 'application/json' };
async function tryGet(url) {
  const r = await fetch(url, { headers: { ...hdr, 'Content-Type': undefined } });
  return { status: r.status, text: (await r.text()).substring(0, 200) };
}

(async () => {
  // 1. Try more entity name variations for bank reconciliation
  const candidates = [
    'BANKREC', 'BANKSTMT', 'BNKSTMNT', 'FNCTRANSREC', 'FNCMATCH',
    'BNKRECORD', 'TMPBNKREC', 'BNKMATCH', 'BANKRECLINE', 'FNCBANKLINE'
  ];
  console.log('=== Testing entity names ===');
  for (const e of candidates) {
    const r = await tryGet(`${odataUrl}/${e}?$top=1`);
    if (r.status !== 404) console.log(`  ${e}: ${r.status} → ${r.text}`);
    else console.log(`  ${e}: 404`);
  }

  // 2. Try to look at FNCTRANS with הת and expand sub-forms
  console.log('\n=== FNCTRANS הת with expanded subforms ===');
  const r2 = await tryGet(`${odataUrl}/FNCTRANS?$filter=FNCPATNAME eq 'הת'&$top=1&$expand=FNCITEMS_SUBFORM`);
  console.log(`  FNCTRANS+FNCITEMS_SUBFORM: ${r2.status} → ${r2.text}`);

  // 3. Try to POST to BANKRECON with full fields to see exact error
  console.log('\n=== POST to BANKRECON ===');
  const r3 = await fetch(`${odataUrl}/BANKRECON`, {
    method: 'POST', headers: hdr,
    body: JSON.stringify({ CASHNAME: 'בנק הפועלים 738-0686818', BRANCHNAME: '110' })
  });
  console.log(`  BANKRECON POST: ${r3.status} → ${(await r3.text()).substring(0,300)}`);

  // 4. Look at FNCTRANS fields for "bank" related fields (FNCREF etc.)
  console.log('\n=== FNCTRANS with הת - full field list ===');
  const r4 = await tryGet(`${odataUrl}/FNCTRANS?$filter=FNCPATNAME eq 'הת'&$top=1`);
  console.log(r4.text);

  // 5. Try to delete T127774 that was stuck
  console.log('\n=== Cleanup T127774 ===');
  const delResp = await fetch(`${odataUrl}/FNCTRANS('T127774')`, {
    method: 'PATCH', headers: hdr,
    body: JSON.stringify({ DETAILS: 'TO-DELETE' })
  });
  console.log(`  PATCH T127774: ${delResp.status}`);
  const delResp2 = await fetch(`${odataUrl}/FNCTRANS('T127774')`, { method: 'DELETE', headers: { ...hdr } });
  console.log(`  DELETE T127774: ${delResp2.status}`);
})();
