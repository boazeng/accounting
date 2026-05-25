'use strict';
/**
 * Test calling BANKRECONSP as a procedure via Priority Web SDK.
 * Similar to CLOSETIV (receipts) and CLOSEANFNCTRANS (journals).
 *
 * Usage: node test_bankreconsp_proc.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const priority = require('priority-web-sdk');

function parseOdataUrl(odataUrl) {
  const url = (odataUrl || '').replace(/\/$/, '');
  const match = url.match(/^(https?:\/\/[^\/]+)\/odata\/Priority\/([^\/]+)\/(.+)$/);
  if (!match) throw new Error('Cannot parse Priority URL: ' + url);
  const [, base, tabulaini, company] = match;
  return { serviceUrl: base + '/wcf/service.svc', tabulaini, company };
}

function withTimeout(promise, ms, label) {
  const t = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, t]);
}

async function handleStep(step, depth) {
  if (!step || depth > 10) return;
  const type = step.type;
  process.stderr.write(`  step[${depth}] type=${type} msg=${step.message || ''}\n`);

  if (type === 'inputFields') {
    process.stderr.write(`  inputFields: ${JSON.stringify(step.inputFields || []).slice(0, 200)}\n`);
    // Don't fill anything — just see what fields are requested
    return { type, step };
  }
  if (type === 'message') {
    process.stderr.write(`  message: ${step.message}\n`);
    return { type, message: step.message };
  }
  if (type === 'end' || type === 'finished') {
    process.stderr.write('  finished\n');
    return;
  }
  if (step.proc && step.proc.continueProc) {
    const next = await withTimeout(step.proc.continueProc(), 15000, 'continueProc');
    return handleStep(next, depth + 1);
  }
  return { type, step };
}

async function main() {
  const odataUrl = process.env.PRIORITY_URL_REAL || process.env.PRIORITY_URL || '';
  const { serviceUrl, tabulaini, company } = parseOdataUrl(odataUrl);
  const user = process.env.PRIORITY_USERNAME;
  const pass = process.env.PRIORITY_PASSWORD;

  process.stderr.write(`Login -> ${serviceUrl} (${company})\n`);
  await priority.login({
    username: user, password: pass,
    url: serviceUrl, tabulaini,
    language: 1, appname: 'TACT-BankRecon',
  });
  process.stderr.write('Login OK\n');

  // Try as procedure (P)
  process.stderr.write('\n--- procStart BANKRECONSP (P) ---\n');
  try {
    const step = await withTimeout(
      priority.procStart('BANKRECONSP', 'P', null, company),
      20000, 'procStart BANKRECONSP'
    );
    const result = await handleStep(step, 0);
    process.stderr.write('procStart result: ' + JSON.stringify(result) + '\n');
  } catch (e) {
    process.stderr.write('procStart BANKRECONSP error: ' + e.message + '\n');
  }

  // Try as form (via formStart) just to see what fields are available
  process.stderr.write('\n--- formStart BANKRECONSP ---\n');
  try {
    const form = await withTimeout(
      priority.formStart('BANKRECONSP', null, null, company),
      20000, 'formStart BANKRECONSP'
    );
    process.stderr.write('formStart result type: ' + typeof form + '\n');
    if (form && form.fields) {
      process.stderr.write('Fields: ' + JSON.stringify(Object.keys(form.fields)).slice(0, 500) + '\n');
    }
    process.stdout.write(JSON.stringify({ ok: true, formType: typeof form }));
  } catch (e) {
    process.stderr.write('formStart BANKRECONSP error: ' + e.message + '\n');
    process.stdout.write(JSON.stringify({ ok: false, error: e.message }));
  }
}

main().catch(err => {
  process.stderr.write('ERROR: ' + err.message + '\n');
  process.stdout.write(JSON.stringify({ ok: false, error: err.message }));
  process.exit(1);
});
