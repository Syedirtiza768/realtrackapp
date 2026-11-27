// ONE-OFF, ALREADY RUN 2026-11-27 against live Primewardrobeusa and The Fashion Story listings (1,036 + 1,035).
// Do not re-run without reviewing the sale-price handling first: a 25019 retry drops pricingSummary (see docs/operations/SKU_ENRICHMENT_2026-11-27.md).
// Update live listings through the Inventory API only (PUT /sell/inventory/v1/inventory_item/{sku}).
// Targets: SKUs with a PUBLISHED offer on an ACTIVE listing (from audit_<store>.jsonl) AND changed in apply_plan.json.
// Writes only to the description and to the aspects/brand the enhancement filled and that eBay's Taxonomy allows.
// Never touches offers, prices, quantities, locations, policies or photos; never calls Trading.
//   node /work/publish_inv.cjs <pwusa|tfs> <mode: dry|live> <maxRows|0> [onlySkuFile|-]
'use strict';
const fs = require('fs');
const path = require('path');
const { Client } = require('/app/node_modules/pg');
const { TokenEncryptionService } = require('/app/dist/src/channels/token-encryption.service.js');
const WORK = '/work';
const ACCOUNTS = { pwusa: '718461ce-554b-49ca-9482-79fe676b0195', tfs: 'b9c799d7-30ae-408d-bec5-c580e960e644' };
const MARKET = 'EBAY_US';
const CATEGORY_TREE = '0';
const [store, mode = 'dry', maxArg = '0', onlyFile = '-'] = process.argv.slice(2);
if (!ACCOUNTS[store]) { console.error('store must be pwusa or tfs'); process.exit(2); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Same wrapper the live listings already carry (eBay shows it above the seller text).
function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function wrapDescription(text) { return '<h3>Item description from the seller</h3><p>' + escHtml(text) + '</p>'; }
// Map a catalogue word to eBay's allowed value for a SELECTION_ONLY aspect (e.g. "Trousers" -> "Pants"). null = no safe match.
const SYNONYMS = { trousers: 'Pants', trouser: 'Pants', slacks: 'Pants', 'dress pants': 'Pants', 'casual pants': 'Pants', 'cargo pants': 'Pants', pants: 'Pants',
  chino: 'Chinos', chinos: 'Chinos', jogger: 'Joggers', joggers: 'Joggers', sweatpants: 'Sweatpants', 'sweat pants': 'Sweatpants', jeans: 'Jeans', jean: 'Jeans',
  jeggings: 'Jeggings', overalls: 'Overalls', 'tee': 'T-Shirt', 't-shirt': 'T-Shirt', tshirt: 'T-Shirt', 'polo shirt': 'Polo Shirt', petite: 'Petites', petites: 'Petites' };
function pickAllowed(value, allowedMap) {
  const v = String(value).trim().toLowerCase();
  if (allowedMap.has(v)) return allowedMap.get(v);
  const syn = SYNONYMS[v];
  if (syn && allowedMap.has(syn.toLowerCase())) return allowedMap.get(syn.toLowerCase());
  const last = v.split(/\s+/).pop();
  if (allowedMap.has(last)) return allowedMap.get(last);
  const s2 = SYNONYMS[last];
  if (s2 && allowedMap.has(s2.toLowerCase())) return allowedMap.get(s2.toLowerCase());
  return null;
}
const MAP = [
  ['department', 'Department'], ['itemType', 'Type'], ['size', 'Size'], ['sizeType', 'Size Type'],
  ['color', 'Color'], ['style', 'Style'], ['material', 'Material'], ['fit', 'Fit'],
];

function readJsonl(name) {
  const rows = [];
  for (const l of fs.readFileSync(path.join(WORK, name), 'utf8').split('\n')) {
    if (!l.trim()) continue;
    try { rows.push(JSON.parse(l)); } catch (e) { /* torn last line while a run is still writing */ }
  }
  return rows;
}

async function main() {
  const db = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  await db.connect();
  const { rows: [tok] } = await db.query('SELECT access_token_encrypted, access_token_expires_at FROM ebay_oauth_tokens WHERE ebay_account_id = $1', [ACCOUNTS[store]]);
  if (!tok) throw new Error('no token row');
  if (new Date(tok.access_token_expires_at).getTime() - Date.now() < 15 * 60_000) throw new Error('access token expires within 15 minutes; let the app refresh it first');
  const token = new TokenEncryptionService({ get: (k, d) => process.env[k] ?? d }).decrypt(tok.access_token_encrypted);

  // App token for Taxonomy and Browse (client credentials). Credentials stay in the container env.
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
  const appTok = await (await fetch('https://api.ebay.com/identity/v1/oauth2/token', { method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope') })).json();
  const appToken = appTok.access_token;
  if (!appToken) throw new Error('could not get application token');

  const api = async (method, p, body, auth = token) => {
    const headers = { Authorization: `Bearer ${auth}`, Accept: 'application/json', 'Accept-Language': 'en-US', 'Content-Language': 'en-US', 'X-EBAY-C-MARKETPLACE-ID': MARKET };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch('https://api.ebay.com' + p, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json; try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (res.status === 429) throw new Error('RATE_LIMITED 429: ' + text.slice(0, 200));
    return { status: res.status, json, text: text.slice(0, 400) };
  };

  const audit = readJsonl(`audit_${store}.jsonl`).filter((a) => a.linkedActive && a.itemStatus === 200);
  const plan = new Map(JSON.parse(fs.readFileSync(path.join(WORK, 'apply_plan.json'), 'utf8')).map((p) => [p.sku, p]));
  // Resume: SKUs already written live for this store in an earlier run are skipped.
  const doneBefore = new Set();
  if (mode === 'live') {
    for (const f of fs.readdirSync(WORK)) {
      if (!f.startsWith(`publish_${store}_live_`) || !f.endsWith('.jsonl')) continue;
      for (const r of readJsonl(f)) if (r.result === 'put_ok') doneBefore.add(r.sku);
    }
  }
  let skus = audit.map((a) => a.sku).filter((s) => plan.has(s) && !doneBefore.has(s));
  console.log('already written live before this run:', doneBefore.size);
  if (onlyFile !== '-') { const only = new Set(fs.readFileSync(path.join(WORK, onlyFile), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)); skus = skus.filter((s) => only.has(s)); }
  const max = Number(maxArg) || 0;
  if (max) skus = skus.slice(0, max);
  const cat = new Map((await db.query('SELECT sku, category_id FROM catalog_products WHERE sku = ANY($1)', [skus])).rows.map((r) => [r.sku, r.category_id]));
  const dbRows = new Map((await db.query('SELECT sku, brand, description, vertical_attributes FROM catalog_products WHERE sku = ANY($1)', [skus])).rows.map((r) => [r.sku, r]));
  await db.end();
  const offerBySku = new Map(audit.map((a) => [a.sku, a]));

  // Taxonomy: allowed values for SELECTION_ONLY aspects of the listing category.
  const aspectCache = new Map();
  async function allowedAspects(categoryId) {
    if (aspectCache.has(categoryId)) return aspectCache.get(categoryId);
    const r = await api('GET', `/commerce/taxonomy/v1/category_tree/${CATEGORY_TREE}/get_item_aspects_for_category?category_id=${encodeURIComponent(categoryId)}`, undefined, appToken);
    const m = new Map();
    for (const a of (r.json && r.json.aspects) || []) {
      const selectOnly = a.aspectConstraint && a.aspectConstraint.aspectMode === 'SELECTION_ONLY';
      m.set(a.localizedAspectName.toLowerCase(), { selectOnly, values: new Map((a.aspectValues || []).map((v) => [v.localizedValue.toLowerCase(), v.localizedValue])) });
    }
    aspectCache.set(categoryId, m);
    return m;
  }

  const results = [];
  const outName = `publish_${store}_${mode}_${Date.now()}.jsonl`;
  const out = (o) => { fs.appendFileSync(path.join(WORK, outName), JSON.stringify(o) + '\n'); };
  console.log('targets', skus.length, 'mode', mode, 'output', outName);
  for (const sku of skus) {
    const p = plan.get(sku);
    const row = dbRows.get(sku);
    const linkedOffer = (offerBySku.get(sku).offers || []).find((o) => o.status === 'PUBLISHED' && o.listingStatus === 'ACTIVE') || {};
    const rec = { sku, store, offerId: linkedOffer.offerId || null, listingId: linkedOffer.listingId || null };
    try {
      const got = await api('GET', `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`);
      if (got.status === 401) { out({ ...rec, result: 'stopped_401' }); console.log('401, stopping'); break; }
      if (got.status !== 200) { out({ ...rec, result: 'get_failed', status: got.status, error: got.text }); continue; }
      const item = got.json;
      const product = JSON.parse(JSON.stringify(item.product || {}));
      const aspects = product.aspects || {};
      const lower = new Set(Object.keys(aspects).map((k) => k.toLowerCase()));
      // The live category is the OFFER's categoryId (the DB category_id can differ); aspects must match it.
      const offerDetail = rec.offerId ? await api('GET', `/sell/inventory/v1/offer/${rec.offerId}`) : { status: 0, json: null };
      const liveCategory = offerDetail.json && offerDetail.json.categoryId ? String(offerDetail.json.categoryId) : null;
      rec.categoryId = liveCategory;
      if (!liveCategory) { out({ ...rec, result: 'no_offer_category', status: offerDetail.status }); continue; }
      // Pre-state for rollback: the live offer description and the inventory item before this write.
      if (mode === 'live') {
        const pre = { sku, store, at: new Date().toISOString(), offerId: rec.offerId, listingId: rec.listingId,
          offerListingDescription: offerDetail.json ? offerDetail.json.listingDescription : null,
          inventoryDescription: item.product ? item.product.description : null,
          inventoryAspects: item.product ? item.product.aspects : null, inventoryBrand: item.product ? item.product.brand : null };
        fs.appendFileSync(path.join(WORK, 'prestate_' + store + '.jsonl'), JSON.stringify(pre) + '\n');
      }
      const allowed = await allowedAspects(liveCategory);
      const added = {};
      const skipped = {};
      const changes = plan.get(sku).changes || {};
      const filled = Object.keys(changes.va || {});
      for (const [key, name] of MAP) {
        if (!filled.includes(key)) continue;
        if (lower.has(name.toLowerCase())) { skipped[name] = 'already on listing'; continue; }
        const value = String(changes.va[key]).slice(0, 65);
        const spec = allowed.get(name.toLowerCase());
        if (spec && spec.selectOnly) {
          const exact = pickAllowed(value, spec.values);
          if (!exact) { skipped[name] = `"${value}" not an allowed value for category ${liveCategory}`; continue; }
          aspects[name] = [exact];
        } else {
          aspects[name] = [value];
        }
        added[name] = aspects[name][0];
      }
      if (changes.brand && !product.brand) {
        product.brand = String(changes.brand).slice(0, 65);
        if (!lower.has('brand')) { aspects.Brand = [product.brand]; added.Brand = product.brand; }
      }
      product.aspects = aspects;
      if (changes.description) product.description = changes.description;
      const body = { ...item, product };
      // Response-only package fields with zero values are rejected on PUT (error 25709); drop them.
      const pkg = body.packageWeightAndSize;
      if (pkg) {
        const keep = {};
        if (pkg.weight && pkg.weight.value > 0) keep.weight = pkg.weight;
        if (pkg.dimensions && pkg.dimensions.length && pkg.dimensions.length.value > 0 && pkg.dimensions.width.value > 0 && pkg.dimensions.height.value > 0) keep.dimensions = pkg.dimensions;
        if (Object.keys(keep).length) body.packageWeightAndSize = keep; else delete body.packageWeightAndSize;
      }
      rec.added = added; rec.skipped = skipped; rec.descriptionChanged = !!changes.description;
      if (mode !== 'live') { out({ ...rec, result: 'dry' }); results.push(rec); continue; }
      let put = await api('PUT', `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, body);
      if (put.status >= 400 && Object.keys(added).length) {
        // Retry with the description only if an aspect value was rejected; report the aspects as not written.
        const retry = { ...body, product: { ...product, aspects: item.product.aspects || {} } };
        put = await api('PUT', `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, retry);
        rec.aspectsWritten = false; rec.putFirstError = true;
      } else rec.aspectsWritten = put.status < 400;
      if (put.status >= 400) { out({ ...rec, result: 'put_failed', status: put.status, error: put.text }); continue; }
      const descOk = true; // the live result is checked on the public listing (Browse) after each batch
      // The live listing shows the OFFER's listingDescription, not the inventory item's description.
      // So the description also goes to the offer (the same full-body PUT the location work uses, with listing/status/offerId removed).
      let offerOk = null;
      if (changes.description && rec.offerId) {
        if (offerDetail.status !== 200 || !offerDetail.json) { offerOk = false; rec.offerError = `offer GET ${offerDetail.status}`; }
        else {
          const ob = { ...offerDetail.json };
          delete ob.listing; delete ob.status; delete ob.offerId;
          ob.listingDescription = wrapDescription(changes.description);
          let offerPut = await api('PUT', `/sell/inventory/v1/offer/${rec.offerId}`, ob);
          if (offerPut.status >= 400 && /25019/.test(offerPut.text)) {
            // eBay refuses any price field on a listing that is part of a sale (25019). Send the same offer without pricingSummary: the price stays as it is.
            const ob2 = { ...ob }; delete ob2.pricingSummary;
            offerPut = await api('PUT', `/sell/inventory/v1/offer/${rec.offerId}`, ob2);
            rec.offerSentWithoutPrice = true;
          }
          offerOk = offerPut.status < 400;
          if (!offerOk) rec.offerError = `offer PUT ${offerPut.status} ${offerPut.text}`.slice(0, 300);
        }
      }
      out({ ...rec, result: (changes.description && offerOk === false) ? 'offer_failed' : 'put_ok', verified: descOk, offerUpdated: offerOk, status: put.status });
      results.push(rec);
      await sleep(300);
    } catch (e) {
      if (String(e.message).startsWith('RATE_LIMITED')) { out({ ...rec, result: 'stopped_429', error: String(e.message).slice(0, 200) }); console.log('429: stopping'); break; }
      out({ ...rec, result: 'error', error: String(e.message || e).slice(0, 300) });
    }
  }
  console.log('done', outName, 'rows', skus.length);
}
main().catch((e) => { console.error('failed:', e.message); process.exit(1); });
