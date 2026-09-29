#!/usr/bin/env node
import fs from 'node:fs';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '/app/.env' });
const { Pool } = pg;
const IMPORT_ID = '31fe3770-48c8-4667-9351-af4a1fad99ad';
const INPUT = '/app/output/ebay-pipeline/napa_ebay_shopify_listings.complete-fitment-enriched.csv';

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
function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function value(raw, ...names) {
  for (const name of names) {
    const key = Object.keys(raw).find((candidate) => normalize(candidate) === normalize(name));
    if (key && String(raw[key] ?? '').trim()) return String(raw[key]).trim();
  }
  return '';
}

const parsed = parseCsv(fs.readFileSync(INPUT, 'utf8'));
const headers = parsed.shift();
const bySku = new Map();
for (const cells of parsed) {
  const raw = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  const sku = value(raw, 'Custom Label (SKU)', 'SKU');
  if (!sku) continue;
  let fitment = [];
  try { fitment = JSON.parse(raw['Fitment Data'] || '[]'); } catch { fitment = []; }
  bySku.set(sku.toLowerCase(), {
    sku,
    title: value(raw, 'SEO Title', 'Title'),
    description: value(raw, 'SEO Description', 'Description'),
    fitment,
    fitmentStatus: raw['Fitment Status'] || 'fitment_pending',
    confidence: fitment.length ? Math.min(...fitment.map((entry) => Number(entry.confidence) || 0)) : null,
    publishStatus: raw['Publish Status'] || '',
  });
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 4,
});
const client = await pool.connect();
let updated = 0;
let missingSource = 0;
try {
  const products = await client.query('select id, sku from catalog_products where import_id=$1', [IMPORT_ID]);
  await client.query('begin');
  for (const product of products.rows) {
    const source = bySku.get(String(product.sku || '').toLowerCase());
    if (!source) { missingSource += 1; continue; }
    await client.query(
      `update catalog_products
       set fitment_data=$2::jsonb,
           fitment_rows=$2::jsonb,
           fitment_status=$3,
           fitment_confidence=$4,
           title=$5,
           optimized_title=$5,
           description=$6,
           optimized_description=$6,
           ebay_validation_status=$7,
           manual_review=$8,
           "updatedAt"=now()
       where id=$1`,
      [
        product.id,
        JSON.stringify(source.fitment),
        source.fitmentStatus,
        source.confidence,
        source.title,
        source.description,
        source.publishStatus,
        source.publishStatus !== 'content_ready_fitment_verified',
      ],
    );
    updated += 1;
  }
  await client.query(
    `update catalog_imports
     set warnings=$2::jsonb, flagged_for_review=$3, error_message=null
     where id=$1`,
    [
      IMPORT_ID,
      JSON.stringify([
        'SEO, images, and fitment processed for all source rows. Fitment is published only when exact-listing evidence or a high-confidence catalog candidate passes eBay US MVL validation.',
        'Rows without authoritative image or fitment evidence remain blocked for manual review.',
      ]),
      [...bySku.values()].filter((entry) => entry.publishStatus !== 'content_ready_fitment_verified').length,
    ],
  );
  await client.query('commit');
  const counts = await client.query(
    `select fitment_status, count(*)::int as count
     from catalog_products where import_id=$1 group by fitment_status order by fitment_status`,
    [IMPORT_ID],
  );
  console.log(JSON.stringify({ importId: IMPORT_ID, importProducts: products.rowCount, updated, missingSource, statusCounts: counts.rows }, null, 2));
} catch (error) {
  await client.query('rollback');
  throw error;
} finally {
  client.release();
  await pool.end();
}
