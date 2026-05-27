'use strict';
/**
 * Mark a bank line + journal entry as temporary reconciliation in BANKRECONSP.
 *
 * Flow:
 *   1. Run MANBANKRECON (refresh reconciliation temp table for the bank account)
 *   2. Open BANKRECONSP form and find rows matching:
 *        - bankFncnum  (the original bank transaction, e.g. "BP16089-2")
 *        - journalFncnum (the Priority journal entry, e.g. "T127800")
 *   3. Set RECON='Y' on both rows so they appear as a pending pair.
 *      The user then opens BANKRECONSP in Priority and presses CLOSECREDITRECONSP
 *      to finalise the reconciliation.
 *   Fallback: if form-based marking fails, run CREDITRECONSP auto-match.
 *
 * Usage: node bank_recon.js <journalFncnum> <cashname> [bankFncnum]
 *   e.g. node bank_recon.js T127800 103-200 BP16110-2
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
      inputData = null;
    } else if (t === 'inputOptions') {
      step = await withTimeout(step.proc.inputOptions(1, {}), 30000, `${name}.inputOptions`);
    } else if (t === 'message') {
      const msg = step.message || '';
      if (msg.includes('ריק') || msg.includes('empty')) {
        process.stderr.write(`  Empty result for ${name} — no matches\n`);
        return { ok: true, empty: true };
      }
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

async function runActivationOnForm(formName, activationName, company) {
  process.stderr.write(`formStart ${formName} for activation ${activationName}...\n`);
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
      if (step.proc && step.proc.message) {
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

/**
 * Open BANKRECONSP form, find rows for bankFncnum and journalFncnum,
 * mark RECON='Y' on each, and save. Returns number of rows marked.
 */
async function markReconRows(bankFncnum, journalFncnum, company) {
  process.stderr.write(`formStart BANKRECONSP for RECON marking...\n`);
  const form = await withTimeout(
    priority.formStart('BANKRECONSP', null, null, company),
    30000, 'formStart BANKRECONSP'
  );

  // Read first page of rows
  process.stderr.write(`getRows...\n`);
  const data = await withTimeout(form.getRows(1), 20000, 'getRows');

  const rows = (data && (data.rows || data.Rows)) ? (data.rows || data.Rows) : [];
  process.stderr.write(`Got ${rows.length} rows\n`);

  const targets = new Set([bankFncnum, journalFncnum].filter(Boolean));
  let marked = 0;

  for (const row of rows) {
    const fncnum = row.FNCNUM || row.fncnum || '';
    if (!targets.has(fncnum)) continue;

    const rowNum = row.row || row.Row || row.rownum;
    process.stderr.write(`  Marking RECON for row ${rowNum} FNCNUM=${fncnum}\n`);

    try {
      await withTimeout(form.setActiveRow(rowNum), 10000, `setActiveRow ${rowNum}`);
      await withTimeout(form.fieldUpdate('RECON', 'Y'), 10000, `fieldUpdate RECON row ${rowNum}`);
      await withTimeout(form.saveRow(false), 10000, `saveRow ${rowNum}`);
      marked++;
    } catch (e) {
      process.stderr.write(`  Warning: failed to mark row ${rowNum}: ${e.message}\n`);
    }
  }

  // Close the form cleanly
  try {
    await withTimeout(form.endCurrentForm(false), 5000, 'endCurrentForm').catch(() => {});
  } catch (_) {}

  return marked;
}

async function main() {
  const journalFncnum = process.argv[2];
  const cashname      = process.argv[3];
  const bankFncnum    = process.argv[4] || '';

  if (!journalFncnum || !cashname) {
    throw new Error('Usage: node bank_recon.js <journalFncnum> <cashname> [bankFncnum]');
  }

  const odataUrl = process.env.PRIORITY_URL_REAL || process.env.PRIORITY_URL || '';
  const { serviceUrl, tabulaini, company } = parseOdataUrl(odataUrl);

  process.stderr.write(`Login -> ${serviceUrl} (${company})\n`);
  await priority.login({
    username: process.env.PRIORITY_USERNAME,
    password: process.env.PRIORITY_PASSWORD,
    url: serviceUrl, tabulaini,
    language: 1, appname: 'TACT-BankRecon',
  });
  process.stderr.write('Login OK\n');

  // Step 1: MANBANKRECON — refresh reconciliation data for this bank account
  const prepResult = await runProc('MANBANKRECON', {
    EditFields: [{ field: 1, value: cashname }]
  }, company);
  process.stderr.write(`MANBANKRECON result: ${JSON.stringify(prepResult)}\n`);

  if (!prepResult.ok) {
    throw new Error('MANBANKRECON failed: ' + (prepResult.error || 'unknown'));
  }

  // Step 2: Mark RECON on the specific bank line + journal entry rows
  let marked = 0;
  let usedFallback = false;

  if (bankFncnum || journalFncnum) {
    try {
      marked = await markReconRows(bankFncnum, journalFncnum, company);
      process.stderr.write(`Marked ${marked} rows with RECON=Y\n`);
    } catch (e) {
      process.stderr.write(`Form-based RECON marking failed (${e.message}), falling back to CREDITRECONSP\n`);
      usedFallback = true;
    }
  }

  // Fallback: if form marking didn't work, run CREDITRECONSP auto-match
  if (usedFallback || marked === 0) {
    process.stderr.write('Running CREDITRECONSP auto-match as fallback...\n');
    const reconResult = await runActivationOnForm('BANKRECONSP', 'CREDITRECONSP', company);
    process.stderr.write(`CREDITRECONSP result: ${JSON.stringify(reconResult)}\n`);
  }

  process.stdout.write(JSON.stringify({ ok: true, journalFncnum, bankFncnum, cashname, markedRows: marked }));
}

main().catch(err => {
  process.stderr.write('ERROR: ' + (err.message || String(err)) + '\n');
  process.stdout.write(JSON.stringify({ ok: false, error: err.message || String(err) }));
  process.exit(1);
});
