'use strict';
/**
 * Reconcile a bank transaction + journal entry in Priority BANKRECONSP.
 *
 * Flow:
 *   1. MANBANKRECON — refresh the reconciliation temp-table for the bank account.
 *   2. In the BANKRECONSP form, find the rows for bankFncnum and journalFncnum
 *      (scanning up to MAX_PAGES pages).
 *   3. Set RECON = same positive integer on both rows and save.
 *   4. Run CLOSECREDITRECONSP activation to permanently commit the pair.
 *   Fallback: if form marking fails, run CREDITRECONSP auto-match.
 *
 * Usage: node bank_recon.js <journalFncnum> <cashname> [bankFncnum]
 * Output: JSON to stdout — { ok, journalFncnum, bankFncnum, cashname, markedRows }
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const priority = require('priority-web-sdk');

const MAX_PAGES = 8;   // scan up to 8 pages of BANKRECONSP rows
const PAGE_SIZE = 50;  // rows per page (Priority default)

function parseOdataUrl(odataUrl) {
  const url = (odataUrl || '').replace(/\/$/, '');
  const m = url.match(/^(https?:\/\/[^\/]+)\/odata\/Priority\/([^\/]+)\/(.+)$/);
  if (!m) throw new Error('Cannot parse Priority URL: ' + url);
  const [, base, tabulaini, company] = m;
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
  let step = await withTimeout(priority.procStart(name, 'P', null, company), 30000, `procStart ${name}`);
  let depth = 0;
  while (step && depth < 12) {
    const t = step.type;
    process.stderr.write(`  [${depth}] type=${t} msg=${(step.message || '').slice(0, 80)}\n`);
    if (t === 'inputFields') {
      step = await withTimeout(step.proc.inputFields(1, inputData || { EditFields: [] }), 30000, `${name}.inputFields`);
      inputData = null;
    } else if (t === 'inputOptions') {
      step = await withTimeout(step.proc.inputOptions(1, {}), 30000, `${name}.inputOptions`);
    } else if (t === 'message') {
      const msg = step.message || '';
      if (msg.includes('ריק') || msg.includes('empty')) return { ok: true, empty: true };
      step = step.proc?.message
        ? await withTimeout(step.proc.message(1), 30000, `${name}.message`)
        : null;
    } else if (t === 'end' || t === 'finished') {
      return { ok: true };
    } else if (step.proc?.continueProc) {
      step = await withTimeout(step.proc.continueProc(), 30000, `${name}.continueProc`);
    } else {
      break;
    }
    depth++;
  }
  return { ok: true };
}

/**
 * Open BANKRECONSP, scan all rows (multiple pages), mark the two target FNCNUMs
 * with the same reconNum, save each row, then run CLOSECREDITRECONSP.
 */
async function markAndClose(bankFncnum, journalFncnum, reconNum, company) {
  process.stderr.write(`formStart BANKRECONSP...\n`);
  const form = await withTimeout(
    priority.formStart('BANKRECONSP', null, null, company),
    30000, 'formStart BANKRECONSP'
  );

  const targets = new Set([bankFncnum, journalFncnum].filter(Boolean));
  const marked  = new Map(); // fncnum → rowNum
  let   pageIdx = 1;

  // Scan pages until we've found all targets or run out of rows
  while (pageIdx <= MAX_PAGES && marked.size < targets.size) {
    process.stderr.write(`  getRows page ${pageIdx}...\n`);
    const data = await withTimeout(form.getRows(pageIdx), 20000, `getRows page ${pageIdx}`);
    const rows = (data?.rows || data?.Rows || []);
    process.stderr.write(`  Got ${rows.length} rows on page ${pageIdx}\n`);
    if (rows.length === 0) break;

    for (const row of rows) {
      const fncnum = String(row.FNCNUM || row.fncnum || '').trim();
      if (!targets.has(fncnum)) continue;
      if (marked.has(fncnum)) continue;

      const rowNum = row.row || row.Row || row.rownum || row.index;
      process.stderr.write(`  Found FNCNUM=${fncnum} at row ${rowNum}, setting RECON=${reconNum}\n`);
      try {
        await withTimeout(form.setActiveRow(rowNum), 10000, `setActiveRow ${rowNum}`);
        await withTimeout(form.fieldUpdate('RECON', String(reconNum)), 10000, `fieldUpdate RECON ${rowNum}`);
        await withTimeout(form.saveRow(false), 10000, `saveRow ${rowNum}`);
        marked.set(fncnum, rowNum);
        process.stderr.write(`  Marked FNCNUM=${fncnum}\n`);
      } catch (e) {
        process.stderr.write(`  Warning: could not mark row ${rowNum}: ${e.message}\n`);
      }
    }

    if (rows.length < PAGE_SIZE) break; // last page
    pageIdx++;
  }

  process.stderr.write(`Marked ${marked.size}/${targets.size} rows\n`);

  // Run CLOSECREDITRECONSP to permanently commit the marked pairs
  if (marked.size > 0) {
    try {
      process.stderr.write('activateStart CLOSECREDITRECONSP...\n');
      let step = await withTimeout(form.activateStart('CLOSECREDITRECONSP'), 20000, 'activateStart CLOSECREDITRECONSP');
      let d = 0;
      while (step && d < 8) {
        const t = step.type;
        process.stderr.write(`  [${d}] CLOSECREDITRECONSP type=${t}\n`);
        if (t === 'message' && step.proc?.message) {
          step = await withTimeout(step.proc.message(1), 15000, 'CLOSECREDITRECONSP.message');
        } else if (t === 'end' || t === 'finished') {
          break;
        } else if (step.proc?.continueProc) {
          step = await withTimeout(step.proc.continueProc(), 15000, 'CLOSECREDITRECONSP.cont');
        } else {
          break;
        }
        d++;
      }
      process.stderr.write('CLOSECREDITRECONSP done\n');
    } catch (e) {
      process.stderr.write(`CLOSECREDITRECONSP warning: ${e.message}\n`);
    }
  }

  try { await withTimeout(form.endCurrentForm(false), 5000, 'endCurrentForm').catch(() => {}); } catch (_) {}
  return marked.size;
}

/**
 * Fallback: open BANKRECONSP and run CREDITRECONSP auto-match activation.
 */
async function autoMatchFallback(company) {
  process.stderr.write('Fallback: formStart BANKRECONSP for CREDITRECONSP auto-match...\n');
  try {
    const form = await withTimeout(priority.formStart('BANKRECONSP', null, null, company), 30000, 'formStart fallback');
    let step = await withTimeout(form.activateStart('CREDITRECONSP'), 20000, 'CREDITRECONSP');
    let d = 0;
    while (step && d < 8) {
      const t = step.type;
      if (t === 'message' && step.proc?.message) step = await withTimeout(step.proc.message(1), 15000, 'CREDITRECONSP.msg');
      else if (t === 'end' || t === 'finished') break;
      else if (step.proc?.continueProc) step = await withTimeout(step.proc.continueProc(), 15000, 'CREDITRECONSP.cont');
      else break;
      d++;
    }
    process.stderr.write('CREDITRECONSP auto-match done\n');
    try { await withTimeout(form.endCurrentForm(false), 5000, 'endCurrentForm').catch(() => {}); } catch (_) {}
  } catch (e) {
    process.stderr.write(`autoMatchFallback error: ${e.message}\n`);
  }
}

async function main() {
  const journalFncnum = (process.argv[2] || '').trim();
  const cashname      = (process.argv[3] || '').trim();
  const bankFncnum    = (process.argv[4] || '').trim();

  if (!cashname) throw new Error('Usage: node bank_recon.js <journalFncnum> <cashname> [bankFncnum]');

  const odataUrl = process.env.PRIORITY_URL_REAL || process.env.PRIORITY_URL || '';
  const { serviceUrl, tabulaini, company } = parseOdataUrl(odataUrl);

  process.stderr.write(`Login → ${serviceUrl} (${company})\n`);
  await priority.login({
    username: process.env.PRIORITY_USERNAME,
    password: process.env.PRIORITY_PASSWORD,
    url: serviceUrl, tabulaini, language: 1, appname: 'TACT-BankRecon',
  });
  process.stderr.write('Login OK\n');

  // Step 1: MANBANKRECON — refresh the reconciliation view for this bank account
  const manResult = await runProc('MANBANKRECON', {
    EditFields: [{ field: 1, value: cashname }]
  }, company);
  process.stderr.write(`MANBANKRECON: ${JSON.stringify(manResult)}\n`);

  if (!manResult.ok) throw new Error('MANBANKRECON failed');

  // Step 2: Mark the two rows with the same reconciliation number, then CLOSECREDITRECONSP
  // Use a numeric recon number derived from bankFncnum digits or a timestamp
  const reconNum = (bankFncnum.replace(/\D/g, '').slice(-6) | 0) || (Date.now() % 99999) || 1;
  process.stderr.write(`Using RECON number: ${reconNum}\n`);

  let markedRows = 0;
  try {
    if (bankFncnum || journalFncnum) {
      markedRows = await markAndClose(bankFncnum, journalFncnum, reconNum, company);
    }
  } catch (e) {
    process.stderr.write(`markAndClose failed (${e.message}), trying auto-match fallback\n`);
  }

  // Fallback auto-match if no rows were marked
  if (markedRows === 0) {
    await autoMatchFallback(company);
  }

  process.stdout.write(JSON.stringify({ ok: true, journalFncnum, bankFncnum, cashname, markedRows, reconNum }));
}

main().catch(err => {
  process.stderr.write('ERROR: ' + (err.message || String(err)) + '\n');
  process.stdout.write(JSON.stringify({ ok: false, error: err.message || String(err) }));
  process.exit(1);
});
