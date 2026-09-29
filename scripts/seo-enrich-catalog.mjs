#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import axios from 'axios';
import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;
const ROOT = '/app';
dotenv.config({ path: path.join(ROOT, '.env') });
const IMPORT_ID = process.env.CATALOG_IMPORT_ID || '31fe3770-48c8-4667-9351-af4a1fad99ad';
const INPUT = process.env.CATALOG_ENRICH_INPUT || '/app/output/ebay-pipeline/napa_ebay_shopify_listings.csv';
const OUTPUT_DIR = process.env.CATALOG_ENRICH_OUTPUT || '/app/output/ebay-pipeline';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--csv') out.csv = argv[++i];
    else if (argv[i] === '--output-dir') out.outputDir = argv[++i];
    else if (argv[i] === '--import-id') out.importId = argv[++i];
  }
  return out;
}
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
}
function csvCell(value) { const s = value == null ? '' : String(value); return /[",\r\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s; }
function toCsv(rows, headers) { return [headers, ...rows].map((r) => headers.map((h, i) => csvCell(Array.isArray(r) ? r[i] : r[h])).join(',')).join('\n') + '\n'; }
function normHeader(h) { return String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function value(row, ...names) {
  const keys = Object.keys(row);
  for (const name of names) { const key = keys.find((k) => normHeader(k) === normHeader(name)); if (key && String(row[key] ?? '').trim()) return String(row[key]).trim(); }
  return '';
}
function compact(s) { return String(s || '').toUpperCase().replace(/[\s\-_.\\/]+/g, ''); }
function properBrand(s) { const v = String(s || '').trim().toUpperCase(); return ({ NAPA: 'NAPA', MEVOTECH: 'Mevotech', SKF: 'SKF', DELPHI: 'Delphi' }[v] || String(s || '').trim()); }
function titleCase(s) { return String(s || '').toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()); }
function cleanText(s) { return String(s || '').replace(/[^A-Za-z0-9\s\-/&.,+]/g, ' ').replace(/\s+/g, ' ').trim(); }
function positions(sourceTitle) {
  const t = String(sourceTitle || ''); const out = [];
  for (const word of ['Front', 'Rear', 'Left', 'Right', 'Upper', 'Lower', 'Inner', 'Outer']) if (new RegExp('\\b' + word + '\\b', 'i').test(t)) out.push(word);
  return out.join(' ');
}
function buildTitle(row) {
  const brand = properBrand(row.brand); const part = titleCase(row.partType || 'Automotive Replacement Part');
  const pos = positions(row.sourceTitle); const mpn = row.mpn;
  const tokens = [brand, pos, part, mpn, 'New Replacement'].filter(Boolean);
  let title = cleanText(tokens.join(' ')).replace(/\s+/g, ' ').trim();
  if (title.length <= 80) return title;
  title = cleanText([brand, pos, part, mpn, 'New'].filter(Boolean).join(' '));
  if (title.length <= 80) return title;
  title = cleanText([brand, part, mpn].filter(Boolean).join(' '));
  if (title.length <= 80) return title;
  const suffix = ' ' + mpn; const prefix = cleanText([brand, part].filter(Boolean).join(' '));
  return (prefix.slice(0, Math.max(1, 80 - suffix.length)) + suffix).trim().slice(0, 80);
}
function buildDescription(row) {
  const brand = properBrand(row.brand); const part = titleCase(row.partType || 'automotive replacement part');
  const lines = [
    'New ' + brand + ' ' + part + ' replacement part.',
    'Manufacturer part number: ' + row.mpn + '.',
    row.upc ? 'UPC: ' + row.upc + '.' : '',
    row.interchange ? 'Interchange/OE reference: ' + row.interchange + '.' : '',
    'Please verify the part number, vehicle application, and photos before ordering.',
    'Professional installation is recommended. Ships as described in the listing.',
  ];
  return lines.filter(Boolean).join(' ');
}
function sourceUrl(brand, mpn) {
  const b = String(brand || '').toUpperCase(); const p = encodeURIComponent(mpn);
  if (b === 'NAPA') return 'https://www.napaonline.com/en/search?q=' + p;
  if (b === 'MEVOTECH') return 'https://www.mevotech.com/part/' + p + '/';
  if (b === 'SKF') return 'https://automotive.skf.com/nam/en/product-catalogue/' + p;
  if (b === 'DELPHI') return 'https://www.delphiautoparts.com/catalog?query=' + p;
  return '';
}
function imageUrl1600(url) { return String(url || '').replace(/s-l(?:\d+|thumbnail)\.(jpg|jpeg|png|webp)$/i, 's-l1600.$1'); }

const base = String(process.env.EBAY_ENVIRONMENT || 'PRODUCTION').toUpperCase() === 'PRODUCTION' ? 'https://api.ebay.com' : 'https://api.sandbox.ebay.com';
const http = axios.create({ timeout: 30000 });
let nextSlot = 0;
async function throttle() { const now = Date.now(); const slot = Math.max(now, nextSlot); nextSlot = slot + 320; if (slot > now) await sleep(slot - now); }
async function ebayToken() {
  const basic = Buffer.from(String(process.env.EBAY_CLIENT_ID || '') + ':' + String(process.env.EBAY_CLIENT_SECRET || '')).toString('base64');
  const r = await http.post(base + '/identity/v1/oauth2/token', 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope', { headers: { Authorization: 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded' } });
  return r.data.access_token;
}
async function searchEbay(token, query) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await throttle();
    try {
      const r = await http.get(base + '/buy/browse/v1/item_summary/search', { params: { q: query, limit: 10, fieldgroups: 'MATCHING_ITEMS' }, headers: { Authorization: 'Bearer ' + token, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US', Accept: 'application/json' } });
      return Array.isArray(r.data.itemSummaries) ? r.data.itemSummaries : [];
    } catch (error) {
      const status = error?.response?.status;
      if (status === 429 || status >= 500) { await sleep(1500 * (attempt + 1)); continue; }
      return [];
    }
  }
  return [];
}
function scoreCandidate(item, row, identifierQuery) {
  const text = String(item?.title || '').toLowerCase(); const mpn = compact(row.mpn).toLowerCase();
  const brand = String(row.brand || '').toLowerCase(); let score = 0;
  if (mpn && compact(text).toLowerCase().includes(mpn)) score += 8;
  if (brand && text.includes(brand)) score += 3;
  if (identifierQuery && String(identifierQuery) === String(row.upc || row.ean || '')) score += 2;
  if (item?.image?.imageUrl) score += 1;
  return score;
}
async function findImage(token, row) {
  const primary = row.upc || row.ean || row.mpn;
  let items = primary ? await searchEbay(token, primary) : [];
  let queryType = row.upc || row.ean ? 'gtin' : 'mpn';
  let candidates = items.filter((item) => item?.image?.imageUrl);
  if (!candidates.length || Math.max(...candidates.map((item) => scoreCandidate(item, row, primary))) < 5) {
    const fallback = [row.brand, row.mpn].filter(Boolean).join(' ');
    if (fallback && fallback !== primary) { items = await searchEbay(token, fallback); queryType = 'brand_mpn'; candidates = items.filter((item) => item?.image?.imageUrl); }
  }
  if (!candidates.length) return { url: '', source: '', confidence: 'none', query: primary };

  candidates.sort((a, b) => scoreCandidate(b, row, primary) - scoreCandidate(a, row, primary));
  const item = candidates[0]; const original = item.image.imageUrl; const large = imageUrl1600(original);
  let url = large; let validated = false;
  try { const v = await http.head(url, { timeout: 15000, validateStatus: () => true }); validated = v.status >= 200 && v.status < 400 && String(v.headers['content-type'] || '').startsWith('image/'); } catch { validated = false; }

  if (!validated) { url = original; try { const v = await http.head(url, { timeout: 15000, validateStatus: () => true }); validated = v.status >= 200 && v.status < 400 && String(v.headers['content-type'] || '').startsWith('image/'); } catch { validated = false; } }

  return { url: validated ? url : '', source: validated ? 'eBay Browse API exact identifier search' : '', confidence: scoreCandidate(item, row, primary) >= 8 ? 'high' : 'medium', query: primary, itemId: item.itemId || '', listingUrl: item.itemWebUrl || '', title: item.title || '' };
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const csvPath = cli.csv || INPUT; const outDir = cli.outputDir || OUTPUT_DIR; const importId = cli.importId || IMPORT_ID;
  const parsed = parseCsv(fs.readFileSync(csvPath, 'utf8')); const headers = parsed[0];
  const rows = parsed.slice(1).map((cells, index) => {
    const raw = Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
    return { sourceRow: index + 2, raw, sku: value(raw, 'Custom Label (SKU)', 'Custom Label', 'SKU'), sourceTitle: value(raw, 'Title'), brand: value(raw, 'Brand'), mpn: value(raw, 'MPN'), upc: value(raw, 'UPC'), ean: value(raw, 'EAN'), quantity: value(raw, 'Quantity'), condition: value(raw, 'Condition') || 'New', category: value(raw, 'Category'), partType: value(raw, 'Product Type', 'Part Type'), interchange: value(raw, 'Interchange Part Number') };
  });
  const token = await ebayToken();
  const results = new Array(rows.length); let next = 0; let done = 0;
  async function worker() { while (true) { const i = next++; if (i >= rows.length) return; const row = rows[i]; const title = buildTitle(row); const description = buildDescription(row); let image = { url: '', source: '', confidence: 'none' }; try { image = await findImage(token, row); } catch { image = { url: '', source: '', confidence: 'none' }; } results[i] = { ...row, title, description, imageUrl: image.url, imageSource: image.source, imageConfidence: image.confidence, imageQuery: image.query || '', ebayImageItemId: image.itemId || '', ebayImageListingUrl: image.listingUrl || '', imageCandidateTitle: image.title || '', manufacturerSourceUrl: sourceUrl(row.brand, row.mpn), imageValidated: Boolean(image.url), seoStatus: 'completed', titleStatus: title.length <= 80 ? 'completed' : 'needs_review', imageStatus: image.url ? 'validated' : 'needs_review', fitmentStatus: 'pending', publishStatus: image.url ? 'content_ready_fitment_pending' : 'blocked_missing_image', reviewReason: image.url ? 'Fitment verification remains required' : 'No validated image match' }; done += 1; if (done % 25 === 0) console.log('[enrichment-progress] ' + done + '/' + rows.length); } }
  await Promise.all(Array.from({ length: 4 }, () => worker()));
  fs.mkdirSync(outDir, { recursive: true });
  const exportHeaders = [...headers, 'SEO Title', 'SEO Description', 'Manufacturer Source URL', 'Image URL', 'Image Source', 'Image Match Confidence', 'Image Validated', 'SEO Status', 'Title Status', 'Image Status', 'Fitment Status', 'Publish Status', 'Review Reason'];
  const exportRows = results.map((r) => [...headers.map((h) => r.raw[h] ?? ''), r.title, r.description, r.manufacturerSourceUrl, r.imageUrl, r.imageSource, r.imageConfidence, r.imageValidated ? 'Yes' : 'No', r.seoStatus, r.titleStatus, r.imageStatus, r.fitmentStatus, r.publishStatus, r.reviewReason]);
  const listingHeaders = ['*Action', 'CustomLabel (SKU)', '*Title', '*Quantity', '*ConditionID', '*Category', '*Description', 'PicURL', 'C:Brand', 'C:Type', 'C:Manufacturer Part Number', 'C:OE/OEM Part Number', 'P:UPC', 'P:EAN', 'Pipeline Import ID', 'Publish Status'];
  const listingRows = results.map((r) => ['Add', r.sku, r.title, r.quantity, r.condition.toLowerCase() === 'new' ? '1000' : '', r.category, r.description, r.imageUrl, properBrand(r.brand), titleCase(r.partType), r.mpn, r.interchange, r.upc, r.ean, importId, r.publishStatus]);
  const stem = path.basename(csvPath, path.extname(csvPath));
  fs.writeFileSync(path.join(outDir, stem + '.seo-enriched.csv'), toCsv(exportRows, exportHeaders));
  fs.writeFileSync(path.join(outDir, stem + '.ebay-listings-ready.csv'), toCsv(listingRows, listingHeaders));
  const tokenPool = new Pool({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USER || 'postgres', password: process.env.DB_PASSWORD || 'postgres', database: process.env.DB_NAME || 'listingpro', max: 4 });
  const client = await tokenPool.connect();
  let updated = 0; let missingImages = 0; let productMap = new Map();
  try {
    const all = await client.query('SELECT id, sku, upc, image_urls FROM catalog_products WHERE sku IS NOT NULL OR upc IS NOT NULL');
    for (const p of all.rows) { if (p.sku) productMap.set('sku:' + String(p.sku).toLowerCase(), p); if (p.upc) productMap.set('upc:' + String(p.upc).toLowerCase(), p); }
    await client.query('BEGIN');
    for (const r of results) {
      const p = productMap.get('sku:' + r.sku.toLowerCase()) || productMap.get('upc:' + r.upc.toLowerCase());
      if (!p) continue;
      const url = r.imageUrl || (Array.isArray(p.image_urls) ? p.image_urls[0] : ''); if (!url) missingImages += 1;
      const payload = { enrichment: 'seo-title-description-image', imageUrl: url || null, imageSource: r.imageSource || 'existing_catalog', imageConfidence: r.imageConfidence, imageValidated: Boolean(r.imageUrl), manufacturerSourceUrl: r.manufacturerSourceUrl, model: 'deterministic-ebay-safe-template', enrichedAt: new Date().toISOString() };
      const warnings = r.imageUrl ? [{ code: 'FITMENT_PENDING', message: 'Source sheet does not contain verified vehicle fitment', source: 'catalog-enrichment' }] : [{ code: 'IMAGE_PENDING', message: 'No validated image match returned by eBay Browse API', source: 'catalog-enrichment' }, { code: 'FITMENT_PENDING', message: 'Source sheet does not contain verified vehicle fitment', source: 'catalog-enrichment' }];
      await client.query('UPDATE catalog_products SET title=$2, title_normalized=$3, description=$4, image_urls=CASE WHEN $5 = \'\' THEN image_urls ELSE ARRAY[$5]::text[] END, optimized_title=$2, optimized_description=$4, optimization_status=\'completed\', optimization_version=optimization_version+1, optimized_at=NOW(), seo_score=$6, readiness_score=$7, ebay_validation_status=$8, optimization_warnings=$9::jsonb, optimization_payload=COALESCE(optimization_payload, \'{}\'::jsonb) || $10::jsonb, manual_review=$11, updatedAt=NOW() WHERE id=$1', [p.id, r.title, r.title.toLowerCase().replace(/[^a-z0-9\\s]/g, '').replace(/\\s+/g, ' ').trim(), r.description, url || '', 0.95, r.imageUrl ? 0.85 : 0.35, r.imageUrl ? 'content_ready_fitment_pending' : 'needs_image', JSON.stringify(warnings), JSON.stringify(payload), !r.imageUrl]);
      await client.query('UPDATE listing_records SET title=$2, description=$3, "itemPhotoUrl"=$4 WHERE lower("customLabelSku")=lower($1)', [r.sku, r.title, r.description, url || null]);
      updated += 1;
    }
    await client.query('UPDATE catalog_imports SET warnings=$2, flagged_for_review=$3, error_message=NULL WHERE id=$1', [importId, JSON.stringify([`SEO/title/image enrichment completed; fitment remains pending. Model setting: ${process.env.CATALOG_ENRICH_MODEL || 'deterministic-ebay-safe-template'}`]), missingImages]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); await tokenPool.end(); }
  const manifest = { pipeline: 'seo-image-enrichment', importId, sourceFile: csvPath, rows: results.length, updatedCatalogProducts: updated, validatedImages: results.filter((r) => r.imageUrl).length, missingImages: results.filter((r) => !r.imageUrl).length, titleCompleted: results.filter((r) => r.titleStatus === 'completed').length, fitmentPending: results.length, publishReady: 0, imageSource: 'eBay Browse API exact identifier search', files: [stem + '.seo-enriched.csv', stem + '.ebay-listings-ready.csv'], generatedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(outDir, stem + '.seo-image-enrichment.manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest, null, 2));
}
main().catch((error) => { console.error('[seo-image-enrichment] ' + (error?.stack || error)); process.exitCode = 1; });