'use strict';
/**
 * Finalize a Priority draft EINVOICES (חשבונית קבלה) via Web SDK (CLOSEANINVOICE).
 *
 * Usage: node close_einvoice.js <IVNUM>
 * Output: JSON to stdout — { ok: true, ivnum, final_ivnum, fncnum } or { ok: false, error }
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

async function fetchRecord(odataBase, ivnum) {
  const auth = 'Basic ' + Buffer.from(
    `${process.env.PRIORITY_USERNAME}:${process.env.PRIORITY_PASSWORD}`
  ).toString('base64');
  const hdrs = { Authorization: auth, Accept: 'application/json' };

  const url = `${odataBase}/EINVOICES?$filter=IVNUM eq '${ivnum}'&$select=IV,IVNUM,FINAL,IVTYPE,DEBIT,TOTPRICE&$top=1`;
  const resp = await fetch(url, { headers: hdrs });
  if (!resp.ok) throw new Error(`GET EINVOICES failed (${resp.status}): ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  const rec = (data.value || [])[0];
  if (!rec) throw new Error(`EINVOICES IVNUM='${ivnum}' not found`);
  return rec;
}

function withTimeout(promise, ms, label) {
  const t = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, t]);
}

async function handleStep(step, iv, ivnum, depth) {
  if (!step || depth > 12) return;
  const type = step.type;
  process.stderr.write(`  [${depth}] type=${type} msg=${step.message || ''}\n`);

  if (type === 'inputFields') {
    process.stderr.write(`  Providing IV=${iv} to CLOSEANINVOICE...\n`);
    const inputData = { EditFields: [{ field: 1, value: String(iv) }] };
    const next = await withTimeout(step.proc.inputFields(1, inputData), 30000, 'inputFields');
    return handleStep(next, iv, ivnum, depth + 1);
  }
  if (type === 'message') {
    process.stderr.write(`  Confirming: ${step.message}\n`);
    const next = await withTimeout(step.proc.message(1), 30000, 'message');
    return handleStep(next, iv, ivnum, depth + 1);
  }
  if (type === 'end' || type === 'finished') {
    process.stderr.write('  Done.\n');
    return;
  }
  if (step.proc && step.proc.continueProc) {
    const next = await withTimeout(step.proc.continueProc(), 30000, 'continueProc');
    return handleStep(next, iv, ivnum, depth + 1);
  }
  throw new Error(`Unhandled step type: ${type}`);
}

async function main() {
  const ivnum = process.argv[2];
  if (!ivnum) throw new Error('Usage: node close_einvoice.js <IVNUM>');

  const odataUrl = process.env.PRIORITY_URL_REAL || process.env.PRIORITY_URL || '';
  const { odataBase, serviceUrl, tabulaini, company } = parseOdataUrl(odataUrl);

  // Step 1: Fetch EINVOICES record — get internal IV and verify not already final
  process.stderr.write(`Fetching EINVOICES ${ivnum}...\n`);
  const rec = await fetchRecord(odataBase, ivnum);
  process.stderr.write(`Found: IV=${rec.IV} IVTYPE=${rec.IVTYPE} FINAL=${rec.FINAL || 'draft'} TOTPRICE=${rec.TOTPRICE}\n`);
  if (rec.FINAL === 'Y') throw new Error(`EINVOICES ${ivnum} is already final`);

  const iv = rec.IV;
  if (!iv) throw new Error(`IV field not found for EINVOICES ${ivnum} — cannot run CLOSEANINVOICE`);

  // Step 2: Login via Web SDK
  process.stderr.write(`Login → ${serviceUrl} (${company})\n`);
  await priority.login({
    username:  process.env.PRIORITY_USERNAME,
    password:  process.env.PRIORITY_PASSWORD,
    url:       serviceUrl,
    tabulaini,
    language:  1,
    appname:   'TACT-Receipts',
  });
  process.stderr.write('Login OK\n');

  // Step 3: Run CLOSEANINVOICE
  process.stderr.write('procStart CLOSEANINVOICE...\n');
  const firstStep = await withTimeout(
    priority.procStart('CLOSEANINVOICE', 'P', null, company),
    30000, 'procStart CLOSEANINVOICE'
  );
  await handleStep(firstStep, iv, ivnum, 0);
  process.stderr.write('CLOSEANINVOICE completed\n');

  // Step 4: Fetch final invoice data — get FNCNUM and final IVNUM
  let finalIvnum = null;
  let fncnum = null;
  try {
    const auth2 = 'Basic ' + Buffer.from(
      `${process.env.PRIORITY_USERNAME}:${process.env.PRIORITY_PASSWORD}`
    ).toString('base64');
    const hdrs2 = { Authorization: auth2, Accept: 'application/json' };

    // Wait briefly for Priority to commit
    await new Promise(r => setTimeout(r, 1500));

    // Re-fetch the original draft record to get FNCNUM
    const draftUrl = `${odataBase}/EINVOICES?$filter=IVNUM eq '${ivnum}'&$select=IVNUM,FNCNUM,FINAL&$top=1`;
    const dr = await fetch(draftUrl, { headers: hdrs2 });
    if (dr.ok) {
      const draftData = await dr.json();
      const draft = (draftData.value || [])[0];
      if (draft) fncnum = draft.FNCNUM || null;
    }

    // If we have FNCNUM, find the final invoice with the same journal entry
    if (fncnum) {
      const finalUrl = `${odataBase}/EINVOICES?$filter=FNCNUM eq '${fncnum}' and FINAL eq 'Y'&$select=IVNUM,FNCNUM,FINAL&$top=5`;
      const fr = await fetch(finalUrl, { headers: hdrs2 });
      if (fr.ok) {
        const fd = await fr.json();
        const items = (fd.value || []).filter(x => x.IVNUM !== ivnum);
        if (items.length) finalIvnum = items[0].IVNUM;
      }
    }

    // Fallback: if FNCNUM not on original, check if same IVNUM is now FINAL
    if (!finalIvnum) {
      const checkUrl = `${odataBase}/EINVOICES?$filter=IVNUM eq '${ivnum}' and FINAL eq 'Y'&$select=IVNUM,FNCNUM,FINAL&$top=1`;
      const cr = await fetch(checkUrl, { headers: hdrs2 });
      if (cr.ok) {
        const cd = await cr.json();
        const cf = (cd.value || [])[0];
        if (cf) {
          finalIvnum = cf.IVNUM;
          if (!fncnum) fncnum = cf.FNCNUM || null;
        }
      }
    }

    process.stderr.write(`Post-close: fncnum=${fncnum} final_ivnum=${finalIvnum}\n`);
  } catch (e) {
    process.stderr.write(`Post-close fetch failed (non-fatal): ${e.message}\n`);
  }

  process.stdout.write(JSON.stringify({ ok: true, ivnum, final_ivnum: finalIvnum, fncnum }));
}

main().catch(err => {
  process.stderr.write('ERROR: ' + (err.message || String(err)) + '\n');
  process.stdout.write(JSON.stringify({ ok: false, error: err.message || String(err) }));
  process.exit(1);
});
