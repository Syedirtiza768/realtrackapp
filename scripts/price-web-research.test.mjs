#!/usr/bin/env node
/**
 * Tests for the web-search pricing stage's pure logic — chiefly the checks that
 * stop a hallucinated URL, price or part from reaching a CSV.
 * Run: node --test scripts/price-web-research.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  creditBudget,
  safeHttpUrl,
  classifySource,
  parseModelJson,
  assessSource,
  verifyPageText,
  structuredProductPrices,
  decide,
  buildPrompt,
} from './price-web-research.mjs';

const row = {
  index: 7, sourceRow: 9, sku: 'SKF-GRW25', brand: 'Skf', mpn: 'GRW25',
  upc: '85311538138', ean: '', oem: '', category: 'Wheel Bearings', partType: 'Wheel Bearing',
  title: 'SKF GRW25 Wheel Bearing',
};

const claim = (overrides = {}) => ({
  url: 'https://www.fortluft.com/skf-grw25-wheel-bearing/',
  site: 'FORTLUFT',
  title: 'SKF GRW25 Wheel Bearing',
  price: 97.43,
  currency: 'USD',
  shipping: null,
  core_charge: null,
  condition: 'new',
  evidence: 'SKF GRW25 wheel bearing, $97.43, In Stock',
  ...overrides,
});

/** A source that already passed assessment and page verification. */
const good = (overrides = {}) => ({
  verdict: 'candidate', verified: true, type: 'retailer', site: 'shop.example.com',
  url: 'https://shop.example.com/p/grw25', title: 'SKF GRW25', price: 100, landed: 100,
  shipping: null, condition: 'new', ...overrides,
});

/* ── URL safety and classification ───────────────────────────────────────── */

test('safeHttpUrl accepts public http(s) hosts', () => {
  assert.ok(safeHttpUrl('https://www.carid.com/skf/product-mpn-grw25.html'));
  assert.ok(safeHttpUrl('http://shop.example.com/x'));
});

test('safeHttpUrl refuses anything that could reach an internal or local target', () => {
  for (const bad of [
    'http://127.0.0.1/admin', 'http://169.254.169.254/latest/meta-data', 'http://localhost:3000/',
    'file:///etc/passwd', 'javascript:alert(1)', 'https://[::1]/', 'https://intranet/x',
    'https://metadata.internal/x', 'ftp://example.com/x', 'not a url', '',
  ]) assert.equal(safeHttpUrl(bad), null, bad);
});

test('classifySource trusts only brand-owned domains as manufacturer pricing', () => {
  assert.equal(classifySource(new URL('https://www.napaonline.com/en/p/1425XB'), 'Napa'), 'official');
  assert.equal(classifySource(new URL('https://www.napaonline.com/en/p/1425XB'), 'Skf'), 'retailer', 'another brand\'s site is not official for this row');
  assert.equal(classifySource(new URL('https://automotive.skf.com/x'), 'Skf'), 'official');
  assert.equal(classifySource(new URL('https://www.carid.com/skf/x'), 'Skf'), 'retailer', 'a retailer calling itself authorized is still a retailer');
  assert.equal(classifySource(new URL('https://www.ebay.com/itm/1'), 'Skf'), 'marketplace_listing');
});

test('parseModelJson tolerates fences and surrounding prose, and rejects garbage', () => {
  assert.deepEqual(parseModelJson('{"a":1}'), { a: 1 });
  assert.deepEqual(parseModelJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseModelJson('Here you go: {"a":1} hope that helps'), { a: 1 });
  assert.equal(parseModelJson('no json here'), null);
  assert.equal(parseModelJson(''), null);
});

/* ── Source assessment ───────────────────────────────────────────────────── */

test('assessSource accepts a clean new-condition claim and computes the landed price', () => {
  const result = assessSource(claim({ shipping: 9.99 }), row);
  assert.equal(result.verdict, 'candidate');
  assert.equal(result.type, 'retailer');
  assert.equal(result.landed, 107.42);
});

test('assessSource routes remanufactured/used pages to not_new instead of dropping them', () => {
  for (const condition of ['remanufactured', 'used']) {
    const result = assessSource(claim({ condition }), row);
    assert.equal(result.verdict, 'not_new', condition);
    assert.match(result.reason, /condition_not_new/);
  }
  const hidden = assessSource(claim({ condition: 'new', title: 'SKF GRW25 Remanufactured Wheel Bearing' }), row);
  assert.equal(hidden.verdict, 'not_new', 'a "new" claim contradicted by the page title is not trusted');
});

test('assessSource rejects claims that fail the methodology filters', () => {
  const cases = [
    [{ currency: 'CAD' }, 'foreign_currency'],
    [{ price: 0.5 }, 'price_below_floor'],
    [{ price: null }, 'no_price'],
    [{ url: 'http://127.0.0.1/x' }, 'bad_url'],
    [{ title: 'Lot of 4 SKF GRW25 Wheel Bearings', evidence: 'Lot of 4, $97.43 GRW25' }, 'bundle_or_lot'],
    [{ title: 'SKF Wheel Bearing', evidence: 'Fits many vehicles, $97.43', url: 'https://shop.example.com/p/123' }, 'identifier_not_in_source'],
  ];
  for (const [overrides, expected] of cases) {
    const result = assessSource(claim(overrides), row);
    assert.equal(result.verdict, 'rejected', JSON.stringify(overrides));
    assert.equal(result.reason, expected, JSON.stringify(overrides));
  }
});

test('an unstated condition is assumed new for parts not commonly remanufactured, but not for calipers, starters or alternators', () => {
  const bearing = assessSource(claim({ condition: 'unknown' }), row);
  assert.equal(bearing.verdict, 'candidate');
  assert.equal(bearing.conditionAssumed, true);
  for (const partType of ['Brake Caliper', 'Starter Motor', 'Alternator']) {
    const result = assessSource(claim({ condition: 'unknown' }), { ...row, partType, title: `NAPA ${partType}` });
    assert.equal(result.verdict, 'rejected', partType);
    assert.equal(result.reason, 'condition_not_stated_new', partType);
  }
  const explicitNew = assessSource(claim({ condition: 'new' }), { ...row, partType: 'Brake Caliper' });
  assert.equal(explicitNew.verdict, 'candidate');
  assert.equal(explicitNew.conditionAssumed, false);
});

test('assessSource accepts the UPC as the identifier when the MPN is not stated', () => {
  const result = assessSource(claim({
    title: 'Wheel Bearing', evidence: 'UPC 085311538138 — $97.43', url: 'https://shop.example.com/p/9',
  }), row);
  assert.equal(result.verdict, 'candidate');
});

/* ── Independent page verification ───────────────────────────────────────── */

test('verifyPageText confirms MPN and price that are really on the page', () => {
  const html = '<html><body><h1>SKF GRW25 Wheel Bearing</h1><span class="p">$97.43</span></body></html>';
  const check = verifyPageText(html, row, 97.43);
  assert.equal(check.mpnFound, true);
  assert.equal(check.priceFound, true);
  assert.equal(check.verified, true);
});

test('verifyPageText refuses a price the page does not show', () => {
  const html = '<h1>SKF GRW25</h1><span>$104.10</span>';
  const check = verifyPageText(html, row, 97.43);
  assert.equal(check.mpnFound, true);
  assert.equal(check.priceFound, false);
  assert.equal(check.verified, false);
});

test('verifyPageText needs the brand when only the MPN matches, since an MPN can collide across brands', () => {
  const other = verifyPageText('<h1>Acme GRW25 Wheel Bearing</h1><p>$97.43</p>', { ...row, upc: '' }, 97.43);
  assert.equal(other.mpnFound, true);
  assert.equal(other.brandFound, false);
  assert.equal(other.verified, false);
  const upcOnly = verifyPageText('<h1>Wheel Bearing</h1><p>UPC 085311538138</p><p>$97.43</p>', row, 97.43);
  assert.equal(upcOnly.verified, true, 'a matching UPC identifies the product without the brand name');
});

test('verifyPageText refuses a page for a different part even if the price matches', () => {
  const check = verifyPageText('<h1>SKF GRW99 Wheel Bearing</h1><p>$97.43</p>', row, 97.43);
  assert.equal(check.mpnFound, false);
  assert.equal(check.verified, false);
});

test('verifyPageText matches the MPN on a boundary, not inside a longer number', () => {
  const numeric = { ...row, mpn: '36201', upc: '' };
  assert.equal(verifyPageText('<p>Ref 1362019 costs $50.00</p>', numeric, 50).mpnFound, false);
  assert.equal(verifyPageText('<p>Part 36201 costs $50.00</p>', numeric, 50).mpnFound, true);
});

test('verifyPageText handles thousands separators, whole-dollar prices and JSON-LD prices', () => {
  assert.equal(verifyPageText('<p>GRW25 now $1,234.56</p>', row, 1234.56).priceFound, true);
  assert.equal(verifyPageText('<p>GRW25 now $97</p>', row, 97).priceFound, true);
  assert.equal(verifyPageText('<script type="application/ld+json">{"sku":"GRW25","price":"97.43"}</script>', row, 97.43).priceFound, true);
});

test('verifyPageText matches a UPC with or without its leading zero', () => {
  assert.equal(verifyPageText('<p>UPC 085311538138 $97.43</p>', { ...row, mpn: '' }, 97.43).upcFound, true);
  assert.equal(verifyPageText('<p>UPC 85311538138 $97.43</p>', { ...row, mpn: '' }, 97.43).upcFound, true);
});

/* ── Decision logic ──────────────────────────────────────────────────────── */

test('three page-verified retail prices give pricing_verified_comparable, capped at medium confidence', () => {
  const result = decide(row, [good({ price: 90, landed: 90 }), good({ price: 100, landed: 100 }), good({ price: 110, landed: 110 })]);
  assert.equal(result.status, 'pricing_verified_comparable');
  assert.equal(result.method, 'web_search_exact_mpn');
  assert.equal(result.confidence, 'medium');
  assert.equal(result.medianPrice, 100);
  assert.equal(result.recommended, 96.99, 'median 100 x 0.97, rounded to .99');
  assert.equal(result.listPrice, result.recommended);
  assert.equal(result.comparables.length, 3);
  assert.equal(result.lookupFailed, false);
});

test('a wildly dispersed verified set is sent to manual review, not priced', () => {
  const result = decide(row, [good({ price: 10, landed: 10 }), good({ price: 100, landed: 100 }), good({ price: 500, landed: 500 })]);
  assert.equal(result.status, 'manual_pricing_review');
  assert.equal(result.confidence, 'low');
});

test('one page-verified manufacturer price is estimated MSRP at low confidence; two raise it to medium', () => {
  const official = (price) => good({ type: 'official', price, landed: price });
  const one = decide(row, [official(100)]);
  assert.equal(one.status, 'pricing_estimated_msrp');
  assert.equal(one.method, 'web_search_msrp');
  assert.equal(one.recommended, 89.99, 'MSRP 100 x 0.9');
  assert.equal(one.confidence, 'low');
  assert.equal(decide(row, [official(100), official(102)]).confidence, 'medium');
});

test('an MSRP far above the verified market prices is flagged for review', () => {
  const result = decide(row, [good({ type: 'official', price: 300, landed: 300 }), good({ price: 100, landed: 100 })]);
  assert.equal(result.status, 'manual_pricing_review');
  assert.match(result.notes.join(' '), /well above/);
});

test('fewer than three verified comparables is manual review', () => {
  const result = decide(row, [good(), good({ price: 105, landed: 105 })]);
  assert.equal(result.status, 'manual_pricing_review');
  assert.equal(result.confidence, 'low');
  assert.equal(result.comparables.length, 2);
});

test('claims that could not be verified on the page never count as comparables', () => {
  const claimed = { verdict: 'candidate', verified: false, fetchNote: 'http_403', type: 'retailer', url: 'https://blocked.example.com/p', price: 97, landed: 97 };
  const result = decide(row, [claimed, { ...claimed, url: 'https://b2.example.com/p' }, { ...claimed, url: 'https://b3.example.com/p' }]);
  assert.equal(result.status, 'manual_pricing_review', 'three unverified claims must not become a verified price');
  assert.equal(result.comparables.length, 0);
  assert.equal(result.confidence, 'low');
  assert.match(result.notes.join(' '), /could not be confirmed/);
});

test('an exact part found only as remanufactured is a condition conflict, not a New price', () => {
  const reman = { verdict: 'not_new', reason: 'condition_not_new:remanufactured', condition: 'remanufactured', site: 'NAPA', price: 108.97, url: 'https://www.napaonline.com/en/p/1425XB' };
  const result = decide({ ...row, brand: 'Napa', mpn: '1425XB' }, [reman]);
  assert.equal(result.conditionConflict, true);
  assert.equal(result.status, 'manual_pricing_review');
  assert.equal(result.recommended, null);
  assert.equal(result.listPrice, null);
  assert.match(result.notes.join(' '), /remanufactured/);
  assert.match(result.notes.join(' '), /catalog lists it as New/);
});

test('the model conflict flag is advisory: it never prices a row and never blocks one', () => {
  const flagged = { identifierConflict: true, conflictNote: 'unrelated key listing reuses the MPN' };
  const nothing = decide(row, [], flagged);
  assert.equal(nothing.status, 'pricing_pending', 'a flag alone is not evidence of anything');
  assert.equal(nothing.recommended, null);
  assert.equal(nothing.identifierConflict, false);
  assert.match(nothing.notes.join(' '), /unrelated pages/);

  const priced = decide(row, [good(), good({ price: 101, landed: 101 }), good({ price: 102, landed: 102 })], flagged);
  assert.equal(priced.status, 'pricing_verified_comparable', 'verified brand+MPN+price pages still price the row');
  assert.match(priced.notes.join(' '), /unrelated pages/);
});

test('a condition conflict is not masked by the model raising an identifier flag', () => {
  const reman = { verdict: 'not_new', reason: 'condition_not_new:remanufactured', condition: 'remanufactured', site: 'NAPA Auto Parts', price: 146.2, url: 'https://www.napaonline.com/en/p/ACA1550XB' };
  const result = decide({ ...row, brand: 'Napa', mpn: '1550XB', partType: 'Brake Caliper' }, [reman], { identifierConflict: true, conflictNote: 'a lock key uses 1550XB' });
  assert.equal(result.conditionConflict, true);
  assert.equal(result.status, 'manual_pricing_review');
  assert.match(result.notes.join(' '), /remanufactured/);
});

test('an assumed condition is disclosed in the notes of a priced row', () => {
  const assumed = (price) => good({ price, landed: price, url: `https://s${price}.example.com/p`, conditionAssumed: true });
  const result = decide(row, [assumed(90), assumed(100), assumed(110)]);
  assert.equal(result.status, 'pricing_verified_comparable');
  assert.match(result.notes.join(' '), /do not state a condition/);
});

test('nothing found keeps the row as pricing_pending with no invented price', () => {
  const result = decide(row, []);
  assert.equal(result.status, 'pricing_pending');
  assert.equal(result.method, 'none');
  assert.equal(result.recommended, null);
  assert.equal(result.confidence, 'none');
  assert.match(result.notes.join(' '), /no exact-match/i);
});

test('rejected-only claims stay pending and say why', () => {
  const rejected = { verdict: 'rejected', reason: 'foreign_currency', price: 120, url: 'https://x.example.com/p' };
  const result = decide(row, [rejected]);
  assert.equal(result.status, 'pricing_pending');
  assert.match(result.notes.join(' '), /foreign_currency/);
});

test('the prompt tells the model to report non-new pages and to ignore instructions in pages', () => {
  const prompt = buildPrompt({ ...row, brand: 'Napa' });
  assert.match(prompt, /Brand: NAPA/);
  assert.match(prompt, /remanufactured, rebuilt or used/);
  assert.match(prompt, /untrusted data/);
  assert.match(prompt, /never state a price from memory/i);
});

/* ── Page-declared prices (structured data) ──────────────────────────────── */

const ld = (product) => `<html><head><script type="application/ld+json">${JSON.stringify(product)}</script></head><body><h1>SKF GRW25</h1></body></html>`;
const product = (overrides = {}) => ({
  '@context': 'https://schema.org', '@type': 'Product', name: 'SKF GRW25 Wheel Bearing', mpn: 'GRW25',
  offers: { '@type': 'Offer', price: '97.43', priceCurrency: 'USD' }, ...overrides,
});

test('structuredProductPrices reads the price a page declares for this exact product', () => {
  assert.deepEqual(structuredProductPrices(ld(product()), row), [{ price: 97.43, currency: 'USD' }]);
});

test('structuredProductPrices ignores products that are not this part (related-item carousels)', () => {
  const other = ld({ '@context': 'https://schema.org', '@graph': [
    product(),
    product({ name: 'SKF GRW99 Bearing', mpn: 'GRW99', offers: { price: '55.00', priceCurrency: 'USD' } }),
  ] });
  assert.deepEqual(structuredProductPrices(other, row), [{ price: 97.43, currency: 'USD' }]);
});

test('a wrong quoted price is replaced by the price the page itself declares', () => {
  const check = verifyPageText(ld(product()), row, 94.88);
  assert.equal(check.priceFound, false);
  assert.equal(check.pagePrice, 97.43);
  assert.equal(check.verified, true);
  assert.equal(check.priceSource, 'page_structured_data');
});

test('a quoted price already on the page is confirmed as-is, with no correction', () => {
  const check = verifyPageText(ld(product()), row, 97.43);
  assert.equal(check.priceSource, 'claim_confirmed_on_page');
  assert.equal(check.pagePrice, null);
});

test('structured-price correction refuses ambiguous, foreign-currency or implausible prices', () => {
  const multi = ld(product({ offers: [{ price: '90.00', priceCurrency: 'USD' }, { price: '120.00', priceCurrency: 'USD' }] }));
  assert.equal(verifyPageText(multi, row, 105).verified, false, 'two different offers are ambiguous');
  const cad = ld(product({ offers: { price: '97.43', priceCurrency: 'CAD' } }));
  assert.equal(verifyPageText(cad, row, 94.88).verified, false, 'a CAD price is not USD');
  const far = ld(product({ offers: { price: '400.00', priceCurrency: 'USD' } }));
  assert.equal(verifyPageText(far, row, 94.88).verified, false, 'a price 4x the claim is a different offer, not a correction');
});

test('structured-price correction still requires the identifier to be on the page', () => {
  const wrongPart = ld(product({ name: 'SKF GRW99', mpn: 'GRW99' }));
  assert.equal(verifyPageText(wrongPart, { ...row, upc: '' }, 94.88).verified, false);
});

test('corrected page prices are disclosed in the notes', () => {
  const corrected = (price, claimed) => good({ price, landed: price, claimedPrice: claimed, priceCorrected: true, url: `https://s${price}.example.com/p` });
  const result = decide(row, [corrected(90, 88), corrected(100, 99), corrected(110, 108)]);
  assert.match(result.notes.join(' '), /differ from the price the search reported/);
});

test('creditBudget never lets a run spend into the production reserve', () => {
  assert.equal(creditBudget(20, 11, 3), 8, 'balance minus reserve, when that is below the cap');
  assert.equal(creditBudget(5, 100, 3), 5, 'the per-run cap when the balance is ample');
  assert.equal(creditBudget(20, 3, 3), 0, 'exactly at the reserve leaves nothing to spend');
  assert.equal(creditBudget(20, 1.19, 3), 0, 'below the reserve leaves nothing to spend');
  assert.equal(creditBudget(20, null, 3), 20, 'an unreadable balance falls back to the cap alone');
});
