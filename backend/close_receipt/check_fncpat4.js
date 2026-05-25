'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const odataUrl = (process.env.PRIORITY_URL_REAL || '').replace(/\/$/, '');
const user = process.env.PRIORITY_USERNAME;
const pass = process.env.PRIORITY_PASSWORD;
const auth = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
const hdr  = { Authorization: auth, Accept: 'application/json', 'OData-Version': '4.0' };
async function get(url) { const r = await fetch(url, { headers: hdr }); return r.json(); }

(async () => {
  // Look at FNCTRANS for branches used by bank recon, older entries
  const branches = ['110', '109', '111', '103', '102', '026'];
  for (const br of branches) {
    const d = await get(
      `${odataUrl}/FNCTRANS?$filter=BRANCHNAME eq '${br}' and FINAL eq 'Y'` +
      `&$top=5&$select=FNCNUM,FNCPATNAME,FNCPATDES2,DETAILS,FNCDATE` +
      `&$orderby=FNCDATE asc`
    );
    const entries = d.value || [];
    if (entries.length) {
      const unique = [...new Set(entries.map(e => `${e.FNCPATNAME}/${e.FNCPATDES2}`))];
      console.log(`Branch ${br}: patterns = ${unique.join(', ')}`);
      // Show oldest entries to see what manually-created ones look like
      entries.slice(0,2).forEach(e =>
        console.log(`  ${e.FNCNUM} PAT=${JSON.stringify(e.FNCPATNAME)} DES2=${JSON.stringify(e.FNCPATDES2)} DATE=${(e.FNCDATE||'').substring(0,10)} DETAILS=${JSON.stringify((e.DETAILS||'').substring(0,25))}`)
      );
    }
  }

  // Also: directly try to POST with FNCPATNAME='ה' to see what Priority returns
  console.log('\n=== Checking if FNCPATNAME=ה is accepted ===');
  const testResp = await fetch(`${odataUrl}/FNCTRANS`, {
    method: 'POST',
    headers: { ...hdr, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      FNCDATE: '2026-05-25', BALDATE: '2026-05-25',
      BRANCHNAME: '110', DETAILS: 'TEST-FNCPAT-CHECK',
      FNCPATNAME: 'ה',
      FNCITEMS_SUBFORM: [
        { ACCNAME: '4011-110', DEBIT1: 1, CREDIT1: 0 },
        { ACCNAME: '620-0-110', DEBIT1: 0, CREDIT1: 1 },
      ]
    })
  });
  const testData = await testResp.json();
  if (testResp.ok) {
    console.log(`Created with FNCPATNAME=ה: FNCNUM=${testData.FNCNUM} FNCPATNAME=${testData.FNCPATNAME} FNCPATDES2=${testData.FNCPATDES2}`);
    // Delete it
    const delResp = await fetch(`${odataUrl}/FNCTRANS('${testData.FNCNUM}')`, { method: 'DELETE', headers: hdr });
    console.log(`Deleted: ${delResp.status}`);
  } else {
    console.log(`FNCPATNAME=ה rejected: ${JSON.stringify(testData).substring(0,200)}`);
  }
})();
