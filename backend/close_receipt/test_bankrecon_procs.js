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

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);
}

async function exploreProc(name) {
  console.log(`\n=== ${name} ===`);
  try {
    const step = await withTimeout(priority.procStart(name, 'P', null, company), 15000);
    if (!step) { console.log('  No step returned'); return; }
    console.log(`  Step type: ${step.type}`);
    console.log(`  Message: ${step.message || ''}`);
    if (step.type === 'inputFields' && step.input) {
      console.log('  Input fields:', JSON.stringify(step.input, null, 2));
    }
    if (step.type === 'choose' && step.choose) {
      console.log('  Choose options:', JSON.stringify(step.choose?.slice(0,5), null, 2));
    }
    if (step.type === 'inputOptions') {
      console.log('  Full step keys:', Object.keys(step));
      console.log('  Step data:', JSON.stringify(step, (k, v) => k === 'proc' ? '[proc]' : v, 2));
      // Proceed with option B (bank reconciliation)
      console.log('  -> Selecting option B (field 1)...');
      const step2 = await withTimeout(step.proc.inputOptions(1), 15000);
      console.log(`  Step2 type: ${step2?.type}`);
      console.log('  Step2 data:', JSON.stringify(step2, (k, v) => k === 'proc' ? '[proc]' : v, 2).substring(0, 500));
    }
    // Cancel the procedure
    if (step.proc && step.proc.cancel) {
      await withTimeout(step.proc.cancel(), 5000).catch(() => {});
    } else if (step.proc && step.proc.message) {
      await withTimeout(step.proc.message(2), 5000).catch(() => {});
    }
  } catch(e) {
    console.log(`  ERROR: ${e.message}`);
  }
}

(async () => {
  console.log(`Login -> ${serviceUrl} (${company})`);
  await priority.login({ username: user, password: pass, url: serviceUrl, tabulaini, language: 1, appname: 'TACT' });
  console.log('Login OK');

  await exploreProc('BANKRECONSP');
  await exploreProc('CLOSEBANKRECONISP');
  await exploreProc('CREDITRECONSP');
})();
