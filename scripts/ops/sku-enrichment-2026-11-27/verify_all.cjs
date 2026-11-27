// READ-ONLY propagation check: for each listing the update wrote, does the public Browse listing show the new description and the added item specifics?
'use strict';
const fs = require('fs');
const path = require('path');
const WORK = '/work';
const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const norm = (s) => String(s).toLowerCase().trim();
async function main() {
  const app = await (await fetch('https://api.ebay.com/identity/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(process.env.EBAY_CLIENT_ID + ':' + process.env.EBAY_CLIENT_SECRET).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope') })).json();
  const rows = JSON.parse(fs.readFileSync(path.join(WORK, 'verify_all_input.json'), 'utf8'));
  const out = fs.createWriteStream(path.join(WORK, 'verify_all_out.jsonl'));
  let idx = 0; let done = 0;
  async function worker() {
    while (idx < rows.length) {
      const r = rows[idx++];
      let rec = { store: r.store, sku: r.sku, listingId: r.listingId };
      try {
        const res = await fetch('https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=' + r.listingId, { headers: { Authorization: 'Bearer ' + app.access_token, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' } });
        const j = await res.json();
        rec.http = res.status;
        const desc = unesc((j.description || ''));
        rec.descMatch = r.description ? desc.includes(r.description) : null;
        const have = {};
        for (const a of j.localizedAspects || []) have[norm(a.name)] = norm(a.value);
        const aspectChecks = {};
        for (const [name, value] of Object.entries(r.added || {})) {
          const v = Array.isArray(value) ? value[0] : value;
          aspectChecks[name] = have[norm(name)] !== undefined;
        }
        rec.aspectMatch = aspectChecks;
        rec.aspectsAllPresent = Object.values(aspectChecks).every(Boolean);
        rec.marketing = j.marketingPrice ? j.marketingPrice.priceTreatment : null;
      } catch (e) { rec.error = String(e.message || e).slice(0, 200); }
      out.write(JSON.stringify(rec) + '\n');
      done++;
      if (done % 200 === 0) console.log('progress', done);
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  await new Promise((r) => out.end(r));
  console.log('finished', done);
}
main().catch((e) => { console.error('failed:', e.message); process.exit(1); });
