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
async function oget(path) {
  const r = await fetch(odataUrl + path, { headers: { ...hdr, 'Content-Type': undefined } });
  return { status: r.status, data: await r.json() };
}

(async () => {
  // 1. Verify IVRECONDATE was set on 26007535
  console.log('=== Verify IVRECONDATE on 26007535 ===');
  const r1 = await oget("/FNCTRANS('26007535')?$select=FNCNUM,DETAILS,IVRECONDATE,FINAL");
  console.log(JSON.stringify(r1.data));

  // 2. Try formStart BANKRECONSP with dname = cashname
  console.log('\n=== Login to WCF ===');
  await priority.login({ username: user, password: pass, url: serviceUrl, tabulaini, language: 1, appname: 'TACT-Recon' });
  console.log('Login OK');

  for (const dname of ['103-200', '103', '', null]) {
    console.log(`\n=== formStart BANKRECONSP dname=${JSON.stringify(dname)} ===`);
    try {
      const form = await withTimeout(priority.formStart('BANKRECONSP', null, null, company, dname), 20000);
      const data = await withTimeout(form.getRows(1), 15000);
      const rows = data?.BANKRECONSP;
      const arr = Array.isArray(rows) ? rows : (rows?.value || rows?.rows || []);
      console.log('Row count:', arr.length, 'Raw type:', typeof rows);
      if (arr.length > 0) {
        console.log('First row:', JSON.stringify(arr[0]));
      } else if (rows) {
        console.log('Raw BANKRECONSP value:', JSON.stringify(rows).slice(0, 200));
      }
      await form.endCurrentForm(false).catch(() => {});
      if (arr.length > 0) break;
    } catch(e) {
      console.log('Error:', e.message);
    }
  }

  // 3. Try CREDITRECONSP as top-level procedure
  console.log('\n=== procStart CREDITRECONSP ===');
  try {
    const step = await withTimeout(priority.procStart('CREDITRECONSP', 'P', null, company), 15000);
    console.log('Step type:', step?.type, 'msg:', step?.message || '');
    console.log('Step data:', JSON.stringify(step, (k,v) => k === 'proc' ? '[proc]' : v, 2).slice(0, 500));
    if (step?.proc?.cancel) await step.proc.cancel().catch(() => {});
  } catch(e) {
    console.log('Error:', e.message);
  }
})();
