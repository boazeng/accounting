'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const odataUrl = (process.env.PRIORITY_URL_REAL || '').replace(/\/$/, '');
const user = process.env.PRIORITY_USERNAME;
const pass = process.env.PRIORITY_PASSWORD;
const auth = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
const hdr  = { Authorization: auth, Accept: 'application/json', 'OData-Version': '4.0' };

async function get(url) {
  const r = await fetch(url, { headers: hdr });
  const txt = await r.text();
  try { return JSON.parse(txt); } catch(e) { console.log('Raw:', txt.substring(0,200)); throw e; }
}

(async () => {
  // Search for entries with various FNCPATNAME values
  console.log('=== All distinct FNCPATNAME values in FNCTRANS ===');
  const seen = new Set();
  const d = await get(`${odataUrl}/FNCTRANS?$filter=FINAL eq 'Y'&$top=50&$select=FNCPATNAME,FNCPATDES2`);
  for (const e of (d.value||[])) {
    const key = e.FNCPATNAME;
    if (!seen.has(key)) {
      seen.add(key);
      console.log(`  PAT=${JSON.stringify(key)}  DES2=${JSON.stringify(e.FNCPATDES2)}`);
    }
  }

  // Also try to find any FNCTRANS with "התאמה" in FNCPATDES2
  console.log('\n=== FNCTRANS with התאמה ===');
  try {
    const d2 = await get(`${odataUrl}/FNCTRANS?$filter=FINAL eq 'Y'&$top=100&$select=FNCNUM,FNCPATNAME,FNCPATDES2,DETAILS`);
    const hataama = (d2.value||[]).filter(e => e.FNCPATDES2 && e.FNCPATDES2.includes('התאמ'));
    if (hataama.length) {
      hataama.slice(0,5).forEach(e => console.log(`  FNCNUM=${e.FNCNUM} PAT=${JSON.stringify(e.FNCPATNAME)} DES2=${JSON.stringify(e.FNCPATDES2)}`));
    } else {
      console.log('  None found in top 100 entries');
      // Show all unique patterns
      const pats = [...new Set((d2.value||[]).map(e => `${e.FNCPATNAME}/${e.FNCPATDES2}`))];
      console.log('  All patterns found:', pats);
    }
  } catch(e) { console.log('  Error:', e.message); }
})();
