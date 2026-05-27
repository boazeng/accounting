'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const priority = require('priority-web-sdk');

const odataUrl = (process.env.PRIORITY_URL_REAL || '').replace(/\/$/, '');
const match = odataUrl.match(/^(https?:\/\/[^/]+)\/odata\/Priority\/([^/]+)\/(.+)$/);
const [, base, tabulaini, company] = match;
const serviceUrl = base + '/wcf/service.svc';
const user = process.env.PRIORITY_USERNAME;
const pass = process.env.PRIORITY_PASSWORD;
const auth = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
const hdr = { Authorization: auth, Accept: 'application/json', 'OData-Version': '4.0', 'Content-Type': 'application/json' };

async function tryProc(name) {
  try {
    const step = await Promise.race([
      priority.procStart(name, 'P', null, company),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
    ]);
    const type = step ? step.type : 'null';
    const msg = step ? (step.message || '') : '';
    process.stdout.write(`  ${name}: step=${type} msg=${msg.substring(0,60)}\n`);
    // Cancel if needed
    if (step && step.proc && step.proc.cancel) await step.proc.cancel().catch(() => {});
    return type;
  } catch(e) {
    process.stdout.write(`  ${name}: ERROR ${e.message.substring(0,80)}\n`);
    return 'error';
  }
}

(async () => {
  // 1. Test FNCREF on a פ entry
  console.log('=== Test FNCREF on פ entry ===');
  const createResp = await fetch(`${odataUrl}/FNCTRANS`, {
    method: 'POST', headers: hdr,
    body: JSON.stringify({
      FNCDATE: '2026-05-25', BALDATE: '2026-05-25',
      BRANCHNAME: '110', DETAILS: 'TEST-FNCREF',
      FNCREF: '12345',
      FNCITEMS_SUBFORM: [
        { ACCNAME: '4011-110', DEBIT1: 1, CREDIT1: 0 },
        { ACCNAME: '620-0-110', DEBIT1: 0, CREDIT1: 1 },
      ]
    })
  });
  const created = await createResp.json();
  if (createResp.ok) {
    console.log(`  Created FNCNUM=${created.FNCNUM} FNCPATNAME=${created.FNCPATNAME} FNCREF=${created.FNCREF}`);
    // Delete
    await fetch(`${odataUrl}/FNCTRANS('${created.FNCNUM}')`, { method: 'DELETE', headers: hdr });
  } else {
    const err = created?.FORM?.InterfaceErrors?.text || JSON.stringify(created).substring(0,200);
    console.log('  Failed:', err);
  }

  // 2. Login to WCF and try bank reconciliation procedures
  console.log('\n=== Login to WCF ===');
  await priority.login({ username: user, password: pass, url: serviceUrl, tabulaini, language: 1, appname: 'TACT' });
  console.log('  Login OK');

  const procNames = [
    'BANKRECMATCH', 'BNKRECMATCH', 'MATCHBNK', 'GIYULBNK',
    'CREATEHATAAMA', 'BANKMATCH', 'BNKSTMNTMATCH', 'TMPBNKREC',
    'TMPBNKMATCH', 'AUTOBANKRN', 'BANKAUTOMATCH', 'BANKRECTMP'
  ];
  console.log('\n=== Testing WCF procedures ===');
  for (const name of procNames) {
    const result = await tryProc(name);
    if (result !== 'error') console.log(`  *** ${name} EXISTS with step type: ${result} ***`);
  }
})();
