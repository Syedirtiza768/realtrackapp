// READ-ONLY: what the public Browse API shows for listings (title, description, item specifics).
// Used to confirm an Inventory PUT reached the live listing. Client-credentials token; no DB or write calls.
//   node /work/verify_browse.cjs <listingIdsFile> [expectFile.json]
'use strict';
const fs = require('fs');
const path = require('path');
const WORK = '/work';
const [idsName, expectName] = process.argv.slice(2);
async function main() {
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
  const t = await (await fetch('https://api.ebay.com/identity/v1/oauth2/token', { method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope') })).json();
  const expect = expectName ? JSON.parse(fs.readFileSync(path.join(WORK, expectName), 'utf8')) : {};
  const ids = fs.readFileSync(path.join(WORK, idsName), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  for (const id of ids) {
    const r = await fetch(`https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${t.access_token}`, Accept: 'application/json', 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' } });
    const text = await r.text();
    let j; try { j = JSON.parse(text); } catch { j = {}; }
    const desc = (j.description || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    const aspects = (j.localizedAspects || []).map((a) => `${a.name}=${a.value}`);
    const e = expect[id] || null;
    console.log(JSON.stringify({ id, http: r.status, title: (j.title || '').slice(0, 60), descLen: desc.length, descHead: desc.slice(0, 120), aspects: aspects.slice(0, 12), matchesExpected: e ? desc.includes(e.description) : null, err: r.status >= 400 ? text.slice(0, 200) : undefined }));
  }
}
main().catch((e) => { console.error('failed:', e.message); process.exit(1); });
