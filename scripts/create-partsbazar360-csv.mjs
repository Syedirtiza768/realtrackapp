#!/usr/bin/env node
import fs from 'node:fs';

// PIPELINE_BASE lets this run off the production host (which is memory-starved) against a synced copy.
const BASE = process.env.PIPELINE_BASE || '/app/output/ebay-pipeline';
const INPUT = `${BASE}/napa_ebay_shopify_listings.complete-fitment-enriched.csv`;
const EVIDENCE = `${BASE}/napa_fitment_evidence_candidates.json`;
const PRICING = `${BASE}/napa_pricing_evidence.json`;
const POSTABLE = `${BASE}/partsbazar360-postable-listings.csv`;
const AUDIT = `${BASE}/partsbazar360-all-listings-audit.csv`;
const IMPORT_ID = '31fe3770-48c8-4667-9351-af4a1fad99ad';

/** Written by `price-enrich-catalog.mjs`; see that script for the methodology. */
const PRICING_COLUMNS = [
  'List Price', 'Currency', 'Price Low', 'Price High', 'Median Comparable Price',
  'Recommended Price', 'Comparable Count', 'Pricing Method', 'Pricing Confidence',
  'Pricing Source URLs', 'Price Checked At', 'Pricing Status', 'Pricing Notes',
];
const PUBLISHABLE_PRICING_STATUSES = new Set([
  'pricing_verified_exact_match', 'pricing_verified_comparable', 'pricing_estimated_msrp',
]);

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(cell); cell = ''; }
    else if (character === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += character;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((entry) => entry.some((value) => String(value).trim()));
}
function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function writeCsv(path, rows, headers) {
  const headerLine = headers.map((header) => csvCell(header)).join(',');
  const dataLines = rows.map((row) => headers.map((header) => csvCell(row[header] ?? '')).join(','));
  fs.writeFileSync(path, [headerLine, ...dataLines, ''].join('\n'));
}
function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function value(row, ...names) {
  for (const name of names) {
    const key = Object.keys(row).find((candidate) => normalize(candidate) === normalize(name));
    if (key && String(row[key] ?? '').trim()) return String(row[key]).trim();
  }
  return '';
}
function parseJson(valueToParse, fallback) {
  try { return JSON.parse(valueToParse || ''); } catch { return fallback; }
}
function fitmentText(fitments) {
  return fitments.map((fitment) => {
    const years = Number(fitment.yearStart) === Number(fitment.yearEnd)
      ? String(fitment.yearStart)
      : `${fitment.yearStart}-${fitment.yearEnd}`;
    return `${years} ${fitment.make} ${fitment.model}${fitment.position ? ` (${fitment.position})` : ''}`;
  }).join('; ');
}

const parsed = parseCsv(fs.readFileSync(INPUT, 'utf8'));
const inputHeaders = parsed.shift();
const sourceRows = parsed.map((cells) => Object.fromEntries(inputHeaders.map((header, index) => [header, cells[index] ?? ''])));
const evidence = parseJson(fs.readFileSync(EVIDENCE, 'utf8'), { items: {} }).items || {};
const pricing = fs.existsSync(PRICING)
  ? parseJson(fs.readFileSync(PRICING, 'utf8'), { columns: {} }).columns || {}
  : {};
if (!Object.keys(pricing).length) {
  console.warn(`[partsbazar360] no pricing evidence at ${PRICING} — pricing columns will be blank and no row can be postable. Run price-enrich-catalog.mjs first.`);
}
const emptyPricing = Object.fromEntries(PRICING_COLUMNS.map((column) => [column, '']));

const headers = [
  'SKU', 'Title', 'Description', 'Brand', 'Manufacturer Part Number', 'OE/OEM Part Number',
  'UPC', 'EAN', 'Quantity', 'Condition ID', 'Category Name', 'Part Type', 'Placement on Vehicle',
  'Image URLs', 'Fitment Data', 'Fitment Summary', 'Fitment Source', 'Manufacturer Source URL',
  'Image Source', 'Image Evidence URL', 'eBay Item ID', 'ePID', 'SEO Status', 'Publish Status',
  ...PRICING_COLUMNS,
  'Source Row', 'Import ID',
];
const allRows = [];
for (let index = 0; index < sourceRows.length; index += 1) {
  const source = sourceRows[index];
  const fitments = parseJson(source['Fitment Data'], []);
  const ev = evidence[String(index)] || {};
  const evidenceImages = Array.isArray(ev.imageUrls) ? ev.imageUrls : [];
  const primaryImage = value(source, 'Image URL');
  const imageUrls = [...new Set([primaryImage, ...evidenceImages].filter(Boolean))];
  const item = {
    SKU: value(source, 'Custom Label (SKU)', 'SKU'),
    Title: value(source, 'SEO Title', 'Title'),
    Description: value(source, 'SEO Description', 'Description'),
    Brand: value(source, 'Brand'),
    'Manufacturer Part Number': value(source, 'MPN', 'Manufacturer Part Number'),
    'OE/OEM Part Number': value(source, 'Interchange Part Number', 'OE/OEM Part Number'),
    UPC: value(source, 'UPC'),
    EAN: value(source, 'EAN'),
    Quantity: value(source, 'Quantity'),
    'Condition ID': value(source, 'Condition').toLowerCase() === 'new' ? '1000' : '',
    'Category Name': value(source, 'Category'),
    'Part Type': value(source, 'Product Type', 'Part Type'),
    'Placement on Vehicle': fitments.map((fitment) => fitment.position).filter(Boolean).filter((position, pos, all) => all.indexOf(position) === pos).join('; '),
    'Image URLs': imageUrls.join('|'),
    'Fitment Data': JSON.stringify(fitments),
    'Fitment Summary': fitmentText(fitments),
    'Fitment Source': value(source, 'Fitment Source'),
    'Manufacturer Source URL': value(source, 'Manufacturer Source URL'),
    'Image Source': value(source, 'Image Source'),
    'Image Evidence URL': ev.imageEvidenceUrl || '',
    'eBay Item ID': ev.imageEvidenceItemId || ev.selectedItemId || '',
    ePID: ev.selectedEpid || '',
    'SEO Status': value(source, 'SEO Status') || 'completed',
    'Publish Status': value(source, 'Publish Status'),
    ...emptyPricing,
    ...(pricing[String(index)] || {}),
    'Source Row': String(index + 2),
    'Import ID': IMPORT_ID,
  };
  allRows.push(item);
}
/**
 * Pricing gate: a listing is publish-ready only with a numeric price, an explicit
 * currency, a pricing source or documented method, a confidence value, and no
 * unresolved identifier conflict (which `price-enrich-catalog.mjs` reports as
 * `manual_pricing_review`).
 */
function pricedForPublish(row) {
  const price = Number(row['List Price']);
  if (!Number.isFinite(price) || price <= 0) return false;
  if (!row.Currency) return false;
  if (!row['Pricing Confidence'] || row['Pricing Confidence'] === 'none') return false;
  if (!row['Pricing Source URLs'] && !row['Pricing Method']) return false;
  return PUBLISHABLE_PRICING_STATUSES.has(row['Pricing Status']);
}

const contentReadyRows = allRows.filter((row) => row['Publish Status'] === 'content_ready_fitment_verified');
const postableRows = contentReadyRows.filter((row) => pricedForPublish(row));
for (const row of contentReadyRows) {
  if (!pricedForPublish(row)) row['Publish Status'] = 'content_ready_pricing_pending';
}
writeCsv(AUDIT, allRows, headers);
writeCsv(POSTABLE, postableRows, headers);
console.log(JSON.stringify({
  sourceRows: allRows.length,
  auditRows: allRows.length,
  contentReadyRows: contentReadyRows.length,
  postableRows: postableRows.length,
  blockedOnPricing: contentReadyRows.length - postableRows.length,
  postable: POSTABLE,
  audit: AUDIT,
}, null, 2));
