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

function withTimeout(p, ms, label) {
  return Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(`timeout ${label} ${ms}ms`)), ms))]);
}

(async () => {
  await priority.login({ username: user, password: pass, url: serviceUrl, tabulaini, language: 1, appname: 'TACT-Recon2' });
  console.log('Login OK');

  console.log('\n=== Run CREDITRECONSP option B (bank matching) ===');
  let step = await withTimeout(priority.procStart('CREDITRECONSP', 'P', null, company), 15000, 'procStart');
  console.log('Step 0:', step?.type, step?.message || '');

  // Select option B = field 1 (basic bank matching)
  if (step?.type === 'inputOptions') {
    console.log('Selecting option B (field 1)...');
    step = await withTimeout(step.proc.inputOptions(1, {}), 30000, 'inputOptions');
    console.log('Step 1:', step?.type, step?.message?.slice(0, 100) || '');

    let d = 0;
    while (step && d < 15) {
      const t = step.type;
      console.log(`  [${d}] type=${t} msg=${(step.message || '').slice(0, 80)}`);
      if (t === 'message') {
        if (step.proc?.message) {
          step = await withTimeout(step.proc.message(1), 30000, `message ${d}`);
        } else {
          break;
        }
      } else if (t === 'end' || t === 'finished') {
        console.log('  CREDITRECONSP completed!');
        break;
      } else if (step.proc?.continueProc) {
        step = await withTimeout(step.proc.continueProc(), 60000, `continueProc ${d}`);
      } else if (step.proc?.inputFields) {
        console.log('  inputFields:', JSON.stringify(step.input, null, 2).slice(0, 300));
        step = await withTimeout(step.proc.inputFields(1, { EditFields: [] }), 30000, `inputFields ${d}`);
      } else {
        console.log('  Unknown step, breaking');
        break;
      }
      d++;
    }
  }

  // Verify result — check IVRECONDATE on our journal entry
  const auth = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
  const hdr = { Authorization: auth, Accept: 'application/json', 'OData-Version': '4.0' };
  const r = await fetch(`${odataUrl}/FNCTRANS('26007535')?$select=FNCNUM,DETAILS,IVRECONDATE`, { headers: hdr });
  const d = await r.json();
  console.log('\n=== FNCTRANS 26007535 after CREDITRECONSP ===');
  console.log(JSON.stringify(d));
})();
