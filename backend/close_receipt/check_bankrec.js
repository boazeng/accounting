'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const odataUrl = (process.env.PRIORITY_URL_REAL || '').replace(/\/$/, '');
const user = process.env.PRIORITY_USERNAME;
const pass = process.env.PRIORITY_PASSWORD;
const auth = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
const hdr = { Authorization: auth, Accept: 'application/json', 'OData-Version': '4.0' };
async function tryGet(url) {
  const r = await fetch(url, { headers: hdr });
  const txt = await r.text();
  try { return { ok: r.ok, status: r.status, data: JSON.parse(txt) }; }
  catch(e) { return { ok: r.ok, status: r.status, data: txt.substring(0,150) }; }
}

(async () => {
  // 1. Look at FNCTRANS with FNCPATNAME=הת to see all their fields (internal match)
  console.log('=== FNCTRANS with הת type (existing) ===');
  const d = await tryGet(`${odataUrl}/FNCTRANS?$filter=FNCPATNAME eq 'הת'&$top=3`);
  if (d.ok && d.data.value) {
    d.data.value.forEach(e => {
      const nonNull = Object.entries(e).filter(([k,v]) => !k.startsWith('@') && v !== null && v !== '' && v !== 0);
      console.log('Entry:', Object.fromEntries(nonNull.slice(0,20)));
    });
  } else {
    console.log('Error:', d.status, JSON.stringify(d.data).substring(0,200));
  }

  // 2. Try known bank reconciliation entity names
  const entities = ['BNKSHTRANS', 'BANKMATCH', 'FNCTRANSBANK', 'BANKRECON', 'GIYUL',
                    'BANKSTRANS', 'TMPBNK', 'BNKGIYUL', 'FNCBANKREC', 'BNKRECTABLE'];
  console.log('\n=== Testing bank reconciliation entity names ===');
  for (const ent of entities) {
    const r = await tryGet(`${odataUrl}/${ent}?$top=1`);
    console.log(`  ${ent}: ${r.status} ${r.ok ? 'OK' : JSON.stringify(r.data).substring(0,80)}`);
  }
})();
