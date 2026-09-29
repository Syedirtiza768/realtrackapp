#!/usr/bin/env node
/**
 * persist-seo-content.mjs — write the vehicle-aware SEO titles and descriptions
 * (produced by seo-content-apply.mjs) into the catalog database.
 *
 * Deliberately narrow, unlike persist-complete-fitment.mjs (which rewrites every
 * product of the import plus fitment fields and import warnings). This touches ONLY:
 *   catalog_products : title, title_normalized, optimized_title, description,
 *                      optimized_description, "updatedAt"
 *   listing_records  : title, description, "updatedAt"   (draft rows from the same
 *                      staging file only)
 * and ONLY for SKUs whose CSV row has `Fitment Status = verified_mvl` and a title
 * (<= 80) and description (<= 4000) that pass validation.
 *
 * DRY-RUN BY DEFAULT. `--apply` writes the previous values to a backup JSON first,
 * then updates everything in ONE transaction and aborts (rolls back) if any expected
 * row is missing, duplicated, or not updated exactly once. `--restore <backup.json>`
 * puts the previous values back the same way. It never publishes to eBay.
 *
 * Usage (inside the backend container):
 *   node scripts/persist-seo-content.mjs                      # dry run
 *   node scripts/persist-seo-content.mjs --apply
 *   node scripts/persist-seo-content.mjs --restore /app/output/backups/<file>.json
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { parseCsv, value } from './price-enrich-catalog.mjs';
import { TITLE_MAX, DESCRIPTION_MAX } from './seo-content.mjs';

const ROOT = process.env.PIPELINE_ROOT || '/app';
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

const IMPORT_ID = process.env.CATALOG_IMPORT_ID || '31fe3770-48c8-4667-9351-af4a1fad99ad';
const SOURCE_FILE = 'napa_ebay_shopify_listings.complete-fitment-enriched.csv';
const STAGING_FILE = 'napa_ebay_shopify_listings.csv';

/** Same normalization the catalog uses for `title_normalized`. */
export function normalizeTitle(title) {
  return String(title || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Turn CSV rows into validated update records. Returns { updates, skipped } where
 * every skipped row says why — nothing is silently dropped.
 */
export function buildUpdates(rows) {
  const updates = [];
  const skipped = [];
  const seen = new Set();
  for (const row of rows) {
    const sku = value(row, 'Custom Label (SKU)', 'SKU');
    if (!sku) continue;
    if (row['Fitment Status'] !== 'verified_mvl') continue; // not part of this job
    const title = String(row['SEO Title'] || '').trim();
    const description = String(row['SEO Description'] || '').trim();
    if (seen.has(sku.toLowerCase())) { skipped.push({ sku, reason: 'duplicate_sku_in_csv' }); continue; }
    seen.add(sku.toLowerCase());
    if (!title) { skipped.push({ sku, reason: 'empty_title' }); continue; }
    if (title.length > TITLE_MAX) { skipped.push({ sku, reason: `title_over_${TITLE_MAX}` }); continue; }
    if (!description) { skipped.push({ sku, reason: 'empty_description' }); continue; }
    if (description.length > DESCRIPTION_MAX) { skipped.push({ sku, reason: `description_over_${DESCRIPTION_MAX}` }); continue; }
    updates.push({ sku, title, titleNormalized: normalizeTitle(title), description });
  }
  return { updates, skipped };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--apply') out.apply = true;
    else if (argv[i] === '--restore') out.restore = argv[++i];
    else if (argv[i] === '--dir') out.dir = argv[++i];
  }
  return out;
}

async function connect() {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, max: 2,
  });
  return pool;
}

async function requireColumns(client) {
  const need = {
    catalog_products: ['title', 'title_normalized', 'optimized_title', 'description', 'optimized_description', 'import_id', 'sku', 'updatedAt'],
    listing_records: ['title', 'description', 'customLabelSku', 'status', 'sourceFileName', 'updatedAt'],
  };
  for (const [table, columns] of Object.entries(need)) {
    const have = (await client.query('select column_name from information_schema.columns where table_name=$1', [table])).rows.map((r) => r.column_name);
    const missing = columns.filter((c) => !have.includes(c));
    if (missing.length) throw new Error(`Schema check failed: ${table} is missing ${missing.join(', ')}. Nothing written.`);
  }
}

async function loadCurrent(client, skus) {
  const lower = skus.map((s) => s.toLowerCase());
  const products = (await client.query(
    'select id, sku, title, title_normalized, optimized_title, description, optimized_description from catalog_products where import_id=$1 and lower(sku)=any($2)',
    [IMPORT_ID, lower],
  )).rows;
  const listings = (await client.query(
    `select id, "customLabelSku" as sku, title, description from listing_records
     where lower("customLabelSku")=any($1) and status='draft' and "sourceFileName"=$2`,
    [lower, STAGING_FILE],
  )).rows;
  return { products, listings };
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const dir = cli.dir || `${ROOT}/output/ebay-pipeline`;
  const pool = await connect();
  const client = await pool.connect();
  try {
    await requireColumns(client);

    if (cli.restore) return await restore(client, cli.restore);

    const parsed = parseCsv(fs.readFileSync(path.join(dir, SOURCE_FILE), 'utf8'));
    const headers = parsed.shift();
    const rows = parsed.map((cells) => Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ''])));
    const { updates, skipped } = buildUpdates(rows);
    const bySku = new Map(updates.map((u) => [u.sku.toLowerCase(), u]));

    const { products, listings } = await loadCurrent(client, updates.map((u) => u.sku));
    const productCount = new Map();
    for (const p of products) productCount.set(p.sku.toLowerCase(), (productCount.get(p.sku.toLowerCase()) || 0) + 1);
    const duplicated = [...productCount].filter(([, n]) => n > 1).map(([sku]) => sku);
    const missing = updates.filter((u) => !productCount.has(u.sku.toLowerCase())).map((u) => u.sku);
    const already = products.filter((p) => {
      const u = bySku.get(p.sku.toLowerCase());
      return u && p.title === u.title && p.description === u.description && p.optimized_title === u.title && p.optimized_description === u.description;
    }).length;

    const summary = {
      mode: cli.apply ? 'APPLY' : 'dry-run',
      importId: IMPORT_ID,
      csvRowsToPersist: updates.length,
      skippedRows: skipped,
      catalogProductsMatched: products.length,
      catalogProductsMissing: missing,
      duplicatedProducts: duplicated,
      alreadyUpToDate: already,
      draftListingRecordsMatched: listings.length,
    };
    console.log(JSON.stringify(summary, null, 2));

    if (duplicated.length) throw new Error(`Duplicate catalog products for ${duplicated.join(', ')}. Nothing written.`);
    if (skipped.length) throw new Error(`${skipped.length} CSV row(s) failed validation. Nothing written.`);
    const sample = products.slice(0, 3).map((p) => ({ sku: p.sku, old: p.title, new: bySku.get(p.sku.toLowerCase())?.title }));
    console.log('\nsample (old -> new title):'); for (const s of sample) console.log(`  ${s.sku}\n    - ${s.old}\n    + ${s.new}`);

    if (!cli.apply) { console.log('\nDry run only — nothing written. Re-run with --apply.'); return; }

    // 1. Backup the previous values BEFORE touching anything.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(ROOT, 'output/backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `db-seo-content-before-${stamp}.json`);
    fs.writeFileSync(backupFile, `${JSON.stringify({ importId: IMPORT_ID, createdAt: new Date().toISOString(), products, listings }, null, 2)}\n`);
    console.log(`\nBackup written: ${backupFile}`);

    // 2. One transaction; every expected row must be updated exactly once.
    await client.query('begin');
    try {
      for (const p of products) {
        const u = bySku.get(p.sku.toLowerCase());
        const r = await client.query(
          `update catalog_products
             set title=$2, title_normalized=$3, optimized_title=$2, description=$4, optimized_description=$4, "updatedAt"=now()
           where id=$1 and import_id=$5`,
          [p.id, u.title, u.titleNormalized, u.description, IMPORT_ID],
        );
        if (r.rowCount !== 1) throw new Error(`catalog_products update for ${p.sku} touched ${r.rowCount} rows`);
      }
      for (const l of listings) {
        const u = bySku.get(l.sku.toLowerCase());
        const r = await client.query(
          `update listing_records set title=$2, description=$3, "updatedAt"=now()
           where id=$1 and status='draft' and "sourceFileName"=$4`,
          [l.id, u.title, u.description, STAGING_FILE],
        );
        if (r.rowCount !== 1) throw new Error(`listing_records update for ${l.sku} touched ${r.rowCount} rows`);
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }

    // 3. Read back and confirm.
    const after = await loadCurrent(client, updates.map((u) => u.sku));
    const wrong = after.products.filter((p) => {
      const u = bySku.get(p.sku.toLowerCase());
      return p.title !== u.title || p.optimized_title !== u.title || p.description !== u.description || p.optimized_description !== u.description || p.title_normalized !== u.titleNormalized;
    });
    console.log(JSON.stringify({ updatedProducts: products.length, updatedDraftListingRecords: listings.length, readBackMismatches: wrong.length, backup: backupFile }, null, 2));
    if (wrong.length) throw new Error(`Read-back mismatch for ${wrong.map((p) => p.sku).join(', ')}`);
    console.log(`\nDone. To undo: node scripts/persist-seo-content.mjs --restore ${backupFile}`);
  } finally {
    client.release();
    await pool.end();
  }
}

async function restore(client, file) {
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (backup.importId !== IMPORT_ID) throw new Error('Backup belongs to a different import. Nothing restored.');
  await client.query('begin');
  try {
    for (const p of backup.products) {
      const r = await client.query(
        `update catalog_products set title=$2, title_normalized=$3, optimized_title=$4, description=$5, optimized_description=$6, "updatedAt"=now()
         where id=$1 and import_id=$7`,
        [p.id, p.title, p.title_normalized, p.optimized_title, p.description, p.optimized_description, IMPORT_ID],
      );
      if (r.rowCount !== 1) throw new Error(`restore of product ${p.sku} touched ${r.rowCount} rows`);
    }
    for (const l of backup.listings) {
      const r = await client.query(
        `update listing_records set title=$2, description=$3, "updatedAt"=now() where id=$1 and "sourceFileName"=$4`,
        [l.id, l.title, l.description, STAGING_FILE],
      );
      if (r.rowCount !== 1) throw new Error(`restore of listing record ${l.sku} touched ${r.rowCount} rows`);
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
  console.log(JSON.stringify({ restoredProducts: backup.products.length, restoredListingRecords: backup.listings.length, from: file }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`[persist-seo-content] ${error?.message || error}`); process.exitCode = 1; });
}
