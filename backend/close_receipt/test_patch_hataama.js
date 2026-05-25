'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const odataUrl = (process.env.PRIORITY_URL_REAL || '').replace(/\/$/, '');
const user = process.env.PRIORITY_USERNAME;
const pass = process.env.PRIORITY_PASSWORD;
const auth = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
const hdr = { Authorization: auth, Accept: 'application/json', 'OData-Version': '4.0', 'Content-Type': 'application/json' };

(async () => {
  // Step 1: Create a regular draft "פ" entry
  console.log('1. Creating פ draft entry...');
  const createResp = await fetch(`${odataUrl}/FNCTRANS`, {
    method: 'POST', headers: hdr,
    body: JSON.stringify({
      FNCDATE: '2026-05-25', BALDATE: '2026-05-25',
      BRANCHNAME: '110', DETAILS: 'TEST-PATCH-HATAAMA',
      FNCITEMS_SUBFORM: [
        { ACCNAME: '4011-110', DEBIT1: 1, CREDIT1: 0 },
        { ACCNAME: '620-0-110', DEBIT1: 0, CREDIT1: 1 },
      ]
    })
  });
  const created = await createResp.json();
  if (!createResp.ok) {
    const err = created?.FORM?.InterfaceErrors?.text || JSON.stringify(created).substring(0,200);
    console.log('  Create failed:', err); return;
  }
  const fncnum = created.FNCNUM;
  console.log(`  Created: FNCNUM=${fncnum} FNCPATNAME=${created.FNCPATNAME}`);

  // Step 2: Try PATCH to change FNCPATNAME to הת and add FNCREF
  console.log('2. Patching to הת + FNCREF...');
  const patchResp = await fetch(`${odataUrl}/FNCTRANS('${fncnum}')`, {
    method: 'PATCH', headers: hdr,
    body: JSON.stringify({ FNCPATNAME: 'הת', FNCREF: '99999' })
  });
  const patchData = patchResp.status === 204 ? {} : await patchResp.json().catch(() => ({}));
  console.log(`  PATCH status: ${patchResp.status}`);
  if (!patchResp.ok) {
    const err = patchData?.FORM?.InterfaceErrors?.text || patchData?.error?.message || JSON.stringify(patchData).substring(0,200);
    console.log('  PATCH failed:', err);
  } else {
    // Re-fetch to see result
    const refetchResp = await fetch(`${odataUrl}/FNCTRANS('${fncnum}')?$select=FNCNUM,FNCPATNAME,FNCPATDES2,FNCREF`, { headers: { ...hdr } });
    const refetched = await refetchResp.json();
    console.log(`  After patch: FNCPATNAME=${refetched.FNCPATNAME} FNCPATDES2=${refetched.FNCPATDES2} FNCREF=${refetched.FNCREF}`);
  }

  // Step 3: Clean up
  console.log('3. Deleting test entry...');
  const delResp = await fetch(`${odataUrl}/FNCTRANS('${fncnum}')`, { method: 'DELETE', headers: hdr });
  console.log(`  Delete: ${delResp.status}`);
})();
