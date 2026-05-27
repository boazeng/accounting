'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const priority = require('priority-web-sdk');

const odataUrl = (process.env.PRIORITY_URL_REAL || '').replace(/\/$/, '');
const m = odataUrl.match(/^(https?:\/\/[^/]+)\/odata\/Priority\/([^/]+)\/(.+)$/);
const [, base, tabulaini, company] = m;
const serviceUrl = base + '/wcf/service.svc';
const user = process.env.PRIORITY_USERNAME;
const pass = process.env.PRIORITY_PASSWORD;
const auth = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
const hdr = { Authorization: auth, Accept: 'application/json', 'OData-Version': '4.0', 'Content-Type': 'application/json' };

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout ' + ms)), ms))]);
}

async function fetchOdata(path) {
  const r = await fetch(odataUrl + path, { headers: { ...hdr, 'Content-Type': undefined } });
  const d = await r.json();
  return { status: r.status, data: d };
}

(async () => {
  console.log('=== Login ===');
  await priority.login({ username: user, password: pass, url: serviceUrl, tabulaini, language: 1, appname: 'TACT-Test3' });
  console.log('Login OK');

  // Step 1: Run MANBANKRECON with field 1 = '' (show ALL transactions, not just marked)
  console.log('\n=== MANBANKRECON with empty field 1 (show all) ===');
  let step = await withTimeout(priority.procStart('MANBANKRECON', 'P', null, company), 15000);
  console.log('Step type:', step?.type);
  if (step?.type === 'inputFields') {
    // Send empty value for field 1 (show all, not just marked)
    step = await withTimeout(step.proc.inputFields(1, {
      EditFields: [{ field: 1, value: '' }]  // empty = show all
    }), 15000);
    console.log('After inputFields(1, empty):', step?.type, step?.message || '');
    if (step?.proc?.message) {
      step = await withTimeout(step.proc.message(1), 10000);
      console.log('After message(1):', step?.type, step?.message || '');
    }
  }

  // Step 2: Now query BANKRECONSP via OData
  console.log('\n=== BANKRECONSP via OData (after MANBANKRECON) ===');
  const r1 = await fetchOdata('/BANKRECONSP?$top=5');
  console.log('Status:', r1.status);
  const items = r1.data?.value || [];
  console.log('Row count:', items.length);
  for (const item of items.slice(0, 3)) {
    console.log(JSON.stringify(item));
  }

  // Step 3: Also try formStart BANKRECONSP and getRows
  console.log('\n=== formStart BANKRECONSP getRows ===');
  try {
    const form = await withTimeout(priority.formStart('BANKRECONSP', null, null, company), 20000);
    const data = await withTimeout(form.getRows(1), 15000);
    console.log('Data keys:', Object.keys(data || {}));
    const bankreconsp = data?.BANKRECONSP;
    if (bankreconsp) {
      console.log('BANKRECONSP type:', typeof bankreconsp);
      console.log('BANKRECONSP keys:', Object.keys(bankreconsp));
      if (Array.isArray(bankreconsp)) {
        console.log('rows (array):', bankreconsp.length);
        for (const row of bankreconsp.slice(0, 2)) console.log(JSON.stringify(row));
      } else {
        console.log('BANKRECONSP value:', JSON.stringify(bankreconsp).slice(0, 500));
      }
    }
    await form.endCurrentForm(false).catch(() => {});
  } catch(e) {
    console.log('formStart error:', e.message);
  }

  // Step 4: Query BANKRECONSP with filter by our known FNCNUMs
  console.log('\n=== BANKRECONSP filter FRST_FNCNUM ===');
  const r2 = await fetchOdata("/BANKRECONSP?$filter=FRST_FNCNUM eq '26007535'&$top=5");
  console.log('Status:', r2.status, JSON.stringify(r2.data).slice(0, 300));

  console.log('\n=== BANKRECONSP filter SCND_BPNUMA ===');
  const r3 = await fetchOdata("/BANKRECONSP?$filter=SCND_BPNUMA eq 'BP16136-1'&$top=5");
  console.log('Status:', r3.status, JSON.stringify(r3.data).slice(0, 300));
})();
