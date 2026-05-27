'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const priority = require('priority-web-sdk');

const odataUrl = (process.env.PRIORITY_URL_REAL || '').replace(/\/$/, '');
const m = odataUrl.match(/^(https?:\/\/[^/]+)\/odata\/Priority\/([^/]+)\/(.+)$/);
const [, base, tabulaini, company] = m;
const serviceUrl = base + '/wcf/service.svc';

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout ' + ms)), ms))]);
}

(async () => {
  await priority.login({
    username: process.env.PRIORITY_USERNAME, password: process.env.PRIORITY_PASSWORD,
    url: serviceUrl, tabulaini, language: 1, appname: 'TACT-Test'
  });
  console.log('Login OK');

  // Explore MANBANKRECON input fields
  console.log('\n=== MANBANKRECON inputFields ===');
  const step = await withTimeout(priority.procStart('MANBANKRECON', 'P', null, company), 15000);
  console.log('Step type:', step?.type);
  if (step?.type === 'inputFields') {
    console.log('Input fields:', JSON.stringify(step.input || step, (k,v) => k === 'proc' ? '[proc]' : v, 2));
    // Try with "103-200" first
    console.log('\nSending field 1 = "103-200"...');
    const step2 = await withTimeout(step.proc.inputFields(1, {
      EditFields: [{ field: 1, value: '103-200' }]
    }), 15000);
    console.log('Step2 type:', step2?.type, 'msg:', step2?.message || '');
    if (step2?.proc?.cancel) await step2.proc.cancel().catch(() => {});
    else if (step2?.proc?.message) await step2.proc.message(2).catch(() => {});
  } else {
    console.log('Full step:', JSON.stringify(step, (k,v) => k === 'proc' ? '[proc]' : v, 2).slice(0, 500));
    if (step?.proc?.cancel) await step.proc.cancel().catch(() => {});
  }

  // Also explore BANKRECONSP form structure
  console.log('\n=== formStart BANKRECONSP — getRows structure ===');
  try {
    const form = await withTimeout(priority.formStart('BANKRECONSP', null, null, company), 15000);
    const data = await withTimeout(form.getRows(1), 10000);
    console.log('getRows result keys:', Object.keys(data || {}));
    console.log('rows:', (data?.rows || data?.Rows || []).length);
    console.log('full data sample:', JSON.stringify(data, null, 2).slice(0, 800));
    await form.endCurrentForm(false).catch(() => {});
  } catch(e) {
    console.log('formStart error:', e.message);
  }
})();
