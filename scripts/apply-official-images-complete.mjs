#!/usr/bin/env node
import fs from 'node:fs';
import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: '/app/.env' });

const BASE = '/app/output/ebay-pipeline';
const IMPORT_ID = '31fe3770-48c8-4667-9351-af4a1fad99ad';
const SOURCE = `${BASE}/napa_ebay_shopify_listings.complete-fitment-enriched.csv`;
const READY = `${BASE}/napa_ebay_shopify_listings.complete.ebay-listings-ready.csv`;
const MATCHES = `${BASE}/napa_official_image_matches_v2.json`;
const MANIFEST = `${BASE}/napa_ebay_shopify_listings.complete.manifest.json`;

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  const source = text.replace(/^\uFEFF/, '');
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
  return rows.filter((entry) => entry.some((value) => String(value).trim()));
}
function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function writeCsv(path, rows, headers) {
  fs.writeFileSync(path, `${[headers, ...rows].map((row) => headers.map((header, index) => csvCell(row[index] ?? row[header] ?? '')).join(',')).join('\n')}\n`);
}
function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function value(raw, ...names) {
  for (const name of names) {
    const key = Object.keys(raw).find((candidate) => normalize(candidate) === normalize(name));
    if (key && String(raw[key] ?? '').trim()) return String(raw[key]).trim();
  }
  return '';
}

const matches = new Map(
  JSON.parse(fs.readFileSync(MATCHES, 'utf8'))
    .filter((entry) => !entry.noMatch && entry.imageUrl)
    .map((entry) => [entry.sku.toLowerCase(), entry]),
);
const sourceParsed = parseCsv(fs.readFileSync(SOURCE, 'utf8'));
const sourceHeaders = sourceParsed.shift();
const sourceRows = sourceParsed.map((cells) => Object.fromEntries(sourceHeaders.map((header, index) => [header, cells[index] ?? ''])));
let officialApplied = 0;
for (const row of sourceRows) {
  const match = matches.get(value(row, 'Custom Label (SKU)', 'SKU').toLowerCase());
  if (!match) continue;
  row['Image URL'] = match.imageUrl;
  row['Image Source'] = match.source || `Official NAPA product page ${match.productUrl}`;
  row['Image Match Confidence'] = 'high';
  row['Image Validated'] = 'Yes';
  row['Image Status'] = 'validated';
  const fitmentStatus = row['Fitment Status'] || 'fitment_pending';
  row['Publish Status'] = fitmentStatus === 'verified_mvl' ? 'content_ready_fitment_verified' : 'content_ready_fitment_pending';
  row['Review Reason'] = fitmentStatus === 'verified_mvl' ? 'Fitment and image validated for staged export' : 'Fitment verification remains required';
  officialApplied += 1;
}
writeCsv(SOURCE, sourceRows, sourceHeaders);

const readyParsed = parseCsv(fs.readFileSync(READY, 'utf8'));
const readyHeaders = readyParsed.shift();
const readyRows = readyParsed.map((cells) => Object.fromEntries(readyHeaders.map((header, index) => [header, cells[index] ?? ''])));
const statusBySku = new Map(sourceRows.map((row) => [value(row, 'Custom Label (SKU)', 'SKU').toLowerCase(), row]));
for (const row of readyRows) {
  const sku = value(row, 'CustomLabel (SKU)', 'Custom Label (SKU)', 'SKU').toLowerCase();
  if (!sku) continue;
  const source = statusBySku.get(sku);
  if (!source) continue;
  row.PicURL = source['Image URL'] || '';
  row['Publish Status'] = source['Publish Status'] || '';
}
writeCsv(READY, readyRows, readyHeaders);

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
manifest.imageRows = sourceRows.filter((row) => Boolean(value(row, 'Image URL'))).length;
manifest.missingImageRows = sourceRows.length - manifest.imageRows;
manifest.publishReadyRows = sourceRows.filter((row) => row['Publish Status'] === 'content_ready_fitment_verified').length;
manifest.officialImageRowsAdded = officialApplied;
manifest.generatedAt = new Date().toISOString();
fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, max: 4 });
const client = await pool.connect();
let updated = 0;
try {
  const products = await client.query('select id, sku from catalog_products where import_id=$1', [IMPORT_ID]);
  const productMap = new Map(products.rows.map((row) => [String(row.sku || '').toLowerCase(), row.id]));
  await client.query('begin');
  for (const row of sourceRows) {
    const match = matches.get(value(row, 'Custom Label (SKU)', 'SKU').toLowerCase());
    const id = productMap.get(value(row, 'Custom Label (SKU)', 'SKU').toLowerCase());
    if (!match || !id) continue;
    await client.query(
      `update catalog_products set image_urls=ARRAY[$2]::text[], ebay_validation_status=$3, manual_review=$4, "updatedAt"=now() where id=$1`,
      [id, match.imageUrl, row['Publish Status'], row['Publish Status'] !== 'content_ready_fitment_verified'],
    );
    await client.query('update listing_records set "itemPhotoUrl"=$2, "updatedAt"=now() where lower("customLabelSku")=lower($1)', [row['Custom Label (SKU)'], match.imageUrl]);
    updated += 1;
  }
  await client.query('commit');
} catch (error) {
  await client.query('rollback');
  throw error;
} finally {
  client.release();
  await pool.end();
}
console.log(JSON.stringify({ officialMatches: matches.size, officialApplied, dbUpdated: updated, imageRows: manifest.imageRows, missingImageRows: manifest.missingImageRows, publishReadyRows: manifest.publishReadyRows, source: SOURCE, ready: READY }, null, 2));
