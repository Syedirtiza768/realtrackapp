#!/usr/bin/env node
/**
 * price-enrich-catalog.mjs — pricing enrichment stage for the NAPA -> eBay pipeline.
 *
 * Runs after fitment enrichment and before `create-partsbazar360-csv.mjs`.
 *
 * Comparable source: eBay Browse API `item_summary/search` (ACTIVE fixed-price
 * NEW listings). The account grant is `buy.browse` only — the Marketplace
 * Insights API (sold/completed listings) is NOT available, so no output of this
 * stage may claim sold-comp verification. Every row records the method actually
 * used so the distinction stays auditable:
 *
 *   ebay_browse_active_gtin_exact      comps matched on exact UPC/EAN
 *   ebay_browse_active_brand_mpn       comps matched on brand + exact MPN in title
 *   ebay_browse_active_mpn             comps matched on exact MPN in title
 *   ebay_browse_active_oe_interchange  comps matched on the OE/interchange number
 *   catalog_msrp_derived               no comps; priced down from catalog MSRP
 *   none                               no defensible price (row preserved)
 *
 * Outputs (into --output-dir):
 *   <stem>.priced.csv                          source CSV + the 13 pricing columns
 *   napa_pricing_evidence.json                 per-row comps, exclusions, stats
 *   <stem>.pricing.manifest.json               run manifest
 *   partsbazar360-pricing-validation-report.md pricing validation report
 *   partsbazar360-pricing-validation-report.json
 * and patches `*StartPrice` / `Pricing Status` into the eBay File Exchange
 * listings-ready CSV when one exists.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import axios from 'axios';
import dotenv from 'dotenv';

const ROOT = process.env.PIPELINE_ROOT || '/app';
dotenv.config({ path: path.join(ROOT, '.env') });

const OUTPUT_DIR = process.env.PRICING_OUTPUT_DIR || `${ROOT}/output/ebay-pipeline`;
const INPUT = process.env.PRICING_INPUT || `${OUTPUT_DIR}/napa_ebay_shopify_listings.complete-fitment-enriched.csv`;
const READY = process.env.PRICING_READY_CSV || `${OUTPUT_DIR}/napa_ebay_shopify_listings.complete.ebay-listings-ready.csv`;
const IMPORT_ID = process.env.CATALOG_IMPORT_ID || '31fe3770-48c8-4667-9351-af4a1fad99ad';

const CURRENCY = String(process.env.PRICING_CURRENCY || 'USD').toUpperCase();
const MARKETPLACE = process.env.PRICING_MARKETPLACE || 'EBAY_US';
/** Recommended price = median comparable * this. Slight undercut of the median. */
const MEDIAN_MULTIPLIER = Number(process.env.PRICING_MEDIAN_MULTIPLIER || 0.97);
/** MSRP fallback discount when no comparables exist at all. */
const MSRP_MULTIPLIER = Number(process.env.PRICING_MSRP_MULTIPLIER || 0.9);
/** Methodology floor: "use at least three relevant comparables whenever available". */
const MIN_COMPARABLES = Number(process.env.PRICING_MIN_COMPARABLES || 3);
/** high/low ratio above this is treated as an unusable spread -> manual review. */
const MAX_DISPERSION = Number(process.env.PRICING_MAX_DISPERSION || 6);
const MIN_COMP_PRICE = Number(process.env.PRICING_MIN_COMP_PRICE || 1);
const MIN_SELLER_FEEDBACK_PERCENT = Number(process.env.PRICING_MIN_SELLER_FEEDBACK_PERCENT || 95);
const MIN_SELLER_FEEDBACK_SCORE = Number(process.env.PRICING_MIN_SELLER_FEEDBACK_SCORE || 50);
const CONCURRENCY = Number(process.env.PRICING_CONCURRENCY || 4);
const MAX_SOURCE_URLS = 5;
const WEB_EVIDENCE_FILE = 'napa_web_pricing_evidence.json';
const REVIEW_QUEUE_FILE = 'partsbazar360-pricing-review-queue.csv';

const API_BASE = String(process.env.EBAY_ENVIRONMENT || 'PRODUCTION').toUpperCase() === 'PRODUCTION'
  ? 'https://api.ebay.com'
  : 'https://api.sandbox.ebay.com';
const BROWSE_FILTER = 'conditions:{NEW},buyingOptions:{FIXED_PRICE}';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const http = axios.create({ timeout: 30000 });

/* ── CLI ─────────────────────────────────────────────────────────────────── */

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--csv') out.csv = argv[++i];
    else if (argv[i] === '--output-dir') out.outputDir = argv[++i];
    else if (argv[i] === '--ready-csv') out.readyCsv = argv[++i];
    else if (argv[i] === '--import-id') out.importId = argv[++i];
    else if (argv[i] === '--limit') out.limit = Number(argv[++i]);
    else if (argv[i] === '--offset') out.offset = Number(argv[++i]);
    else if (argv[i] === '--no-db') out.noDb = true;
    else if (argv[i] === '--report-only') out.reportOnly = true;
    else if (argv[i] === '--retry-failed') out.retryFailed = true;
    else if (argv[i] === '--refilter') out.refilter = true;
  }
  return out;
}

/* ── CSV ─────────────────────────────────────────────────────────────────── */

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  const source = text.replace(/^﻿/, '');
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((entry) => entry.some((cellValue) => String(cellValue).trim()));
}
function csvCell(input) {
  const text = input == null ? '' : String(input);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function writeCsv(target, rows, headers) {
  const lines = [headers.map((header) => csvCell(header)).join(',')];
  for (const row of rows) lines.push(headers.map((header) => csvCell(row[header] ?? '')).join(','));
  fs.writeFileSync(target, `${lines.join('\n')}\n`);
}
function normalizeHeader(input) { return String(input || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function value(row, ...names) {
  const keys = Object.keys(row);
  for (const name of names) {
    const key = keys.find((candidate) => normalizeHeader(candidate) === normalizeHeader(name));
    if (key && String(row[key] ?? '').trim()) return String(row[key]).trim();
  }
  return '';
}
function compact(text) { return String(text || '').toUpperCase().replace(/[\s\-_.\\/]+/g, ''); }

/* ── Comparable qualification ────────────────────────────────────────────── */

const BUNDLE_PATTERN = /\b(?:lot|set|pack|bundle|kit)\s+of\s+\d+|\b\d+\s*(?:pcs|pce|pieces|pack)\b|\bqty\s*\d+\b|\bwholesale\b/i;
const CONDITION_PATTERN = /\b(?:used|pre[-\s]?owned|open[-\s]?box|refurb\w*|remanufactured|reman|core charge|for parts|not working|as[-\s]?is|damaged|scratch(?:ed)?|dented|salvage|broken)\b/i;

/**
 * A part number alone is not evidence of the right product: "22385" also names a LEGO
 * tile, "18972" a Freightliner torque rod and a 1:18 Camaro. A comparable must ALSO
 * look like the same kind of part — its title names the brand, or enough of the part
 * type. (An OE/interchange number belongs to another manufacturer, so brand cannot
 * apply there; the part type is required instead.)
 */
const PART_TYPE_STOP_WORDS = new Set(['and', 'the', 'for', 'with', 'kit', 'set', 'assembly', 'assy', 'end', 'pair', 'new', 'oem', 'pro']);

export function partTypeTokens(partType) {
  const words = String(partType || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !PART_TYPE_STOP_WORDS.has(w));
  return [...new Set(words.map((w) => w.replace(/s$/, '')))];
}

export function titleMentionsBrand(title, brand) {
  const name = String(brand || '').trim().toLowerCase();
  if (!name) return false;
  return new RegExp(`(?<![a-z0-9])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`, 'i').test(String(title || ''));
}

export function partTypeHits(title, partType) {
  const words = new Set(String(title || '').toLowerCase().split(/[^a-z0-9]+/).map((w) => w.replace(/s$/, '')));
  return partTypeTokens(partType).filter((token) => words.has(token)).length;
}

/** null when the title plausibly names this kind of part; otherwise a reason. */
export function relevanceReason(title, ctx) {
  if (!ctx || !ctx.method) return null;
  const tokens = partTypeTokens(ctx.partType);
  const need = Math.min(2, tokens.length);
  const partTypeOk = need === 0 ? true : partTypeHits(title, ctx.partType) >= need;
  if (ctx.method === 'ebay_browse_active_oe_interchange') return partTypeOk ? null : 'not_relevant_part_type';
  if (ctx.method === 'ebay_browse_active_brand_mpn' || ctx.method === 'ebay_browse_active_mpn') {
    // The BRAND must be named. Accepting "same number and same kind of part" let other manufacturers'
    // products price house-brand rows: 85 of 132 priced Napa rows had no comparable naming NAPA at all
    // (NAPA-CU2101 and NAPA-37322 were priced, and given fitment, from other brands' parts that share
    // the number). A brand-less comparable is a different product until shown otherwise.
    return titleMentionsBrand(title, ctx.brand) ? null : 'brand_not_named';
  }
  return null; // a GTIN match identifies the product outright
}

/**
 * Decide whether one Browse item summary is a usable comparable.
 * Returns null when it qualifies, or a short exclusion reason.
 */
function exclusionReason(item, matchToken, ctx) {
  const title = String(item?.title || '');
  const priceValue = Number(item?.price?.value);
  if (!Number.isFinite(priceValue)) return 'no_price';
  if (String(item?.price?.currency || '').toUpperCase() !== CURRENCY) return 'foreign_currency';
  if (priceValue < MIN_COMP_PRICE) return 'price_below_floor';
  if (item?.itemGroupType) return 'multi_variation_listing';
  const buyingOptions = Array.isArray(item?.buyingOptions) ? item.buyingOptions : [];
  if (buyingOptions.length && !buyingOptions.includes('FIXED_PRICE')) return 'auction_listing';
  const conditionId = String(item?.conditionId || '');
  if (conditionId && conditionId !== '1000') return 'condition_not_new';
  if (CONDITION_PATTERN.test(title)) return 'condition_keyword_in_title';
  if (BUNDLE_PATTERN.test(title)) return 'bundle_or_lot';
  if (matchToken && !compact(title).includes(compact(matchToken))) return 'identifier_not_in_title';
  const irrelevant = relevanceReason(title, ctx);
  if (irrelevant) return irrelevant;
  const feedbackPercent = Number(item?.seller?.feedbackPercentage);
  const feedbackScore = Number(item?.seller?.feedbackScore);
  if (Number.isFinite(feedbackPercent) && feedbackPercent < MIN_SELLER_FEEDBACK_PERCENT) return 'seller_feedback_percent';
  if (Number.isFinite(feedbackScore) && feedbackScore < MIN_SELLER_FEEDBACK_SCORE) return 'seller_feedback_volume';
  return null;
}

/** Landed price: comps are compared shipping-inclusive, as a buyer sees them. */
function landedPrice(item) {
  const price = Number(item?.price?.value);
  const options = Array.isArray(item?.shippingOptions) ? item.shippingOptions : [];
  let shipping = 0;
  for (const option of options) {
    const cost = Number(option?.shippingCost?.value);
    if (Number.isFinite(cost)) { shipping = cost; break; }
  }
  return { price, shipping, landed: Math.round((price + shipping) * 100) / 100 };
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const result = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.round(result * 100) / 100;
}

/** Drop comps far away from the first-pass median (mispriced/accessory noise). */
function trimOutliers(comparables) {
  if (comparables.length < 3) return { kept: comparables, dropped: [] };
  const first = median(comparables.map((entry) => entry.landed));
  const low = first * 0.4;
  const high = first * 2.5;
  const kept = comparables.filter((entry) => entry.landed >= low && entry.landed <= high);
  const dropped = comparables.filter((entry) => entry.landed < low || entry.landed > high);
  return kept.length >= 3 ? { kept, dropped } : { kept: comparables, dropped: [] };
}

/** Round to a buyer-friendly amount (….99). */
function friendlyRound(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const rounded = amount < 100
    ? Math.max(1, Math.round(amount)) - 0.01
    : Math.max(5, Math.round(amount / 5) * 5) - 0.01;
  return Math.round(rounded * 100) / 100;
}

function money(amount) {
  return Number.isFinite(amount) ? amount.toFixed(2) : '';
}
function cleanUrl(url) {
  const text = String(url || '');
  const cut = text.indexOf('?');
  return cut === -1 ? text : text.slice(0, cut);
}

/* ── eBay Browse ─────────────────────────────────────────────────────────── */

let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + 320;
  if (slot > now) await sleep(slot - now);
}
async function ebayToken() {
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID || ''}:${process.env.EBAY_CLIENT_SECRET || ''}`).toString('base64');
  const response = await http.post(
    `${API_BASE}/identity/v1/oauth2/token`,
    'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    { headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' } },
  );
  return response.data.access_token;
}
/**
 * Returns `{ items, rateLimited }`. `rateLimited` must be propagated: a search
 * that eBay refused is NOT the same as a search that found nothing, and pricing
 * a row as "no comparables exist" off a 429 would be a silent fabrication.
 */
async function browseSearch(token, params) {
  let rateLimited = false;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await throttle();
    try {
      const response = await http.get(`${API_BASE}/buy/browse/v1/item_summary/search`, {
        params: { limit: 50, fieldgroups: 'MATCHING_ITEMS', filter: BROWSE_FILTER, ...params },
        headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE, Accept: 'application/json' },
      });
      return { items: Array.isArray(response.data?.itemSummaries) ? response.data.itemSummaries : [], rateLimited: false };
    } catch (error) {
      const status = Number(error?.response?.status);
      if (status === 429) { rateLimited = true; await sleep(1500 * (attempt + 1)); continue; }
      if (status >= 500 && status < 600) { await sleep(1500 * (attempt + 1)); continue; }
      return { items: [], rateLimited: false };
    }
  }
  return { items: [], rateLimited };
}

/* ── Pricing ─────────────────────────────────────────────────────────────── */

function buildAttempts(row) {
  const attempts = [];
  const context = (method) => ({ method, brand: row.brand, partType: row.partType });
  if (row.upc) attempts.push({ method: 'ebay_browse_active_gtin_exact', query: row.upc, params: { gtin: row.upc }, matchToken: row.mpn, context: context('ebay_browse_active_gtin_exact') });
  if (row.ean && row.ean !== row.upc) attempts.push({ method: 'ebay_browse_active_gtin_exact', query: row.ean, params: { gtin: row.ean }, matchToken: row.mpn, context: context('ebay_browse_active_gtin_exact') });
  if (row.brand && row.mpn) attempts.push({ method: 'ebay_browse_active_brand_mpn', query: `${row.brand} ${row.mpn}`, params: { q: `${row.brand} ${row.mpn}` }, matchToken: row.mpn, context: context('ebay_browse_active_brand_mpn') });
  if (row.mpn) attempts.push({ method: 'ebay_browse_active_mpn', query: row.mpn, params: { q: row.mpn }, matchToken: row.mpn, context: context('ebay_browse_active_mpn') });
  if (row.oem) attempts.push({ method: 'ebay_browse_active_oe_interchange', query: row.oem, params: { q: row.oem }, matchToken: row.oem, context: context('ebay_browse_active_oe_interchange') });
  return attempts;
}

function evaluateAttempt(attempt, items) {
  const comparables = [];
  const excluded = [];
  for (const item of items) {
    const reason = exclusionReason(item, attempt.matchToken, attempt.context);
    const { price, shipping, landed } = landedPrice(item);
    if (reason) {
      if (excluded.length < 10) excluded.push({ itemId: item?.itemId || '', title: item?.title || '', price: Number.isFinite(price) ? price : null, reason });
      continue;
    }
    comparables.push({
      itemId: item?.itemId || '',
      title: item?.title || '',
      price,
      shipping,
      landed,
      seller: item?.seller?.username || '',
      sellerFeedbackPercent: Number(item?.seller?.feedbackPercentage) || null,
      url: item?.itemWebUrl || '',
    });
  }
  return { comparables, excluded, rawCount: items.length };
}

/**
 * Price one row. Walks identifier attempts strongest-first and stops at the
 * first that clears MIN_COMPARABLES; otherwise keeps the widest partial set.
 */
async function priceRow(token, row, msrp) {
  const attempts = buildAttempts(row);
  let best = null;
  let identifierConflict = false;
  let rateLimited = false;

  for (const attempt of attempts) {
    const search = await browseSearch(token, attempt.params);
    const items = search.items;
    if (search.rateLimited) rateLimited = true;
    const evaluated = evaluateAttempt(attempt, items);

    // A GTIN that resolves to listings which do not carry our MPN is an
    // identifier conflict, not a comparable set.
    if (attempt.method === 'ebay_browse_active_gtin_exact' && row.mpn && items.length >= 3) {
      const withMpn = items.filter((item) => compact(item?.title || '').includes(compact(row.mpn))).length;
      if (withMpn / items.length < 0.5) identifierConflict = true;
    }

    const candidate = { ...attempt, ...evaluated };
    if (!best || candidate.comparables.length > best.comparables.length) best = candidate;
    if (candidate.comparables.length >= MIN_COMPARABLES) break;
  }

  const checkedAt = new Date().toISOString();
  const baseEvidence = {
    sku: row.sku, brand: row.brand, mpn: row.mpn, upc: row.upc, ean: row.ean, oem: row.oem,
    category: row.category, partType: row.partType, identifierConflict, checkedAt,
    lookupFailed: false,
  };

  // eBay refused the lookups, so this row was never actually evaluated. Record
  // that distinctly instead of claiming no comparables exist, and leave it for
  // `--retry-failed` once the quota resets.
  if (rateLimited && (!best || !best.comparables.length)) {
    return {
      ...baseEvidence,
      lookupFailed: true,
      method: 'lookup_rate_limited',
      query: best?.query ?? '',
      rawCount: 0,
      comparables: [],
      droppedOutliers: [],
      excluded: [],
      low: null, high: null, medianPrice: null,
      recommended: null, listPrice: null,
      confidence: 'none',
      status: 'pricing_pending',
      notes: [
        'NOT EVALUATED — eBay returned HTTP 429 (request limit reached) for every identifier lookup on this row.',
        'This is not evidence that no comparable exists. Re-run with --retry-failed once the Browse quota resets.',
      ],
    };
  }

  return resultFromComparables(baseEvidence, best, msrp, identifierConflict);
}

/**
 * Turn one attempt's qualifying comparables into a pricing result. Shared by live
 * pricing and the offline `--refilter` pass so the two can never drift apart.
 */
function resultFromComparables(baseEvidence, best, msrp, identifierConflict) {
  const notes = [];
  if (!best || !best.comparables.length) {
    if (Number.isFinite(msrp) && msrp > 0) {
      const recommended = friendlyRound(msrp * MSRP_MULTIPLIER);
      notes.push(`No qualifying eBay comparables; priced from catalog MSRP ${money(msrp)} ${CURRENCY} x ${MSRP_MULTIPLIER}.`);
      if (identifierConflict) notes.push('UPC/EAN search returned listings that do not carry this MPN — identifier conflict unresolved.');
      notes.push('Active-listing comparables only were available to this pipeline; no sold-listing data.');
      return {
        ...baseEvidence,
        method: 'catalog_msrp_derived',
        query: '',
        rawCount: best?.rawCount ?? 0,
        comparables: [],
        droppedOutliers: [],
        excluded: best?.excluded ?? [],
        low: null, high: null, medianPrice: null,
        recommended, listPrice: recommended,
        confidence: 'low',
        status: identifierConflict ? 'manual_pricing_review' : 'pricing_estimated_msrp',
        notes,
      };
    }
    notes.push('No qualifying eBay comparables and no catalog MSRP — no defensible price could be established.');
    if (best?.excluded?.length) notes.push(`${best.excluded.length} candidate listing(s) rejected (${[...new Set(best.excluded.map((entry) => entry.reason))].join(', ')}).`);
    if (identifierConflict) notes.push('UPC/EAN search returned listings that do not carry this MPN — identifier conflict unresolved.');
    return {
      ...baseEvidence,
      method: 'none',
      query: best?.query ?? '',
      rawCount: best?.rawCount ?? 0,
      comparables: [],
      droppedOutliers: [],
      excluded: best?.excluded ?? [],
      low: null, high: null, medianPrice: null,
      recommended: null, listPrice: null,
      confidence: 'none',
      status: 'pricing_pending',
      notes,
    };
  }

  const { kept, dropped } = trimOutliers(best.comparables);
  const prices = kept.map((entry) => entry.landed);
  const low = Math.round(Math.min(...prices) * 100) / 100;
  const high = Math.round(Math.max(...prices) * 100) / 100;
  const medianPrice = median(prices);
  const dispersion = low > 0 ? high / low : Infinity;
  const recommended = friendlyRound(medianPrice * MEDIAN_MULTIPLIER);

  let status = 'pricing_verified_comparable';
  let confidence = 'medium';
  if (kept.length >= 5 && dispersion <= 3) confidence = 'high';
  if (kept.length < MIN_COMPARABLES) { status = 'manual_pricing_review'; confidence = 'low'; }
  if (dispersion > MAX_DISPERSION) { status = 'manual_pricing_review'; confidence = 'low'; }
  if (identifierConflict) { status = 'manual_pricing_review'; confidence = 'low'; }
  if (best.method === 'ebay_browse_active_oe_interchange' && confidence === 'high') confidence = 'medium';

  notes.push(`${kept.length} active eBay comparable(s) via ${best.method} (query: ${best.query}); shipping-inclusive landed prices.`);
  notes.push(`Recommended = median ${money(medianPrice)} x ${MEDIAN_MULTIPLIER}, rounded to a buyer-friendly amount.`);
  if (best.method === 'ebay_browse_active_oe_interchange') notes.push('No exact-MPN comparable existed; priced from OE/interchange comparables.');
  if (kept.length < MIN_COMPARABLES) notes.push(`Fewer than ${MIN_COMPARABLES} comparables — flagged for manual review.`);
  if (dispersion > MAX_DISPERSION) notes.push(`Comparable spread ${money(low)}–${money(high)} is too wide to be defensible — flagged for manual review.`);
  if (dropped.length) notes.push(`${dropped.length} price outlier(s) excluded from the statistics.`);
  if (best.excluded.length) notes.push(`${best.excluded.length} candidate listing(s) rejected (${[...new Set(best.excluded.map((entry) => entry.reason))].join(', ')}).`);
  if (identifierConflict) notes.push('UPC/EAN search returned listings that do not carry this MPN — identifier conflict unresolved.');
  if (Number.isFinite(msrp) && msrp > 0 && recommended && recommended < msrp * 0.5) notes.push(`Recommended price is under half of catalog MSRP ${money(msrp)} — verify identifiers before publishing.`);
  notes.push('Comparables are ACTIVE listings; the Marketplace Insights (sold listings) API is not granted to this account.');

  return {
    ...baseEvidence,
    method: best.method,
    query: best.query,
    rawCount: best.rawCount,
    comparables: kept,
    droppedOutliers: dropped,
    excluded: best.excluded,
    low, high, medianPrice,
    recommended, listPrice: recommended,
    confidence, status, notes,
  };
}

/**
 * Rows a person must look at before they can be priced or posted: manual-review
 * rows and any condition conflict. Each row carries the price hint, the pages that
 * were verified, and the pages a search claimed but a script could not confirm, so
 * a reviewer can click straight through.
 */
const REVIEW_QUEUE_HEADERS = [
  'SKU', 'Brand', 'MPN', 'UPC', 'Part Type', 'Pricing Status', 'Pricing Method', 'Pricing Confidence',
  'Price Hint (USD)', 'Price Low', 'Price High', 'Condition Conflict', 'Identifier Conflict',
  'Verified Source URLs', 'Unverified Claimed URLs', 'Reason',
];
function buildReviewQueue(results) {
  return results
    .filter((r) => r.status === 'manual_pricing_review' || r.conditionConflict)
    .map((r) => ({
      SKU: r.sku,
      Brand: r.brand,
      MPN: r.mpn,
      UPC: r.upc,
      'Part Type': r.partType,
      'Pricing Status': r.status,
      'Pricing Method': r.method,
      'Pricing Confidence': r.confidence,
      'Price Hint (USD)': money(r.recommended),
      'Price Low': money(r.low),
      'Price High': money(r.high),
      'Condition Conflict': r.conditionConflict ? 'yes' : '',
      'Identifier Conflict': r.identifierConflict ? 'yes' : '',
      'Verified Source URLs': (r.comparables || []).map((entry) => cleanUrl(entry.url)).filter(Boolean).join(' | '),
      'Unverified Claimed URLs': (r.excluded || [])
        .filter((entry) => String(entry.reason || '').startsWith('page_check_failed') || String(entry.reason || '').startsWith('condition_not_new'))
        .map((entry) => `${cleanUrl(entry.url)} ($${entry.price}; ${String(entry.reason).replace('page_check_failed:', 'unverified: ').replace('condition_not_new:', '')})`)
        .join(' | '),
      Reason: (r.notes || []).filter((note) => !note.startsWith('Prices come from web search')).join(' '),
    }));
}

/**
 * Layer web-research results over the Browse results, without touching them.
 * Rules: a structured Browse price always wins; a web result that itself found
 * nothing (`pricing_pending`) is never applied, so it cannot erase a Browse row's
 * "not evaluated" state. Returns a NEW map; the Browse map is never mutated.
 */
function overlayWebResults(browseByIndex, webItems) {
  const merged = new Map(browseByIndex);
  let overlaid = 0;
  for (const web of webItems) {
    const current = merged.get(web.index);
    if (current && current.status !== 'pricing_pending') continue;
    if (web.status === 'pricing_pending') continue;
    merged.set(web.index, web);
    overlaid += 1;
  }
  return { merged, overlaid };
}


const REFILTERABLE_METHODS = new Set(['ebay_browse_active_brand_mpn', 'ebay_browse_active_mpn', 'ebay_browse_active_oe_interchange']);

/**
 * Re-derive one stored Browse result under the relevance rules, from the comparables
 * it already holds (kept + outlier-dropped) — no eBay calls. Untouched: web results,
 * unevaluated rows, GTIN-matched rows, and any row whose comparables all pass.
 */
export function refilterResult(result) {
  if (!result || result.source === 'web_search' || result.lookupFailed) return result;
  if (!REFILTERABLE_METHODS.has(result.method)) return result;
  const all = [...(result.comparables || []), ...(result.droppedOutliers || [])];
  const ctx = { method: result.method, brand: result.brand, partType: result.partType };
  const keep = [];
  const removed = [];
  for (const comparable of all) (relevanceReason(comparable.title, ctx) ? removed : keep).push(comparable);
  if (!removed.length) return result;

  const best = {
    method: result.method,
    query: result.query,
    rawCount: result.rawCount,
    comparables: keep,
    excluded: [
      ...(result.excluded || []),
      ...removed.slice(0, 10).map((c) => ({ itemId: c.itemId, title: c.title, price: c.price, reason: relevanceReason(c.title, ctx) })),
    ].slice(0, 14),
  };
  const baseEvidence = {
    sku: result.sku, brand: result.brand, mpn: result.mpn, upc: result.upc, ean: result.ean, oem: result.oem,
    category: result.category, partType: result.partType, identifierConflict: Boolean(result.identifierConflict),
    checkedAt: result.checkedAt, lookupFailed: false,
  };
  const next = resultFromComparables(baseEvidence, best, null, Boolean(result.identifierConflict));
  next.notes.unshift(`Re-filtered: ${removed.length} of ${all.length} comparable(s) were for a different product (title did not name the brand or part type) and were removed.`);
  return { index: result.index, sourceRow: result.sourceRow, ...next };
}

/** The 13 required pricing columns, derived from one pricing result. */
const PRICING_COLUMNS = [
  'List Price', 'Currency', 'Price Low', 'Price High', 'Median Comparable Price',
  'Recommended Price', 'Comparable Count', 'Pricing Method', 'Pricing Confidence',
  'Pricing Source URLs', 'Price Checked At', 'Pricing Status', 'Pricing Notes',
];
function pricingColumns(result) {
  return {
    'List Price': money(result.listPrice),
    Currency: CURRENCY,
    'Price Low': money(result.low),
    'Price High': money(result.high),
    'Median Comparable Price': money(result.medianPrice),
    'Recommended Price': money(result.recommended),
    'Comparable Count': String(result.comparables.length),
    'Pricing Method': result.method,
    'Pricing Confidence': result.confidence,
    'Pricing Source URLs': result.comparables.slice(0, MAX_SOURCE_URLS).map((entry) => cleanUrl(entry.url)).filter(Boolean).join(' | '),
    'Price Checked At': result.checkedAt,
    'Pricing Status': result.status,
    'Pricing Notes': result.notes.join(' '),
  };
}

/* ── Validation report ───────────────────────────────────────────────────── */

const EXACT_MPN_METHODS = new Set(['ebay_browse_active_gtin_exact', 'ebay_browse_active_brand_mpn', 'ebay_browse_active_mpn', 'web_search_exact_mpn']);
const MSRP_METHODS = new Set(['catalog_msrp_derived', 'web_search_msrp']);

function groupStats(results, key) {
  const groups = new Map();
  for (const result of results) {
    const name = String(result[key] || '(unspecified)').trim() || '(unspecified)';
    if (!groups.has(name)) groups.set(name, []);
    if (Number.isFinite(result.recommended)) groups.get(name).push(result.recommended);
  }
  return [...groups.entries()]
    .map(([name, prices]) => ({
      name,
      priced: prices.length,
      min: prices.length ? Math.min(...prices) : null,
      max: prices.length ? Math.max(...prices) : null,
      median: median(prices),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function countBy(results, key) {
  const counts = new Map();
  for (const result of results) counts.set(result[key], (counts.get(result[key]) || 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ [key]: name, count })).sort((a, b) => b.count - a.count);
}

/** A row is publish-ready on pricing only with a number, a currency, evidence and a confidence. */
function isPublishReady(result) {
  return Number.isFinite(result.listPrice)
    && result.confidence !== 'none'
    && result.status !== 'pricing_pending'
    && result.status !== 'manual_pricing_review'
    && !result.identifierConflict
    && (result.comparables.length > 0 || MSRP_METHODS.has(result.method));
}

function buildReport(results) {
  return {
    generatedAt: new Date().toISOString(),
    currency: CURRENCY,
    comparableSource: 'eBay Browse API — ACTIVE fixed-price NEW listings (sold-listing data unavailable: buy.browse grant only)',
    totals: {
      rows: results.length,
      verifiedPrices: results.filter((r) => r.status === 'pricing_verified_comparable').length,
      pricedFromExactMpnComparables: results.filter((r) => EXACT_MPN_METHODS.has(r.method) && r.comparables.length > 0).length,
      pricedFromComparableParts: results.filter((r) => r.method === 'ebay_browse_active_oe_interchange' && r.comparables.length > 0).length,
      pricedFromMsrp: results.filter((r) => MSRP_METHODS.has(r.method)).length,
      missingDefensiblePrice: results.filter((r) => r.status === 'pricing_pending').length,
      notEvaluatedLookupFailed: results.filter((r) => r.lookupFailed).length,
      missingAfterRealSearch: results.filter((r) => r.status === 'pricing_pending' && !r.lookupFailed).length,
      manualPricingReview: results.filter((r) => r.status === 'manual_pricing_review').length,
      identifierConflicts: results.filter((r) => r.identifierConflict).length,
      conditionConflicts: results.filter((r) => r.conditionConflict).length,
      publishReady: results.filter((r) => isPublishReady(r)).length,
    },
    byStatus: countBy(results, 'status'),
    byMethod: countBy(results, 'method'),
    byConfidence: countBy(results, 'confidence'),
    recommendedByBrand: groupStats(results, 'brand'),
    recommendedByCategory: groupStats(results, 'category'),
    pendingSkus: results.filter((r) => r.status === 'pricing_pending')
      .map((r) => ({ sku: r.sku, brand: r.brand, mpn: r.mpn, reason: r.notes[0] || '' })),
    manualReviewSkus: results.filter((r) => r.status === 'manual_pricing_review')
      .map((r) => ({
        sku: r.sku, brand: r.brand, mpn: r.mpn, recommended: r.recommended,
        reason: r.notes.find((note) => note.includes('manual review') || note.includes('conflict')) || r.notes[0] || '',
      })),
  };
}

function renderReport(report) {
  const priceTable = (rows) => [
    '| Group | Priced rows | Min | Median | Max |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...rows.map((row) => `| ${row.name} | ${row.priced} | ${money(row.min)} | ${money(row.median)} | ${money(row.max)} |`),
  ].join('\n');

  return [
    '# PartsBazar360 pricing validation report',
    '',
    `**Generated:** ${report.generatedAt}  `,
    `**Currency:** ${report.currency}  `,
    `**Comparable source:** ${report.comparableSource}`,
    '',
    '## Totals',
    '',
    '| Metric | Rows |',
    '| --- | ---: |',
    `| Listings total | ${report.totals.rows} |`,
    `| Listings with verified prices | ${report.totals.verifiedPrices} |`,
    `| Listings priced from exact-MPN comparables | ${report.totals.pricedFromExactMpnComparables} |`,
    `| Listings priced from comparable (OE/interchange) parts | ${report.totals.pricedFromComparableParts} |`,
    `| Listings priced from MSRP | ${report.totals.pricedFromMsrp} |`,
    `| Listings missing a defensible price | ${report.totals.missingDefensiblePrice} |`,
    `| — of which searched and genuinely had no comparable | ${report.totals.missingAfterRealSearch} |`,
    `| — of which NOT EVALUATED (eBay lookup failed/rate-limited) | ${report.totals.notEvaluatedLookupFailed} |`,
    `| Listings requiring manual pricing review | ${report.totals.manualPricingReview} |`,
    `| Unresolved identifier conflicts | ${report.totals.identifierConflicts} |`,
    `| Condition conflicts (exact part found only remanufactured/used; catalog says New) | ${report.totals.conditionConflicts} |`,
    `| Publish-ready on pricing criteria | ${report.totals.publishReady} |`,
    '',
    '## By pricing status',
    '',
    '| Status | Rows |',
    '| --- | ---: |',
    ...report.byStatus.map((row) => `| ${row.status} | ${row.count} |`),
    '',
    '## By pricing method',
    '',
    '| Method | Rows |',
    '| --- | ---: |',
    ...report.byMethod.map((row) => `| ${row.method} | ${row.count} |`),
    '',
    '## By pricing confidence',
    '',
    '| Confidence | Rows |',
    '| --- | ---: |',
    ...report.byConfidence.map((row) => `| ${row.confidence} | ${row.count} |`),
    '',
    '## Recommended price by brand',
    '',
    priceTable(report.recommendedByBrand),
    '',
    '## Recommended price by category',
    '',
    priceTable(report.recommendedByCategory),
    '',
    '## Listings missing a defensible price',
    '',
    report.pendingSkus.length
      ? ['| SKU | Brand | MPN | Reason |', '| --- | --- | --- | --- |',
        ...report.pendingSkus.map((row) => `| ${row.sku} | ${row.brand} | ${row.mpn} | ${row.reason} |`)].join('\n')
      : '_None._',
    '',
    '## Listings requiring manual pricing review',
    '',
    report.manualReviewSkus.length
      ? ['| SKU | Brand | MPN | Recommended | Reason |', '| --- | --- | --- | ---: | --- |',
        ...report.manualReviewSkus.map((row) => `| ${row.sku} | ${row.brand} | ${row.mpn} | ${money(row.recommended)} | ${row.reason} |`)].join('\n')
      : '_None._',
    '',
  ].join('\n');
}

/* ── MSRP lookup ─────────────────────────────────────────────────────────── */

async function loadMsrpMap(importId) {
  const map = new Map();
  let pool = null;
  try {
    // Imported lazily: `pg` resolves inside the container, not from the repo root.
    const { default: pg } = await import('pg');
    pool = new pg.Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'listingpro',
      max: 2,
    });
    const result = await pool.query('select sku, upc, price from catalog_products where import_id=$1 and price is not null', [importId]);
    for (const row of result.rows) {
      const price = Number(row.price);
      if (!Number.isFinite(price) || price <= 0) continue;
      if (row.sku) map.set(`sku:${String(row.sku).toLowerCase()}`, price);
      if (row.upc) map.set(`upc:${String(row.upc).toLowerCase()}`, price);
    }
  } catch (error) {
    console.warn(`[pricing] catalog MSRP lookup unavailable: ${error?.message || error}`);
  } finally {
    if (pool) await pool.end().catch(() => {});
  }
  return map;
}

/* ── Main ────────────────────────────────────────────────────────────────── */

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const csvPath = cli.csv || INPUT;
  const outputDir = cli.outputDir || OUTPUT_DIR;
  const readyPath = cli.readyCsv || READY;
  const importId = cli.importId || IMPORT_ID;
  const stem = path.basename(csvPath, path.extname(csvPath));
  const evidencePath = path.join(outputDir, 'napa_pricing_evidence.json');

  const parsed = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const headers = parsed.shift();
  const sourceRows = parsed.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
  const rows = sourceRows.map((raw, index) => ({
    index,
    sourceRow: index + 2,
    raw,
    sku: value(raw, 'Custom Label (SKU)', 'SKU'),
    brand: value(raw, 'Brand'),
    mpn: value(raw, 'MPN', 'Manufacturer Part Number'),
    upc: value(raw, 'UPC'),
    ean: value(raw, 'EAN'),
    oem: value(raw, 'Interchange Part Number', 'OE/OEM Part Number'),
    category: value(raw, 'Category', 'Category Name'),
    partType: value(raw, 'Product Type', 'Part Type'),
  }));
  // --offset/--limit price a slice; earlier slices are merged back in from the
  // evidence file, so a batched run builds one complete set of outputs.
  const offset = Number.isFinite(cli.offset) ? Math.max(0, cli.offset) : 0;
  let targets = Number.isFinite(cli.limit) ? rows.slice(offset, offset + cli.limit) : rows.slice(offset);

  const cachedItems = fs.existsSync(evidencePath)
    ? Object.values(JSON.parse(fs.readFileSync(evidencePath, 'utf8')).items || {})
    : [];

  // --retry-failed re-prices only the rows eBay never actually evaluated.
  if (cli.retryFailed) {
    const failedIndexes = new Set(cachedItems.filter((item) => item.lookupFailed).map((item) => item.index));
    targets = rows.filter((row) => failedIndexes.has(row.index));
    console.log(`[pricing] retry-failed: ${targets.length} row(s) previously blocked by a failed lookup`);
    if (!targets.length) console.log('[pricing] nothing to retry — exiting after rebuilding the reports');
  }

  let batch;
  if (cli.refilter) {
    batch = cachedItems.map(refilterResult);
    const changed = batch.filter((item, i) => item !== cachedItems[i]);
    const lost = changed.filter((item) => !['pricing_verified_comparable', 'pricing_estimated_msrp'].includes(item.status)).length;
    console.log(`[pricing] refilter: ${changed.length} of ${batch.length} result(s) changed; ${lost} no longer clear the verified bar`);
  } else if (cli.reportOnly) {
    batch = cachedItems;
    console.log(`[pricing] report-only: reusing ${batch.length} cached pricing result(s)`);
  } else {
    const msrpMap = cli.noDb ? new Map() : await loadMsrpMap(importId);
    console.log(`[pricing] rows ${offset}–${offset + targets.length - 1} of ${rows.length}; ${msrpMap.size} catalog MSRP reference(s); ${cachedItems.length} cached result(s)`);
    const token = await ebayToken();
    const results = new Array(targets.length);
    let next = 0;
    let done = 0;
    const worker = async () => {
      for (let i = next++; i < targets.length; i = next++) {
        const row = targets[i];
        const msrp = msrpMap.get(`sku:${row.sku.toLowerCase()}`) ?? msrpMap.get(`upc:${row.upc.toLowerCase()}`) ?? null;
        try {
          results[i] = { index: row.index, sourceRow: row.sourceRow, ...(await priceRow(token, row, msrp)) };
        } catch (error) {
          results[i] = {
            index: row.index, sourceRow: row.sourceRow, sku: row.sku, brand: row.brand, mpn: row.mpn,
            upc: row.upc, ean: row.ean, oem: row.oem, category: row.category, partType: row.partType,
            identifierConflict: false, checkedAt: new Date().toISOString(), lookupFailed: true,
            method: 'lookup_failed', query: '', rawCount: 0, comparables: [], droppedOutliers: [], excluded: [],
            low: null, high: null, medianPrice: null, recommended: null, listPrice: null,
            confidence: 'none', status: 'pricing_pending',
            notes: [`Pricing lookup failed: ${error?.message || error}`],
          };
        }
        done += 1;
        if (done % 25 === 0) console.log(`[pricing-progress] ${done}/${targets.length}`);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    batch = results;
  }

  fs.mkdirSync(outputDir, { recursive: true });

  // Merge this batch over anything a previous batch already priced. This map is the
  // Browse-only record: it is what gets persisted as `items`, so `--retry-failed`
  // keeps seeing which rows eBay never evaluated no matter what web research found.
  const browseByIndex = new Map(cachedItems.map((result) => [result.index, result]));
  for (const result of batch) browseByIndex.set(result.index, result);
  const browseResults = [...browseByIndex.values()].sort((a, b) => a.index - b.index);

  // Web-research results (price-web-research.mjs) are layered on top for the
  // reports and exports only; see overlayWebResults for the precedence rules.
  const webPath = path.join(outputDir, WEB_EVIDENCE_FILE);
  const webItems = fs.existsSync(webPath)
    ? Object.values(JSON.parse(fs.readFileSync(webPath, 'utf8')).items || {})
    : [];
  const { merged: byIndex, overlaid: webOverlaid } = overlayWebResults(browseByIndex, webItems);
  if (webItems.length) console.log(`[pricing] overlaid ${webOverlaid} web-research result(s) onto rows eBay Browse could not price`);
  const allResults = [...byIndex.values()].sort((a, b) => a.index - b.index);
  const columnsByIndex = {};
  for (const result of allResults) columnsByIndex[result.index] = pricingColumns(result);

  fs.writeFileSync(evidencePath, `${JSON.stringify({
    version: 1,
    pipeline: 'pricing-enrichment',
    sourceFile: csvPath,
    currency: CURRENCY,
    comparableSource: 'ebay_browse_active_listings',
    totalRows: rows.length,
    pricedRows: browseResults.length,
    generatedAt: new Date().toISOString(),
    // `columns` is the merged (Browse + web) view the exports read; `items` stays
    // Browse-only so a later --retry-failed can still supersede a web result.
    columns: columnsByIndex,
    items: Object.fromEntries(browseResults.map((result) => [String(result.index), result])),
  }, null, 2)}\n`);

  const pricedHeaders = [...headers, ...PRICING_COLUMNS.filter((column) => !headers.includes(column))];
  const emptyColumns = Object.fromEntries(PRICING_COLUMNS.map((column) => [column, column === 'Currency' ? CURRENCY : '']));
  const pricedRows = sourceRows.map((raw, index) => {
    const result = byIndex.get(index);
    return { ...raw, ...(result ? pricingColumns(result) : emptyColumns) };
  });
  const pricedPath = path.join(outputDir, `${stem}.priced.csv`);
  writeCsv(pricedPath, pricedRows, pricedHeaders);

  // Patch the eBay File Exchange export so it carries a price.
  let readyPatched = 0;
  if (fs.existsSync(readyPath)) {
    const readyParsed = parseCsv(fs.readFileSync(readyPath, 'utf8'));
    const readyHeaders = readyParsed.shift();
    const readyRows = readyParsed.map((cells) => Object.fromEntries(readyHeaders.map((header, index) => [header, cells[index] ?? ''])));
    const bySku = new Map(allResults.filter((result) => result.sku).map((result) => [result.sku.toLowerCase(), result]));
    for (const row of readyRows) {
      const sku = value(row, 'CustomLabel (SKU)', 'Custom Label (SKU)', 'SKU').toLowerCase();
      const result = sku ? bySku.get(sku) : null;
      if (!result) continue;
      row['*StartPrice'] = money(result.listPrice);
      row.Currency = CURRENCY;
      row['Pricing Status'] = result.status;
      if (Number.isFinite(result.listPrice)) readyPatched += 1;
    }
    const patchedHeaders = [...readyHeaders];
    for (const column of ['*StartPrice', 'Currency', 'Pricing Status']) if (!patchedHeaders.includes(column)) patchedHeaders.push(column);
    writeCsv(readyPath, readyRows, patchedHeaders);
  }

  const report = buildReport(allResults);
  const queueRows = buildReviewQueue(allResults);
  writeCsv(path.join(outputDir, REVIEW_QUEUE_FILE), queueRows, REVIEW_QUEUE_HEADERS);
  fs.writeFileSync(path.join(outputDir, 'partsbazar360-pricing-validation-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'partsbazar360-pricing-validation-report.md'), renderReport(report));

  const manifest = {
    pipeline: 'pricing-enrichment',
    importId,
    sourceFile: csvPath,
    currency: CURRENCY,
    ...report.totals,
    medianMultiplier: MEDIAN_MULTIPLIER,
    msrpMultiplier: MSRP_MULTIPLIER,
    minComparables: MIN_COMPARABLES,
    readyRowsPriced: readyPatched,
    files: [
      path.basename(pricedPath),
      'napa_pricing_evidence.json',
      'partsbazar360-pricing-validation-report.md',
      'partsbazar360-pricing-validation-report.json',
      REVIEW_QUEUE_FILE,
    ],
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outputDir, `${stem}.pricing.manifest.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
}

// Guarded so the pure pricing helpers below can be imported by the test file.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[pricing-enrichment] ${error?.stack || error}`);
    process.exitCode = 1;
  });
}

export {
  CONDITION_PATTERN,
  BUNDLE_PATTERN,
  CURRENCY,
  MEDIAN_MULTIPLIER,
  MSRP_MULTIPLIER,
  MIN_COMPARABLES,
  MAX_DISPERSION,
  MIN_COMP_PRICE,
  WEB_EVIDENCE_FILE,
  parseCsv,
  value,
  compact,
  money,
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
  REVIEW_QUEUE_HEADERS,
  PRICING_COLUMNS,
};
