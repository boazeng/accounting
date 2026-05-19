'use strict';
/**
 * Close a Priority receipt draft using the Web SDK (CLOSETIV procedure).
 * Usage: node close_receipt.js <IVNUM>
 * Output: JSON to stdout — { ok: true, ivnum } or { ok: false, error }
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const priority = require('priority-web-sdk');

function parseOdataUrl(odataUrl) {
  const url = (odataUrl || '').replace(/\/$/, '');
  // Expected format: https://domain/odata/Priority/tabula.ini/company
  const match = url.match(/^(https?:\/\/[^\/]+)\/odata\/Priority\/([^\/]+)\/(.+)$/);
  if (!match) throw new Error('Cannot parse Priority URL: ' + url);
  const [, base, tabulaini, company] = match;
  return { serviceUrl: base + '/wcf/service.svc', tabulaini, company };
}

async function main() {
  const ivnum = process.argv[2];
  if (!ivnum) throw new Error('Usage: node close_receipt.js <IVNUM>');

  const odataUrl = process.env.PRIORITY_URL_REAL || process.env.PRIORITY_URL || '';
  const { serviceUrl, tabulaini, company } = parseOdataUrl(odataUrl);

  process.stderr.write(`Logging in to ${serviceUrl} (${company})...\n`);
  await priority.login({
    username: process.env.PRIORITY_USERNAME,
    password: process.env.PRIORITY_PASSWORD,
    url:      serviceUrl,
    tabulaini,
    language: 1,
    appname:  'TACT-Receipts',
  });
  process.stderr.write('Login OK\n');

  // Activate CLOSETIV procedure on the specific TINVOICES record
  // link.table  = the form table
  // link.link   = the key field (IVNUM identifies the receipt)
  // link.linkid = the actual key value (e.g. 'T12337')
  process.stderr.write(`Running CLOSETIV on TINVOICES where IVNUM='${ivnum}'...\n`);
  await priority.procStartActivate(
    'CLOSETIV',
    'P',
    { table: 'TINVOICES', link: 'IVNUM', linkid: ivnum },
    null,    // progress callback — no interactive dialogs expected
    company,
  );

  process.stderr.write('CLOSETIV completed\n');
  process.stdout.write(JSON.stringify({ ok: true, ivnum }));
}

main().catch(err => {
  process.stderr.write('ERROR: ' + err.message + '\n');
  process.stdout.write(JSON.stringify({ ok: false, error: err.message }));
  process.exit(1);
});
