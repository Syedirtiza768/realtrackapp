#!/usr/bin/env node
/**
 * Tests for the pricing enrichment stage's pure helpers.
 * Run: node --test scripts/price-enrich-catalog.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exclusionReason,
  landedPrice,
  median,
  trimOutliers,
  friendlyRound,
  evaluateAttempt,
  buildAttempts,
  pricingColumns,
  isPublishReady,
  buildReport,
  buildReviewQueue,
  overlayWebResults,
  relevanceReason,
  partTypeTokens,
  refilterResult,
  REVIEW_QUEUE_HEADERS,
  PRICING_COLUMNS,
} from './price-enrich-catalog.mjs';

const goodItem = (overrides = {}) => ({
  itemId: 'v1|1|0',
  title: 'Delphi FE0415 Electric Fuel Pump New',
  price: { value: '48.95', currency: 'USD' },
  conditionId: '1000',
  buyingOptions: ['FIXED_PRICE'],
  seller: { username: 'parts_seller', feedbackPercentage: '99.2', feedbackScore: 4210 },
  shippingOptions: [{ shippingCost: { value: '0.00', currency: 'USD' } }],
  itemWebUrl: 'https://www.ebay.com/itm/1?amdata=abc',
  ...overrides,
});

test('exclusionReason accepts a clean new fixed-price comparable', () => {
  assert.equal(exclusionReason(goodItem(), 'FE0415'), null);
});

test('exclusionReason rejects listings that fail the methodology filters', () => {
  const cases = [
    [{ buyingOptions: ['AUCTION'] }, 'auction_listing'],
    [{ conditionId: '3000' }, 'condition_not_new'],
    [{ title: 'Delphi FE0415 Fuel Pump - Used, Open Box' }, 'condition_keyword_in_title'],
    [{ title: 'Lot of 4 Delphi FE0415 Fuel Pumps' }, 'bundle_or_lot'],
    [{ price: { value: '39.00', currency: 'GBP' } }, 'foreign_currency'],
    [{ price: { value: '0.50', currency: 'USD' } }, 'price_below_floor'],
    [{ itemGroupType: 'SELLER_DEFINED_VARIATIONS' }, 'multi_variation_listing'],
    [{ seller: { username: 'x', feedbackPercentage: '82.0', feedbackScore: 900 } }, 'seller_feedback_percent'],
    [{ seller: { username: 'x', feedbackPercentage: '100.0', feedbackScore: 3 } }, 'seller_feedback_volume'],
    [{ title: 'Universal Electric Fuel Pump Fits Many Vehicles' }, 'identifier_not_in_title'],
  ];
  for (const [overrides, expected] of cases) {
    assert.equal(exclusionReason(goodItem(overrides), 'FE0415'), expected, JSON.stringify(overrides));
  }
});

test('exclusionReason tolerates punctuation differences in the part number', () => {
  assert.equal(exclusionReason(goodItem({ title: 'Delphi FE-0415 Fuel Pump' }), 'FE0415'), null);
});

test('landedPrice adds shipping so comparables are compared as a buyer sees them', () => {
  const result = landedPrice(goodItem({
    price: { value: '40.00', currency: 'USD' },
    shippingOptions: [{ shippingCost: { value: '9.99', currency: 'USD' } }],
  }));
  assert.equal(result.price, 40);
  assert.equal(result.shipping, 9.99);
  assert.equal(result.landed, 49.99);
});

test('median handles odd and even counts', () => {
  assert.equal(median([10, 30, 20]), 20);
  assert.equal(median([10, 20, 30, 40]), 25);
  assert.equal(median([]), null);
});

test('trimOutliers drops prices far from the first-pass median', () => {
  const comparables = [3.5, 44, 46, 48, 52, 900].map((landed) => ({ landed }));
  const { kept, dropped } = trimOutliers(comparables);
  assert.deepEqual(kept.map((entry) => entry.landed), [44, 46, 48, 52]);
  assert.deepEqual(dropped.map((entry) => entry.landed), [3.5, 900]);
});

test('trimOutliers keeps the original set when trimming would drop below three comparables', () => {
  const comparables = [10, 90, 200].map((landed) => ({ landed }));
  const { kept, dropped } = trimOutliers(comparables);
  assert.equal(kept.length, 3);
  assert.equal(dropped.length, 0);
});

test('friendlyRound lands on buyer-friendly .99 amounts', () => {
  assert.equal(friendlyRound(3.2), 2.99);
  assert.equal(friendlyRound(12.3), 11.99);
  assert.equal(friendlyRound(47.3), 46.99);
  assert.equal(friendlyRound(247), 244.99);
  assert.equal(friendlyRound(0), null);
  assert.equal(friendlyRound(Number.NaN), null);
});

test('evaluateAttempt splits qualifying comparables from exclusions', () => {
  const items = [
    goodItem({ itemId: '1', price: { value: '44.00', currency: 'USD' } }),
    goodItem({ itemId: '2', price: { value: '48.00', currency: 'USD' } }),
    goodItem({ itemId: '3', title: 'Delphi FE0415 Fuel Pump USED', price: { value: '20.00', currency: 'USD' } }),
    goodItem({ itemId: '4', buyingOptions: ['AUCTION'], price: { value: '9.00', currency: 'USD' } }),
  ];
  const { comparables, excluded, rawCount } = evaluateAttempt({ matchToken: 'FE0415' }, items);
  assert.equal(rawCount, 4);
  assert.deepEqual(comparables.map((entry) => entry.itemId), ['1', '2']);
  assert.deepEqual(excluded.map((entry) => entry.reason), ['condition_keyword_in_title', 'auction_listing']);
});

test('buildAttempts orders identifiers strongest-first and falls back to interchange', () => {
  const attempts = buildAttempts({ upc: '689604189993', ean: '', brand: 'Delphi', mpn: 'FE0415', oem: 'E3902M' });
  assert.deepEqual(attempts.map((attempt) => attempt.method), [
    'ebay_browse_active_gtin_exact',
    'ebay_browse_active_brand_mpn',
    'ebay_browse_active_mpn',
    'ebay_browse_active_oe_interchange',
  ]);
  assert.deepEqual(attempts[0].params, { gtin: '689604189993' });
});

test('pricingColumns emits all thirteen required columns', () => {
  const columns = pricingColumns({
    listPrice: 46.99, low: 44, high: 52, medianPrice: 48, recommended: 46.99,
    comparables: [{ url: 'https://www.ebay.com/itm/1?amdata=abc' }],
    method: 'ebay_browse_active_brand_mpn', confidence: 'high',
    checkedAt: '2026-09-20T00:00:00.000Z', status: 'pricing_verified_comparable',
    notes: ['note one', 'note two'],
  });
  assert.deepEqual(Object.keys(columns).sort(), [...PRICING_COLUMNS].sort());
  assert.equal(columns['List Price'], '46.99');
  assert.equal(columns.Currency, 'USD');
  assert.equal(columns['Comparable Count'], '1');
  assert.equal(columns['Pricing Source URLs'], 'https://www.ebay.com/itm/1', 'tracking query string is stripped');
  assert.equal(columns['Pricing Notes'], 'note one note two');
});

test('pricingColumns leaves price cells empty for a pending row', () => {
  const columns = pricingColumns({
    listPrice: null, low: null, high: null, medianPrice: null, recommended: null,
    comparables: [], method: 'none', confidence: 'none',
    checkedAt: '2026-09-20T00:00:00.000Z', status: 'pricing_pending', notes: ['no comps'],
  });
  assert.equal(columns['List Price'], '');
  assert.equal(columns['Recommended Price'], '');
  assert.equal(columns.Currency, 'USD');
  assert.equal(columns['Pricing Status'], 'pricing_pending');
});

const result = (overrides) => ({
  sku: 'SKU-1', brand: 'Delphi', category: 'Fuel Pumps', mpn: 'FE0415',
  identifierConflict: false, comparables: [{ landed: 48 }], method: 'ebay_browse_active_brand_mpn',
  confidence: 'high', status: 'pricing_verified_comparable', listPrice: 46.99, recommended: 46.99,
  notes: [], ...overrides,
});

test('isPublishReady enforces the publish-ready pricing criteria', () => {
  assert.equal(isPublishReady(result()), true);
  assert.equal(isPublishReady(result({ method: 'catalog_msrp_derived', comparables: [], status: 'pricing_estimated_msrp', confidence: 'low' })), true);
  assert.equal(isPublishReady(result({ status: 'pricing_pending', listPrice: null, confidence: 'none', comparables: [] })), false);
  assert.equal(isPublishReady(result({ status: 'manual_pricing_review', confidence: 'low' })), false);
  assert.equal(isPublishReady(result({ identifierConflict: true })), false);
  assert.equal(isPublishReady(result({ listPrice: null })), false);
});

test('buildReport separates unevaluated rows from genuine no-comparable rows', () => {
  const report = buildReport([
    result({ sku: 'SKU-A', status: 'pricing_pending', method: 'none', comparables: [], confidence: 'none', listPrice: null, recommended: null, lookupFailed: false, notes: ['no comps'] }),
    result({ sku: 'SKU-B', status: 'pricing_pending', method: 'lookup_rate_limited', comparables: [], confidence: 'none', listPrice: null, recommended: null, lookupFailed: true, notes: ['NOT EVALUATED — eBay returned HTTP 429'] }),
    result({ sku: 'SKU-C', status: 'pricing_pending', method: 'lookup_rate_limited', comparables: [], confidence: 'none', listPrice: null, recommended: null, lookupFailed: true, notes: ['NOT EVALUATED — eBay returned HTTP 429'] }),
  ]);
  assert.equal(report.totals.missingDefensiblePrice, 3);
  assert.equal(report.totals.notEvaluatedLookupFailed, 2, 'rate-limited rows must not be counted as searched');
  assert.equal(report.totals.missingAfterRealSearch, 1);
  assert.equal(report.totals.publishReady, 0);
});

test('buildReport produces every bucket the validation report requires', () => {
  const report = buildReport([
    result(),
    result({ sku: 'SKU-2', brand: 'Mevotech', recommended: 89.99, listPrice: 89.99 }),
    result({ sku: 'SKU-3', method: 'ebay_browse_active_oe_interchange', confidence: 'medium', recommended: 20.99, listPrice: 20.99 }),
    result({ sku: 'SKU-4', method: 'catalog_msrp_derived', comparables: [], status: 'pricing_estimated_msrp', confidence: 'low', recommended: 30.99, listPrice: 30.99 }),
    result({ sku: 'SKU-5', method: 'none', comparables: [], status: 'pricing_pending', confidence: 'none', recommended: null, listPrice: null, notes: ['no comps'] }),
    result({ sku: 'SKU-6', status: 'manual_pricing_review', confidence: 'low', identifierConflict: true, notes: ['identifier conflict'] }),
  ]);

  assert.equal(report.totals.rows, 6);
  assert.equal(report.totals.verifiedPrices, 3);
  assert.equal(report.totals.pricedFromExactMpnComparables, 3);
  assert.equal(report.totals.pricedFromComparableParts, 1);
  assert.equal(report.totals.pricedFromMsrp, 1);
  assert.equal(report.totals.missingDefensiblePrice, 1);
  assert.equal(report.totals.manualPricingReview, 1);
  assert.equal(report.totals.identifierConflicts, 1);
  assert.equal(report.totals.publishReady, 4);

  const delphi = report.recommendedByBrand.find((entry) => entry.name === 'Delphi');
  assert.equal(delphi.priced, 4, 'the pending row carries no recommended price');
  assert.equal(delphi.min, 20.99);
  assert.equal(delphi.max, 46.99);
  assert.equal(delphi.median, 38.99);
  assert.equal(report.pendingSkus[0].sku, 'SKU-5');
  assert.equal(report.manualReviewSkus[0].sku, 'SKU-6');
});

test('web-search methods count as exact-MPN / MSRP pricing, and condition conflicts are reported', () => {
  const report = buildReport([
    result({ sku: 'W1', method: 'web_search_exact_mpn' }),
    result({ sku: 'W2', method: 'web_search_msrp', status: 'pricing_estimated_msrp', confidence: 'low' }),
    result({ sku: 'W3', method: 'none', comparables: [], status: 'manual_pricing_review', confidence: 'low', listPrice: null, recommended: null, conditionConflict: true }),
  ]);
  assert.equal(report.totals.pricedFromExactMpnComparables, 1);
  assert.equal(report.totals.pricedFromMsrp, 1);
  assert.equal(report.totals.conditionConflicts, 1);
  assert.equal(report.totals.publishReady, 2, 'a web MSRP row with a source is publish-ready; a condition conflict is not');
});

test('the review queue lists manual-review rows with a hint and clickable evidence', () => {
  const queue = buildReviewQueue([
    result({ sku: 'OK-1' }),
    result({
      sku: 'REV-1', status: 'manual_pricing_review', confidence: 'low', method: 'web_search_exact_mpn',
      recommended: 119.99, low: 94.88, high: 141.39, comparables: [],
      excluded: [
        { url: 'https://www.carid.com/skf/grw25.html?x=1', price: 117.7, reason: 'page_check_failed:http_403' },
        { url: 'https://shop.example.com/rem', price: 108.97, reason: 'condition_not_new:remanufactured' },
        { url: 'https://junk.example.com', price: 5, reason: 'foreign_currency' },
      ],
      notes: ['1 source(s) could not be confirmed.', 'Prices come from web search (active retail pages).'],
    }),
    result({ sku: 'CC-1', status: 'manual_pricing_review', conditionConflict: true, recommended: null, comparables: [], excluded: [], notes: ['Found only remanufactured.'] }),
  ]);
  assert.deepEqual(queue.map((row) => row.SKU), ['REV-1', 'CC-1']);
  const rev = queue[0];
  assert.equal(rev['Price Hint (USD)'], '119.99');
  assert.match(rev['Unverified Claimed URLs'], /carid\.com\/skf\/grw25\.html \(\$117\.7; unverified: http_403\)/, 'tracking query strings are stripped');
  assert.match(rev['Unverified Claimed URLs'], /remanufactured/);
  assert.doesNotMatch(rev['Unverified Claimed URLs'], /junk\.example/, 'plainly rejected junk is not offered to the reviewer');
  assert.doesNotMatch(rev.Reason, /Prices come from web search/);
  assert.equal(queue[1]['Condition Conflict'], 'yes');
  assert.equal(queue[1]['Price Hint (USD)'], '');
  assert.deepEqual(Object.keys(rev), REVIEW_QUEUE_HEADERS);
});

test('web overlay fills only rows Browse could not price, and never mutates the Browse record', () => {
  const browse = new Map([
    [0, { index: 0, sku: 'PRICED', status: 'pricing_verified_comparable', lookupFailed: false, source: 'browse' }],
    [1, { index: 1, sku: 'MISS', status: 'pricing_pending', lookupFailed: false, source: 'browse' }],
    [2, { index: 2, sku: 'UNEVALUATED', status: 'pricing_pending', lookupFailed: true, source: 'browse' }],
    [3, { index: 3, sku: 'UNEVALUATED-2', status: 'pricing_pending', lookupFailed: true, source: 'browse' }],
  ]);
  const web = [
    { index: 0, status: 'pricing_verified_comparable', source: 'web_search' },   // Browse already priced it
    { index: 1, status: 'manual_pricing_review', source: 'web_search' },         // fills a genuine miss
    { index: 2, status: 'pricing_verified_comparable', source: 'web_search' },   // fills an unevaluated row
    { index: 3, status: 'pricing_pending', source: 'web_search' },               // web found nothing
  ];
  const { merged, overlaid } = overlayWebResults(browse, web);

  assert.equal(overlaid, 2);
  assert.equal(merged.get(0).source, 'browse', 'a structured Browse price always wins');
  assert.equal(merged.get(1).source, 'web_search');
  assert.equal(merged.get(2).source, 'web_search');
  assert.equal(merged.get(3).source, 'browse', 'an empty web result never replaces a Browse row');
  assert.equal(merged.get(3).lookupFailed, true);

  // The regression this guards: persisting the merged view erased lookupFailed, so a
  // later --retry-failed skipped rows that eBay had never evaluated.
  assert.equal(browse.get(2).source, 'browse', 'the Browse map itself is untouched');
  assert.equal(browse.get(2).lookupFailed, true, 'row 2 must still be retried once the quota resets');
  assert.deepEqual([...browse.values()].filter((r) => r.lookupFailed).map((r) => r.index), [2, 3]);
});

/* ── comparable relevance: a part number alone is not the right product ───── */

const BRAND_MPN = { method: 'ebay_browse_active_brand_mpn', brand: 'Napa', partType: 'Air Filter' };

test('the real wrong-product comparables that slipped through are rejected', () => {
  // NAPA 22385 air filter was priced from LEGO tiles; NAPA 18972 muffler from torque rods and a diecast car.
  const airFilter = { method: 'ebay_browse_active_mpn', brand: 'Napa', partType: 'Air Filter' };
  for (const junk of ['LEGO x 22 Dark Bluish Gray Tile, Modified 2 x 3 Pentagonal 22385', '22385 LEGO Parts Tile Modified 2x3 Pentagonal WHITE (2)']) {
    assert.equal(relevanceReason(junk, airFilter), 'brand_not_named', junk);
  }
  const muffler = { method: 'ebay_browse_active_mpn', brand: 'Napa', partType: 'Muffler' };
  for (const junk of ['24.2" Torque Rod Assembly for Freightner Fits 16-15632-000, 16-18972-000', '1967 CHEVY CAMARO Z/28 TRANS AM 1/18 DIECAST CAR GMP 18972']) {
    assert.equal(relevanceReason(junk, muffler), 'brand_not_named', junk);
  }
});

test('genuine comparables name the brand', () => {
  assert.equal(relevanceReason('NAPA 22385 ProSelect Commercial Air Filter - PA4163', BRAND_MPN), null);
  assert.equal(relevanceReason('Frt Hub Assy  SKF  BR930658', { method: 'ebay_browse_active_brand_mpn', brand: 'Skf', partType: 'Wheel Bearing & Hub Assembly' }), null);
});

test('same number and same kind of part is NOT enough: another manufacturer\'s product is a different product', () => {
  // The real collisions: a Spectra/Monroe/other-brand part sharing NAPA's number and part type.
  const radiator = { method: 'ebay_browse_active_mpn', brand: 'Napa', partType: 'Radiator' };
  assert.equal(relevanceReason('Radiator CU2101 for 87-06 Jeep Wrangler Spectra Premium', radiator), 'brand_not_named');
  const shock = { method: 'ebay_browse_active_brand_mpn', brand: 'Napa', partType: 'Shock Absorber' };
  assert.equal(relevanceReason('Monroe 37322 Shock Absorber Front Hyundai Santa Fe', shock), 'brand_not_named');
  assert.equal(relevanceReason('Wheel Bearing and Hub Assembly BR930658', { method: 'ebay_browse_active_mpn', brand: 'Skf', partType: 'Wheel Bearing & Hub Assembly' }), 'brand_not_named', 'even a perfect part-type match without the brand is rejected');
});

test('a part-type word alone never qualifies a brand-less listing', () => {
  assert.equal(relevanceReason('22385 Air Compressor Fitting', { method: 'ebay_browse_active_mpn', brand: 'Napa', partType: 'Air Filter' }), 'brand_not_named');
});

test('an OE/interchange number needs the part type, since the brand is another manufacturer', () => {
  const oe = { method: 'ebay_browse_active_oe_interchange', brand: 'Napa', partType: 'Shock Absorber' };
  for (const junk of ['2pc Berliss Bearing Co. Bearing HP 94336 NEW IN BOX', 'Thetford Marine 94336 Electrical Hatch', 'Dayco Automotive Engine Timing Belt 94336']) {
    assert.equal(relevanceReason(junk, oe), 'not_relevant_part_type', junk);
  }
  assert.equal(relevanceReason('Monroe 94336 Shock Absorber Front', oe), null);
});

test('a GTIN match identifies the product outright and is not second-guessed', () => {
  assert.equal(relevanceReason('Completely unrelated wording', { method: 'ebay_browse_active_gtin_exact', brand: 'Napa', partType: 'Air Filter' }), null);
});

test('exclusionReason applies relevance for live searches, with the reason recorded', () => {
  const lego = goodItem({ title: 'LEGO Parts Tile Modified 2x3 Pentagonal 22385', price: { value: '10.08', currency: 'USD' } });
  assert.equal(exclusionReason(lego, '22385', BRAND_MPN), 'brand_not_named');
  assert.equal(exclusionReason(lego, '22385'), null, 'no context, no relevance check (existing callers are unaffected)');
});

test('partTypeTokens drops filler and normalizes plurals', () => {
  assert.deepEqual(partTypeTokens('Wheel Bearing & Hub Assembly'), ['wheel', 'bearing', 'hub']);
  assert.deepEqual(partTypeTokens('Brake Pads'), ['brake', 'pad']);
  assert.deepEqual(partTypeTokens('Stabilizer Bar Link Kit'), ['stabilizer', 'bar', 'link']);
});

/* ── offline re-derivation ────────────────────────────────────────────────── */

const comp = (title, landed) => ({ itemId: title.slice(0, 6), title, price: landed, shipping: 0, landed, seller: 's', url: 'https://www.ebay.com/itm/1' });
const stored = (overrides = {}) => ({
  index: 5, sourceRow: 7, sku: 'NAPA-22385', brand: 'Napa', mpn: '22385', upc: '1', ean: '', oem: '', category: 'Filters', partType: 'Air Filter',
  identifierConflict: false, lookupFailed: false, checkedAt: '2026-09-21T00:00:00.000Z',
  method: 'ebay_browse_active_mpn', query: '22385', rawCount: 20, excluded: [], droppedOutliers: [],
  comparables: [
    comp('NAPA 22385 ProSelect Air Filter', 18), comp('NAPA 22385 Air Filter PA4163', 20), comp('Napa Proselect Air Filter 22385', 22), comp('NAPA Air Filter 22385 fits Chevy', 19),
    comp('22385 LEGO Parts Tile Modified 2x3 WHITE', 10.08), comp('LEGO x 22 Dark Bluish Gray Tile 22385', 12.5), comp('22385 LEGO Parts Tile BLACK', 10.08),
  ],
  status: 'pricing_verified_comparable', confidence: 'medium', low: 10.08, high: 22, medianPrice: 18, recommended: 17.99, listPrice: 17.99, notes: ['old note'],
  ...overrides,
});

test('refilter removes wrong-product comparables and recomputes the price from the rest', () => {
  const next = refilterResult(stored());
  assert.equal(next.comparables.length, 4);
  assert.equal(next.low, 18);
  assert.equal(next.high, 22);
  assert.equal(next.medianPrice, 19.5);
  assert.equal(next.recommended, 18.99, 'median 19.5 x 0.97 = 18.9, buyer-friendly');
  assert.equal(next.status, 'pricing_verified_comparable');
  assert.match(next.notes[0], /Re-filtered: 3 of 7/);
  assert.equal(next.index, 5);
  assert.equal(next.sku, 'NAPA-22385');
  assert.ok(next.excluded.some((e) => e.reason === 'brand_not_named'));
});

test('refilter downgrades a row that was priced only from wrong products', () => {
  const junkOnly = stored({ comparables: [comp('22385 LEGO Parts Tile WHITE', 10), comp('LEGO Tile 22385 BLACK', 11), comp('22385 LEGO Parts Tile RED', 12)] });
  const next = refilterResult(junkOnly);
  assert.equal(next.status, 'pricing_pending');
  assert.equal(next.recommended, null);
  assert.equal(next.listPrice, null);
  assert.equal(next.method, 'none');
});

test('refilter sends a row with too few relevant comparables to manual review', () => {
  const few = stored({ comparables: [comp('NAPA 22385 Air Filter', 18), comp('NAPA Air Filter 22385', 20), comp('22385 LEGO Tile', 10), comp('22385 LEGO Tile 2', 11)] });
  const next = refilterResult(few);
  assert.equal(next.status, 'manual_pricing_review');
  assert.equal(next.comparables.length, 2);
});

test('refilter is idempotent and leaves untouchable rows alone', () => {
  const once = refilterResult(stored());
  assert.equal(refilterResult(once), once, 'a second pass changes nothing');
  const gtin = stored({ method: 'ebay_browse_active_gtin_exact' });
  assert.equal(refilterResult(gtin), gtin);
  const web = stored({ source: 'web_search' });
  assert.equal(refilterResult(web), web);
  const unevaluated = stored({ lookupFailed: true, method: 'lookup_rate_limited', comparables: [] });
  assert.equal(refilterResult(unevaluated), unevaluated);
  const clean = stored({ comparables: stored().comparables.slice(0, 4) });
  assert.equal(refilterResult(clean), clean, 'a row whose comparables all pass is returned unchanged');
});

test('refilter also considers outlier-dropped comparables, since they were valid candidates', () => {
  const s = stored({ comparables: stored().comparables.slice(0, 2), droppedOutliers: stored().comparables.slice(2, 4) });
  const next = refilterResult({ ...s, comparables: [...s.comparables, comp('22385 LEGO Tile', 9)] });
  assert.equal(next.comparables.length, 4, 'kept + dropped relevant comparables are all reconsidered');
});
