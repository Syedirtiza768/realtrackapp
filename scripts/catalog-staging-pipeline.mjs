#!/usr/bin/env node

/**
 * Additive catalog intake for the eBay parts sheet.
 *
 * This pipeline deliberately separates intake from enrichment. It imports the
 * source identifiers and inventory into catalog_products/listing_records, then
 * emits queues for title/SEO, image, and fitment work. It never clears catalog
 * tables and never calls an eBay publish endpoint.
 *
 * Run in the backend runtime (pg and dotenv are backend dependencies):
 *   node scripts/catalog-staging-pipeline.mjs --csv ... --mode stage-and-import
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(repoRoot, '.env') });

const BRAND_SOURCE_URLS = {
  NAPA: (mpn) => `https://www.napaonline.com/en/search?q=${encodeURIComponent(mpn)}`,
  MEVOTECH: (mpn) => `https://www.mevotech.com/part/${encodeURIComponent(mpn)}/`,
  SKF: (mpn) => `https://automotive.skf.com/nam/en/product-catalogue/${encodeURIComponent(mpn)}`,
  DELPHI: (mpn) => `https://www.delphiautoparts.com/catalog?query=${encodeURIComponent(mpn)}`,
};

const CSV_HEADERS = [
  'Custom Label (SKU)', 'Title', 'Brand', 'MPN', 'UPC', 'EAN', 'Quantity',
  'Condition', 'Category', 'Interchange Part Number', 'Product Type',
  'Manufacturer Series', 'Identifier Note',
];

function argsFrom(argv) {
  const out = { mode: 'stage', outputDir: path.join(repoRoot, 'output', 'ebay-pipeline'), model: 'gpt-5.6-luna' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--csv') out.csv = argv[++i];
    else if (a === '--mode') out.mode = argv[++i];
    else if (a === '--output-dir') out.outputDir = argv[++i];
    else if (a === '--model') out.model = argv[++i];
    else if (a === '--organization-id') out.organizationId = argv[++i];
    else if (a === '--created-by') out.createdBy = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function printHelp() {
  console.log(`Usage: node scripts/catalog-staging-pipeline.mjs --csv <file> [options]

Options:
  --mode stage|import|stage-and-import   stage is default; import is additive only
  --output-dir <dir>                    output queues and manifest directory
  --model <name>                        model recorded for the later enrichment pass
  --organization-id <uuid>              optional catalog import organization
  --created-by <uuid>                   optional catalog import creator
`);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function toCsv(rows, headers) {
  return [headers, ...rows].map((r) => headers.map((h, i) => csvCell(Array.isArray(r) ? r[i] : r[h])).join(',')).join('\n') + '\n';
}

function normalizeHeader(h) { return String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

function get(row, ...names) {
  const keys = Object.keys(row);
  for (const name of names) {
    const key = keys.find((k) => normalizeHeader(k) === normalizeHeader(name));
    if (key && String(row[key] ?? '').trim()) return String(row[key]).trim();
  }
  return '';
}

function normalizeMpn(mpn) { return String(mpn || '').toUpperCase().replace(/[\s\-_.\\/]+/g, ''); }
function normalizeBrand(brand) {
  const value = String(brand || '').trim().toUpperCase().replace(/[\s\-_.]+/g, ' ');
  if (value === 'NAPA') return 'NAPA';
  if (value === 'MEVOTECH') return 'MEVOTECH';
  if (value === 'SKF') return 'SKF';
  if (value === 'DELPHI') return 'DELPHI';
  return String(brand || '').trim();
}
function normalizeTitle(title, brand, mpn, partType) {
  const raw = String(title || '').replace(/\s+/g, ' ').trim();
  if (raw && raw.length <= 80) return raw;
  const fallback = [brand, mpn, partType].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return (fallback || raw || 'Automotive Replacement Part').slice(0, 80).trim();
}
function numOrNull(value) {
  const n = Number(String(value || '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function intOrNull(value) {
  const n = Number(String(value || '').replace(/[\s,]/g, ''));
  return Number.isInteger(n) ? n : null;
}
function conditionId(condition) { return /^new$/i.test(condition) ? '1000' : null; }
function titleStatus(title) { return title && title.length <= 80 ? 'source_valid_pending_seo' : 'needs_title_rewrite'; }
function sourceUrl(brand, mpn) {
  const maker = BRAND_SOURCE_URLS[normalizeBrand(brand)];
  return maker && mpn ? maker(mpn) : '';
}
function csvPathToAbs(p) { return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p); }

function makeRows(text) {
  const parsed = parseCsv(text);
  if (!parsed.length) throw new Error('CSV has no rows');
  const headers = parsed[0];
  const sourceRows = parsed.slice(1).map((cells, index) => {
    const row = Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
    const sku = get(row, 'Custom Label (SKU)', 'Custom Label', 'SKU');
    const title = get(row, 'Title');
    const brand = normalizeBrand(get(row, 'Brand'));
    const mpn = get(row, 'MPN', 'Manufacturer Part Number');
    const upc = get(row, 'UPC');
    const ean = get(row, 'EAN');
    const quantity = intOrNull(get(row, 'Quantity'));
    const condition = get(row, 'Condition') || 'New';
    const category = get(row, 'Category');
    const partType = get(row, 'Product Type', 'Part Type');
    const interchange = get(row, 'Interchange Part Number');
    const manufacturerSeries = get(row, 'Manufacturer Series');
    const identifierNote = get(row, 'Identifier Note');
    const canonicalTitle = normalizeTitle(title, brand, mpn, partType);
    const reason = [];
    if (!upc && !ean) reason.push('missing UPC/EAN');
    if (!interchange) reason.push('missing interchange/OE number');
    reason.push('fitment verification required');
    reason.push('manufacturer image URL verification required');
    return {
      sourceRow: index + 2, sku, sourceTitle: title, title: canonicalTitle, brand, mpn,
      mpnNormalized: normalizeMpn(mpn), upc, ean, quantity, condition,
      conditionId: conditionId(condition), category, partType, interchange,
      manufacturerSeries, identifierNote, manufacturerSourceUrl: sourceUrl(brand, mpn),
      imageUrl: '', imageStatus: 'pending', fitmentStatus: 'pending', seoStatus: 'pending',
      titleStatus: titleStatus(canonicalTitle), publishStatus: 'catalog_staged',
      reviewReason: reason.join('; '), raw: row,
    };
  });
  return { headers, rows: sourceRows };
}

function descriptionFor(row) {
  return `${row.brand || 'Automotive'} ${row.partType || 'replacement part'} ${row.mpn || ''}. New item. Verify application and fitment using the eBay vehicle selector before purchase.`.replace(/\s+/g, ' ').trim();
}

function outputRows(rows, importId, fileName) {
  const stagedHeaders = [...CSV_HEADERS, 'Pipeline Import ID', 'Source Row', 'Manufacturer Source URL', 'Image URL', 'SEO Status', 'Title Status', 'Image Status', 'Fitment Status', 'Publish Status', 'Review Reason', 'Description'];
  const staged = rows.map((r) => [...CSV_HEADERS.map((h) => r.raw[h] ?? ''), importId, r.sourceRow, r.manufacturerSourceUrl, r.imageUrl, r.seoStatus, r.titleStatus, r.imageStatus, r.fitmentStatus, r.publishStatus, r.reviewReason, descriptionFor(r)]);
  const queueHeaders = ['Pipeline Import ID', 'Source Row', 'SKU', 'Brand', 'MPN', 'UPC', 'EAN', 'Part Type', 'Source Title', 'Proposed Title', 'Manufacturer Source URL', 'Image URL', 'SEO Status', 'Image Status', 'Fitment Status', 'Publish Status', 'Review Reason'];
  const queue = rows.map((r) => [importId, r.sourceRow, r.sku, r.brand, r.mpn, r.upc, r.ean, r.partType, r.sourceTitle, r.title, r.manufacturerSourceUrl, r.imageUrl, r.seoStatus, r.imageStatus, r.fitmentStatus, r.publishStatus, r.reviewReason]);
  const listingHeaders = ['*Action', 'CustomLabel (SKU)', '*Title', '*Quantity', '*ConditionID', '*Category', '*Description', 'PicURL', 'C:Brand', 'C:Type', 'C:Manufacturer Part Number', 'C:OE/OEM Part Number', 'P:UPC', 'P:EAN', 'Pipeline Import ID', 'Publish Status'];
  const listings = rows.map((r) => ['Add', r.sku, r.title, r.quantity ?? '', r.conditionId ?? '', r.category, descriptionFor(r), r.imageUrl, r.brand, r.partType, r.mpn, r.interchange, r.upc, r.ean, importId, r.publishStatus]);
  return {
    [`${fileName}.catalog-staged.csv`]: toCsv(staged, stagedHeaders),
    [`${fileName}.enrichment-queue.csv`]: toCsv(queue, queueHeaders),
    [`${fileName}.ebay-listings-staged.csv`]: toCsv(listings, listingHeaders),
  };
}

function rowHash(row) { return crypto.createHash('sha256').update(JSON.stringify(row.raw)).digest('hex'); }

async function importRows({ rows, csvPath, importId, args, fileSize }) {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres', password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'listingpro', max: 4,
  });
  const client = await pool.connect();
  let inserted = 0; let duplicates = 0; let invalid = 0;
  const rowResults = [];
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO catalog_imports (id, file_name, file_path, file_size_bytes, mime_type, detected_headers, column_mapping, organization_id, vertical, status, total_rows, processed_rows, inserted_rows, skipped_duplicates, flagged_for_review, invalid_rows, warnings, created_by, started_at, completed_at)
      VALUES ($1,$2,$3,$4,'text/csv',$5,$6,$7,'automotive','processing',$8,0,0,0,0,0,$9,$10,NOW(),NULL)`, [
      importId, path.basename(csvPath), csvPath, fileSize, CSV_HEADERS,
      { 'Custom Label (SKU)': 'sku', Title: 'title', Brand: 'brand', MPN: 'mpn', UPC: 'upc', EAN: 'ean', Quantity: 'quantity', Condition: 'condition', Category: 'category', 'Product Type': 'partType' },
      args.organizationId || null, rows.length, JSON.stringify([`Enrichment queued for model ${args.model}`, 'No live eBay publish performed']), args.createdBy || null,
    ]);
    const seenSku = new Set((await client.query(`SELECT lower(trim(sku)) FROM catalog_products WHERE sku IS NOT NULL AND btrim(sku) <> ''`)).rows.map((r) => r.lower));
    const seenUpc = new Set((await client.query(`SELECT lower(trim(upc)) FROM catalog_products WHERE upc IS NOT NULL AND btrim(upc) <> ''`)).rows.map((r) => r.lower));
    for (const row of rows) {
      const normalizedSku = row.sku.toLowerCase();
      const normalizedUpc = row.upc.toLowerCase();
      if (!row.sku || !row.mpn || !row.brand || !row.category) {
        invalid += 1; rowResults.push({ row, status: 'invalid', message: 'Required source identifier missing (SKU, brand, MPN, or category)' }); continue;
      }
      if (seenSku.has(normalizedSku) || (normalizedUpc && seenUpc.has(normalizedUpc))) {
        duplicates += 1; rowResults.push({ row, status: 'duplicate_skipped', message: 'Existing SKU or UPC in catalog' }); continue;
      }
      const productId = crypto.randomUUID();
      const listingId = crypto.randomUUID();
      const description = descriptionFor(row);
      await client.query(`INSERT INTO catalog_products (id, sku, mpn, mpn_normalized, upc, ean, title, title_normalized, description, brand, brand_normalized, part_type, oem_part_number, quantity, condition_id, condition_label, category_name, image_urls, fitment_data, source_file, source_row, import_id, optimization_status, fitment_status, source_data_hash, optimization_warnings, optimization_payload)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'pending','pending',$23,$24,$25)`, [
        productId, row.sku, row.mpn, row.mpnNormalized, row.upc || null, row.ean || null, row.title,
        row.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim(), description, row.brand, row.brand.toUpperCase(), row.partType || null, row.interchange || null,
        row.quantity, row.conditionId, row.condition, row.category, [], null, path.basename(csvPath), row.sourceRow, importId, rowHash(row),
        JSON.stringify([{ code: 'ENRICHMENT_PENDING', fields: ['seo', 'title', 'images', 'fitment'], model: args.model }]), JSON.stringify({ manufacturerSourceUrl: row.manufacturerSourceUrl, imageStatus: row.imageStatus, fitmentStatus: row.fitmentStatus, publishStatus: row.publishStatus }),
      ]);
      await client.query(`INSERT INTO listing_records (id, organization_id, vertical, "vertical_attributes", "sourceFileName", "sourceFilePath", "sheetName", "sourceRowNumber", origin, action, "customLabelSku", "categoryName", title, "pUpc", "startPrice", quantity, "itemPhotoUrl", "conditionId", description, "cBrand", "cType", "cManufacturerPartNumber", "cOeOemPartNumber", version)
        VALUES ($1,$2,'automotive',NULL,$3,$4,$5,$6,'pipeline_import','Add',$7,$8,$9,$10,NULL,$11,NULL,$12,$13,$14,$15,$16,$17,1)`, [
        listingId, args.organizationId || null, path.basename(csvPath), csvPath, 'napa_ebay_shopify_listings', row.sourceRow, row.sku, row.category, row.title, row.upc || null,
        row.quantity, row.conditionId, description, row.brand, row.partType || null, row.mpn, row.interchange || null,
      ]);
      await client.query(`INSERT INTO catalog_import_rows (id, import_id, row_number, status, created_product_id, message, raw_data)
        VALUES ($1,$2,$3,'inserted',$4,$5,$6)`, [crypto.randomUUID(), importId, row.sourceRow, productId, 'Catalog staged; SEO, title, image, and fitment enrichment queued', JSON.stringify(row.raw)]);
      seenSku.add(normalizedSku); if (normalizedUpc) seenUpc.add(normalizedUpc); inserted += 1;
      rowResults.push({ row, status: 'inserted', productId, listingId });
    }
    for (const result of rowResults.filter((r) => r.status !== 'inserted')) {
      await client.query(`INSERT INTO catalog_import_rows (id, import_id, row_number, status, message, raw_data) VALUES ($1,$2,$3,$4,$5,$6)`, [crypto.randomUUID(), importId, result.row.sourceRow, result.status, result.message, JSON.stringify(result.row.raw)]);
    }
    const flagged = rows.length - invalid - duplicates;
    await client.query(`UPDATE catalog_imports SET status='completed', processed_rows=$2, inserted_rows=$3, skipped_duplicates=$4, flagged_for_review=$5, invalid_rows=$6, last_processed_row=$7, completed_at=NOW() WHERE id=$1`, [importId, rows.length, inserted, duplicates, flagged, invalid, rows.length]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    try { await client.query(`UPDATE catalog_imports SET status='failed', error_message=$2, completed_at=NOW() WHERE id=$1`, [importId, String(error?.stack || error)]); } catch { /* preserve original error */ }
    throw error;
  } finally { client.release(); await pool.end(); }
  return { inserted, duplicates, invalid, importId };
}

async function main() {
  const args = argsFrom(process.argv.slice(2));
  if (args.help) { printHelp(); return; }
  if (!args.csv) throw new Error('--csv is required');
  if (!['stage', 'import', 'stage-and-import'].includes(args.mode)) throw new Error('--mode must be stage, import, or stage-and-import');
  const csvPath = csvPathToAbs(args.csv);
  if (!fs.existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`);
  const text = fs.readFileSync(csvPath, 'utf8');
  const { rows } = makeRows(text);
  if (!rows.length) throw new Error('CSV has no product rows');
  const importId = crypto.randomUUID();
  fs.mkdirSync(args.outputDir, { recursive: true });
  const fileName = path.basename(csvPath, path.extname(csvPath));
  const files = outputRows(rows, importId, fileName);
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(args.outputDir, name), body);
  const manifest = { pipeline: 'catalog-staging', importId, sourceFile: csvPath, modelForLaterEnrichment: args.model, mode: args.mode, counts: { sourceRows: rows.length, upcPresent: rows.filter((r) => r.upc).length, eanPresent: rows.filter((r) => r.ean).length, manufacturerSourceUrls: rows.filter((r) => r.manufacturerSourceUrl).length, imageUrls: 0, fitmentRows: 0, publishReady: 0 }, statuses: { catalog: 'staged', seo: 'pending', title: 'pending', images: 'pending', fitment: 'pending', publish: 'blocked_until_enrichment' }, files: Object.keys(files), generatedAt: new Date().toISOString() };
  if (args.mode === 'import' || args.mode === 'stage-and-import') manifest.importResult = await importRows({ rows, csvPath, importId, args, fileSize: fs.statSync(csvPath).size });
  fs.writeFileSync(path.join(args.outputDir, `${fileName}.manifest.json`), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => { console.error(`[catalog-staging] ${error?.stack || error}`); process.exitCode = 1; });

