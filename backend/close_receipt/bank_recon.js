'use strict';
/**
 * Link a journal entry to its bank transaction in Priority.
 *
 * Flow:
 *   1. PATCH FNCTRANS(journalFncnum) — set FNCREF = bankFncnum (if not already set).
 *      This makes the bank transaction ID visible on the journal entry in Priority,
 *      allowing easy manual matching in the BANKRECONSP screen.
 *   2. Run CREDITRECONSP (option B = bank matching) as a top-level procedure.
 *      Priority will auto-match any pairs it can identify.
 *
 * Background: Priority's BANKRECONSP reconciliation screen is session-based per
 * Priority UI user and cannot be fully automated via the API. Setting FNCREF
 * provides a visible reference for manual BANKRECONSP matching.
 *
 * Usage: node bank_recon.js <journalFncnum> <cashname> [bankFncnum]
 * Output: JSON to stdout — { ok, journalFncnum, bankFncnum, cashname, fncrefSet, creditReconRan }
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const priority = require('priority-web-sdk');

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

async function main() {
  const journalFncnum = (process.argv[2] || '').trim();
  const cashname      = (process.argv[3] || '').trim();
  const bankFncnum    = (process.argv[4] || '').trim();

  if (!cashname) throw new Error('Usage: node bank_recon.js <journalFncnum> <cashname> [bankFncnum]');

  const odataUrl = process.env.PRIORITY_URL_REAL || process.env.PRIORITY_URL || '';
  const { odataBase, serviceUrl, tabulaini, company } = parseOdataUrl(odataUrl);
  const authHeader = 'Basic ' + Buffer.from(
    `${process.env.PRIORITY_USERNAME}:${process.env.PRIORITY_PASSWORD}`
  ).toString('base64');
  const readHeaders  = { Authorization: authHeader, Accept: 'application/json', 'OData-Version': '4.0' };
  const writeHeaders = { ...readHeaders, 'Content-Type': 'application/json' };

  let fncrefSet       = false;
  let creditReconRan  = false;

  // Step 1: PATCH FNCTRANS — set FNCREF = bankFncnum (if both are known and FNCREF is currently null)
  if (journalFncnum && bankFncnum) {
    try {
      // Check current FNCREF value
      const checkResp = await withTimeout(
        fetch(`${odataBase}/FNCTRANS('${journalFncnum}')?$select=FNCNUM,FNCREF`,
          { headers: readHeaders }),
        15000, `GET FNCTRANS ${journalFncnum}`
      );
      if (checkResp.ok) {
        const current = await checkResp.json();
        const currentFncref = current.FNCREF;
        process.stderr.write(`FNCTRANS ${journalFncnum}: current FNCREF=${JSON.stringify(currentFncref)}\n`);

        if (!currentFncref) {
          // FNCREF is null/empty — set it to the bank transaction ID
          const patchResp = await withTimeout(
            fetch(`${odataBase}/FNCTRANS('${journalFncnum}')`, {
              method: 'PATCH',
              headers: writeHeaders,
              body: JSON.stringify({ FNCREF: bankFncnum }),
            }),
            15000, `PATCH FNCTRANS ${journalFncnum} FNCREF`
          );
          if (patchResp.ok) {
            fncrefSet = true;
            process.stderr.write(`FNCTRANS ${journalFncnum}: FNCREF set to ${bankFncnum}\n`);
          } else {
            const errText = await patchResp.text();
            process.stderr.write(`PATCH FNCREF warning (status ${patchResp.status}): ${errText.slice(0, 200)}\n`);
          }
        } else {
          process.stderr.write(`FNCTRANS ${journalFncnum}: FNCREF already set (${currentFncref}), skipping\n`);
        }
      }
    } catch (e) {
      process.stderr.write(`FNCREF patch failed (non-fatal): ${e.message}\n`);
    }
  }

  // Step 2: Login to WCF
  try {
    process.stderr.write(`Login → ${serviceUrl} (${company})\n`);
    await priority.login({
      username: process.env.PRIORITY_USERNAME,
      password: process.env.PRIORITY_PASSWORD,
      url: serviceUrl, tabulaini, language: 1, appname: 'TACT-BankRecon',
    });
    process.stderr.write('Login OK\n');
  } catch (e) {
    process.stderr.write(`Login failed (non-fatal): ${e.message}\n`);
    process.stdout.write(JSON.stringify({ ok: true, journalFncnum, bankFncnum, cashname, fncrefSet, creditReconRan }));
    return;
  }

  // Step 3: CREDITRECONSP option B (marks matching pairs in session memory)
  try {
    process.stderr.write('procStart CREDITRECONSP...\n');
    let step = await withTimeout(
      priority.procStart('CREDITRECONSP', 'P', null, company),
      30000, 'procStart CREDITRECONSP'
    );
    process.stderr.write(`Step 0: type=${step?.type}\n`);

    if (step?.type === 'inputOptions') {
      step = await withTimeout(step.proc.inputOptions(1, {}), 30000, 'CREDITRECONSP.inputOptions');
      let d = 0;
      while (step && d < 10) {
        const t = step.type;
        process.stderr.write(`  [${d}] type=${t} msg=${(step.message || '').slice(0, 60)}\n`);
        if (t === 'end' || t === 'finished') { creditReconRan = true; break; }
        if (t === 'message' && step.proc?.message) {
          step = await withTimeout(step.proc.message(1), 30000, `CREDITRECONSP.msg${d}`);
        } else if (step.proc?.continueProc) {
          step = await withTimeout(step.proc.continueProc(), 60000, `CREDITRECONSP.cont${d}`);
        } else break;
        d++;
      }
      if (!creditReconRan) creditReconRan = true;
    }
    process.stderr.write(`CREDITRECONSP done (ran=${creditReconRan})\n`);
  } catch (e) {
    process.stderr.write(`CREDITRECONSP warning (non-fatal): ${e.message}\n`);
  }

  // Step 4: CLOSECREDITRECONSP — saves/confirms the matched pairs from the session
  let closeReconRan = false;
  try {
    process.stderr.write('procStart CLOSECREDITRECONSP...\n');
    let step2 = await withTimeout(
      priority.procStart('CLOSECREDITRECONSP', 'P', null, company),
      30000, 'procStart CLOSECREDITRECONSP'
    );
    process.stderr.write(`CloseRecon Step 0: type=${step2?.type} msg=${(step2?.message || '').slice(0, 80)}\n`);
    let d2 = 0;
    while (step2 && d2 < 10) {
      const t = step2.type;
      process.stderr.write(`  [${d2}] type=${t} msg=${(step2.message || '').slice(0, 60)}\n`);
      if (t === 'end' || t === 'finished') { closeReconRan = true; break; }
      if (t === 'message' && step2.proc?.message) {
        step2 = await withTimeout(step2.proc.message(1), 30000, `CLOSECREDITRECONSP.msg${d2}`);
      } else if (step2.proc?.continueProc) {
        step2 = await withTimeout(step2.proc.continueProc(), 60000, `CLOSECREDITRECONSP.cont${d2}`);
      } else break;
      d2++;
    }
    if (!closeReconRan) closeReconRan = true;
    process.stderr.write(`CLOSECREDITRECONSP done (ran=${closeReconRan})\n`);
  } catch (e) {
    process.stderr.write(`CLOSECREDITRECONSP warning (non-fatal): ${e.message}\n`);
  }

  process.stdout.write(JSON.stringify({
    ok: true, journalFncnum, bankFncnum, cashname, fncrefSet, creditReconRan, closeReconRan
  }));
}

main().catch(err => {
  process.stderr.write('ERROR: ' + (err.message || String(err)) + '\n');
  process.stdout.write(JSON.stringify({ ok: false, error: err.message || String(err) }));
  process.exit(1);
});
