// READ-ONLY audit: for each SKU, which Inventory API offer and inventory item exist on one account,
// and whether the offer is PUBLISHED to an ACTIVE listing (the only listings an Inventory PUT can change).
// Runs inside a one-off backend container (see run-node.sh). Writes JSONL; no eBay or DB writes.
//   node /work/audit_inv.cjs <store: pwusa|tfs> <skuFile> <outFile>
'use strict';
const fs = require('fs');
const path = require('path');
const { Client } = require('/app/node_modules/pg');
const { TokenEncryptionService } = require('/app/dist/src/channels/token-encryption.service.js');
const ACCOUNTS = {
  pwusa: '718461ce-554b-49ca-9482-79fe676b0195',
  tfs: 'b9c799d7-30ae-408d-bec5-c580e960e644',
};
const WORK = '/work';
const [store, skuFile, outName] = process.argv.slice(2);
if (!ACCOUNTS[store] || !skuFile || !outName) { console.error('usage: audit_inv.cjs <pwusa|tfs> <skuFile> <outFile>'); process.exit(2); }
const outFile = path.join(WORK, outName);
const MARKET = 'EBAY_US';

async function main() {
  const db = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  await db.connect();
  const { rows: [t] } = await db.query('SELECT access_token_encrypted, access_token_expires_at FROM ebay_oauth_tokens WHERE ebay_account_id = $1', [ACCOUNTS[store]]);
  await db.end();
  if (!t) throw new Error('no token row');
  if (new Date(t.access_token_expires_at).getTime() - Date.now() < 15 * 60_000) throw new Error('access token expires within 15 minutes; let the app refresh it first');
  const token = new TokenEncryptionService({ get: (k, d) => process.env[k] ?? d }).decrypt(t.access_token_encrypted);

  const get = async (p) => {
    const res = await fetch('https://api.ebay.com' + p, { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Accept-Language': 'en-US', 'Content-Language': 'en-US', 'X-EBAY-C-MARKETPLACE-ID': MARKET } });
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
    return { status: res.status, body };
  };
  const skus = fs.readFileSync(path.join(WORK, skuFile), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const out = fs.createWriteStream(outFile, { flags: 'w' });
  const counts = {};
  let stop = false;
  for (const sku of skus) {
    if (/\s/.test(sku)) { out.write(JSON.stringify({ sku, skipped: 'sku contains a space' }) + '\n'); continue; }
    const item = await get(`/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`);
    const offers = await get(`/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}&marketplace_id=${MARKET}`);
    const list = (offers.body && offers.body.offers) || [];
    const rec = {
      sku,
      itemStatus: item.status,
      offerStatus: offers.status,
      offers: list.map((o) => ({ offerId: o.offerId, status: o.status, listingId: o.listing ? o.listing.listingId : null, listingStatus: o.listing ? o.listing.listingStatus : null, available: o.availableQuantity ?? null, price: o.pricingSummary && o.pricingSummary.price ? o.pricingSummary.price.value : null })),
    };
    const linked = list.some((o) => o.status === 'PUBLISHED' && o.listing && o.listing.listingStatus === 'ACTIVE');
    rec.linkedActive = linked;
    const key = item.status === 200 ? (linked ? 'linked_active' : (list.length ? 'item_with_offer_not_linked' : 'item_no_offer')) : `no_item_${item.status}`;
    counts[key] = (counts[key] || 0) + 1;
    out.write(JSON.stringify(rec) + '\n');
    if (item.status === 401 || offers.status === 401) { out.write(JSON.stringify({ sku, abort: '401 unauthorized; token expired during audit' }) + '\n'); stop = true; break; }
  }
  await new Promise((r) => out.end(r));
  console.log('audit', store, 'skus', skus.length, 'counts', JSON.stringify(counts), stop ? 'STOPPED on 401' : '');
}
main().catch((e) => { console.error('failed:', e.message); process.exit(1); });
