'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const odataUrl = (process.env.PRIORITY_URL_REAL || '').replace(/\/$/, '');
const user = process.env.PRIORITY_USERNAME;
const pass = process.env.PRIORITY_PASSWORD;
const auth = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
const hdr = { Authorization: auth, Accept: 'application/json', 'OData-Version': '4.0', 'Content-Type': 'application/json' };

(async () => {
  const resp = await fetch(`${odataUrl}/FNCTRANS`, {
    method: 'POST', headers: hdr,
    body: JSON.stringify({
      FNCDATE: '2026-05-25', BALDATE: '2026-05-25',
      BRANCHNAME: '110', DETAILS: 'TEST-HATAAMA',
      FNCPATNAME: 'הת',
      FNCITEMS_SUBFORM: [
        { ACCNAME: '4011-110', DEBIT1: 1, CREDIT1: 0 },
        { ACCNAME: '620-0-110', DEBIT1: 0, CREDIT1: 1 },
      ]
    })
  });
  const data = await resp.json();
  if (resp.ok) {
    console.log(`✓ Created: FNCNUM=${data.FNCNUM} FNCPATNAME=${data.FNCPATNAME} FNCPATDES2=${data.FNCPATDES2}`);
    // Clean up
    const del = await fetch(`${odataUrl}/FNCTRANS('${data.FNCNUM}')`, { method: 'DELETE', headers: hdr });
    console.log(`✓ Deleted: ${del.status}`);
  } else {
    const err = data?.FORM?.InterfaceErrors?.text || JSON.stringify(data).substring(0, 200);
    console.log(`✗ Rejected: ${err}`);
  }
})();
