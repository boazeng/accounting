'use strict';
/**
 * Mark a journal entry + bank line as temporary bank reconciliation (BANKRECONSP).
 *
 * Flow:
 *   1. Run MANBANKRECON (preparation) for the bank account (CASHNAME)
 *   2. Run CREDITRECONSP.P (auto-reconcile) — Priority matches pairs automatically
 *
 * Usage: node bank_recon.js <FNCNUM> <CASHNAME>
 *   e.g. node bank_recon.js T127800 103-200
 *
 * Output: JSON to stdout — { ok: true } or { ok: false, error }
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const priority = require('priority-web-sdk');

function parseOdataUrl(odataUrl) {
  const url = (odataUrl || '').replace(/\/$/, '');
  const match = url.match(/^(https?:\/\/[^\/]+)\/odata\/Priority\/([^\/]+)\/(.+)$/);
  if (!match) throw new Error('Cannot parse Priority URL: ' + url);
  const [, base, tabulaini, company] = match;
  return { odataBase: url, serviceUrl: base + '/wcf/service.svc', tabulaini, company };
}

function withTimeout(promise, ms, label) {
  const t = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, t]);
}

async function runProc(name, inputData, company) {
  process.stderr.write(`procStart ${name}...\n`);
  const step0 = await withTimeout(priority.procStart(name, 'P', null, company), 30000, `procStart ${name}`);
  let step = step0;
  let depth = 0;

  while (step && depth < 10) {
    const t = step.type;
    process.stderr.write(`  [${depth}] type=${t} msg=${step.message || ''}\n`);

    if (t === 'inputFields') {
      const data = inputData || { EditFields: [] };
      step = await withTimeout(step.proc.inputFields(1, data), 30000, `${name}.inputFields`);
      inputData = null; // only send once
    } else if (t === 'inputOptions') {
      step = await withTimeout(step.proc.inputOptions(1, {}), 30000, `${name}.inputOptions`);
    } else if (t === 'message') {
      const msg = step.message || '';
      // "דוח ריק" = empty report = no matches found, that's OK
      if (msg.includes('ריק') || msg.includes('empty')) {
        process.stderr.write(`  Empty result for ${name} — no matches\n`);
        return { ok: true, empty: true };
      }
      // "להמשיך בפעולה?" = confirm dialog
      if (step.proc && step.proc.message) {
        step = await withTimeout(step.proc.message(1), 30000, `${name}.message`);
      } else {
        return { ok: true, message: msg };
      }
    } else if (t === 'end' || t === 'finished') {
      return { ok: true };
    } else if (step.proc && step.proc.continueProc) {
      step = await withTimeout(step.proc.continueProc(), 30000, `${name}.continueProc`);
    } else {
      return { ok: true, unknown_step: t };
    }
    depth++;
  }
  return { ok: true };
}

async function activateOnForm(formName, activationName, company) {
  process.stderr.write(`formStart ${formName}...\n`);
  const form = await withTimeout(priority.formStart(formName, null, null, company), 30000, `formStart ${formName}`);

  process.stderr.write(`activateStart ${activationName}...\n`);
  const step0 = await withTimeout(form.activateStart(activationName), 30000, `activateStart ${activationName}`);
  let step = step0;
  let depth = 0;

  while (step && depth < 10) {
    const t = step.type;
    process.stderr.write(`  [${depth}] type=${t} msg=${step.message || ''}\n`);

    if (t === 'message') {
      const msg = step.message || '';
      if (msg.includes('ריק') || msg.includes('שורות')) {
        process.stderr.write(`  Message (continuing): ${msg}\n`);
        if (step.proc && step.proc.message) {
          step = await withTimeout(step.proc.message(1), 30000, 'activation.message');
        } else return { ok: true, message: msg };
      } else if (step.proc && step.proc.message) {
        step = await withTimeout(step.proc.message(1), 30000, 'activation.message');
      } else {
        return { ok: true, message: msg };
      }
    } else if (t === 'end' || t === 'finished') {
      return { ok: true };
    } else if (step.proc && step.proc.continueProc) {
      step = await withTimeout(step.proc.continueProc(), 30000, 'activation.continueProc');
    } else {
      return { ok: true, unknown: t };
    }
    depth++;
  }
  return { ok: true };
}

async function main() {
  const fncnum   = process.argv[2];
  const cashname = process.argv[3];
  if (!fncnum || !cashname) {
    throw new Error('Usage: node bank_recon.js <FNCNUM> <CASHNAME>');
  }

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

  // Step 1: MANBANKRECON — prepare reconciliation data for this bank account
  const prepResult = await runProc('MANBANKRECON', {
    EditFields: [{ field: 1, value: cashname }]
  }, company);
  process.stderr.write(`MANBANKRECON result: ${JSON.stringify(prepResult)}\n`);

  if (!prepResult.ok) {
    throw new Error('MANBANKRECON failed: ' + (prepResult.error || 'unknown'));
  }

  // Step 2: CREDITRECONSP.P — automatic reconciliation (matches journal ↔ bank line)
  const reconResult = await runProc('CREDITRECONSP', null, company);
  process.stderr.write(`CREDITRECONSP result: ${JSON.stringify(reconResult)}\n`);

  if (!reconResult.ok && !reconResult.empty) {
    throw new Error('CREDITRECONSP failed: ' + (reconResult.error || 'unknown'));
  }

  process.stdout.write(JSON.stringify({ ok: true, fncnum, cashname }));
}

main().catch(err => {
  process.stderr.write('ERROR: ' + (err.message || String(err)) + '\n');
  process.stdout.write(JSON.stringify({ ok: false, error: err.message || String(err) }));
  process.exit(1);
});
