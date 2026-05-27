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

(async () => {
  // 1. Check FNCTRANS fields for RECON / bank reconciliation related fields
  console.log('=== FNCTRANS fields for journal 26007535 ===');
  const r1 = await fetch(`${odataUrl}/FNCTRANS('26007535')`, { headers: { ...hdr, 'Content-Type': undefined } });
  const d1 = await r1.json();
  console.log('Status:', r1.status);
  if (r1.ok) {
    const relevant = Object.entries(d1).filter(([k]) =>
      k.match(/RECON|BANK|MATCH|BLINE|FNCREC|FNCREF|LINK|PAIR/i)
    );
    console.log('Relevant fields:', relevant);
    console.log('All fields:', Object.keys(d1).join(', '));
  } else {
    console.log(JSON.stringify(d1).slice(0, 300));
  }

  // 2. Check BANKRECONSP OData — filter by FNCNUM
  console.log('\n=== BANKRECONSP filter by FNCNUM ===');
  const r2 = await fetch(`${odataUrl}/BANKRECONSP?$filter=FNCNUM eq '26007535'`, { headers: { ...hdr, 'Content-Type': undefined } });
  console.log('Status:', r2.status, r2.statusText);
  const d2 = await r2.text();
  console.log(d2.slice(0, 400));

  // 3. Check BANKRECONSP OData — filter by BLINE (bank line)
  console.log('\n=== BANKRECONSP filter by BLINE ===');
  const r3 = await fetch(`${odataUrl}/BANKRECONSP?$filter=BLINE eq 'BP16136-1'`, { headers: { ...hdr, 'Content-Type': undefined } });
  console.log('Status:', r3.status);
  const d3 = await r3.text();
  console.log(d3.slice(0, 400));

  // 4. Login to WCF and explore BANKRECONSP as PROCEDURE
  console.log('\n=== WCF: procStart BANKRECONSP ===');
  await priority.login({ username: user, password: pass, url: serviceUrl, tabulaini, language: 1, appname: 'TACT-Test2' });
  console.log('Login OK');

  try {
    const step = await withTimeout(priority.procStart('BANKRECONSP', 'P', null, company), 15000);
    console.log('Step type:', step?.type);
    console.log('Step data:', JSON.stringify(step, (k,v) => k === 'proc' ? '[proc]' : v, 2).slice(0, 800));
    if (step?.type === 'inputOptions' && step?.proc?.inputOptions) {
      // Try selecting option B (bank reconciliation)
      const step2 = await withTimeout(step.proc.inputOptions(1, {}), 15000);
      console.log('\nAfter inputOptions(1):');
      console.log('Step2 type:', step2?.type, 'msg:', step2?.message || '');
      console.log('Step2:', JSON.stringify(step2, (k,v) => k === 'proc' ? '[proc]' : v, 2).slice(0, 500));
      if (step2?.proc?.cancel) await step2.proc.cancel().catch(() => {});
    }
    if (step?.proc?.cancel) await step.proc.cancel().catch(() => {});
  } catch(e) {
    console.log('procStart BANKRECONSP error:', e.message);
  }

  // 5. Try formStart with cashname filter
  console.log('\n=== formStart BANKRECONSP with searchAction ===');
  try {
    const form = await withTimeout(priority.formStart('BANKRECONSP', null, null, company), 15000);
    // Try searchAction to filter by cashname
    try {
      await form.searchAction('CASHNAME', 'eq', '103-200');
      const data = await withTimeout(form.getRows(1), 10000);
      console.log('After searchAction CASHNAME=103-200, rows:', (data?.BANKRECONSP?.recordset || data?.rows || []).length);
      console.log('Data keys:', Object.keys(data || {}));
      console.log('BANKRECONSP value:', JSON.stringify(data?.BANKRECONSP || {}).slice(0, 300));
    } catch(se) {
      console.log('searchAction error:', se.message);
      const data2 = await withTimeout(form.getRows(1), 10000);
      console.log('Without filter data:', JSON.stringify(data2).slice(0, 300));
    }
    await form.endCurrentForm(false).catch(() => {});
  } catch(e) {
    console.log('formStart error:', e.message);
  }
})();
