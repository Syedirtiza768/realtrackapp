#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '/app/.env' });

const INPUT = process.env.CATALOG_EVIDENCE_INPUT || '/app/output/ebay-pipeline/napa_ebay_shopify_listings.csv';
const OUTPUT = process.env.CATALOG_EVIDENCE_OUTPUT || '/app/output/ebay-pipeline/napa_exact_catalog_evidence.json';
const MARKETPLACE = 'EBAY_US';
const BASE = String(process.env.EBAY_ENVIRONMENT || 'PRODUCTION').toUpperCase() === 'PRODUCTION'
  ? 'https://api.ebay.com'
  : 'https://api.sandbox.ebay.com';
const http = axios.create({ timeout: 45_000 });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let nextSlot = 0;

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
  return rows.filter((r) => r.some((value) => String(value).trim()));
}

function normHeader(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function value(raw, ...names) {
  for (const name of names) {
    const key = Object.keys(raw).find((candidate) => normHeader(candidate) === normHeader(name));
    if (key && String(raw[key] ?? '').trim()) return String(raw[key]).trim();
  }
  return '';
}
function compact(value) { return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function aspectMap(item) {
  const out = {};
  for (const aspect of item?.localizedAspects ?? []) {
    const key = String(aspect?.name || '').toLowerCase();
    if (key) out[key] = String(aspect?.value || '').trim();
  }
  return out;
}
function exactCandidate(item, product) {
  const title = compact(item?.title);
  const mpn = compact(product.mpn);
  if (!mpn || !title.includes(mpn)) return false;
  const brand = compact(product.brand);
  return !brand || title.includes(brand) || String(item?.brand || '').toUpperCase().includes(String(product.brand || '').toUpperCase());
}
function validateDetail(item, product) {
  const aspects = aspectMap(item);
  const asserted = [
    aspects['manufacturer part number'],
    aspects['oe/oem part number'],
    aspects.mpn,
  ].filter(Boolean).map(compact);
  const mpn = compact(product.mpn);
  const titleMatch = compact(item?.title).includes(mpn);
  const mpnMatch = asserted.includes(mpn) || titleMatch;
  const itemBrand = compact(item?.brand || aspects.brand || item?.title);
  const brandMatch = !compact(product.brand) || itemBrand.includes(compact(product.brand));
  return { exact: Boolean(mpnMatch && brandMatch), titleMatch, mpnMatch, brandMatch, aspects };
}
function imageUrls(item) {
  const urls = [item?.image?.imageUrl, ...(item?.additionalImages ?? []).map((entry) => entry?.imageUrl)].filter(Boolean);
  return [...new Set(urls.map((url) => String(url).replace(/s-l(?:\d+|thumbnail)\.(jpg|jpeg|png|webp)$/i, 's-l1600.$1')))];
}
function textEvidenceScore(item) {
  const text = stripHtml([item?.shortDescription, item?.description].filter(Boolean).join('\n'));
  const years = text.match(/\b(?:19|20)\d{2}\b/g)?.length ?? 0;
  const ranges = text.match(/\b(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:19|20)?\d{2}\b/gi)?.length ?? 0;
  return Math.min(30, years) + ranges * 3 + Math.min(10, Math.floor(text.length / 250));
}
function scoreSummary(item, product) {
  let score = 0;
  if (compact(item?.title).includes(compact(product.mpn))) score += 20;
  if (compact(item?.title).includes(compact(product.brand))) score += 6;
  if (item?.epid) score += 2;
  if (item?.image?.imageUrl) score += 2;
  return score;
}
async function throttle() {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + 275;
  if (slot > now) await sleep(slot - now);
}
async function request(config) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await throttle();
    try { return await http.request(config); }
    catch (error) {
      const status = error?.response?.status;
      if (status === 401 && attempt === 0) throw Object.assign(error, { refreshToken: true });
      if (status === 429 || status >= 500) { await sleep(1500 * (attempt + 1)); continue; }
      throw error;
    }
  }
  throw new Error('eBay API retry limit reached');
}
async function clientToken() {
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID || ''}:${process.env.EBAY_CLIENT_SECRET || ''}`).toString('base64');
  const response = await http.post(
    `${BASE}/identity/v1/oauth2/token`,
    'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    { headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' } },
  );
  return response.data.access_token;
}
let token = '';
async function ebayGet(url, params) {
  try {
    return await request({ method: 'get', url, params, headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE, Accept: 'application/json' } });
  } catch (error) {
    if (!error?.refreshToken) throw error;
    token = await clientToken();
    return request({ method: 'get', url, params, headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE, Accept: 'application/json' } });
  }
}
async function search(product) {
  const query = `${product.brand} ${product.mpn}`.trim();
  const response = await ebayGet(`${BASE}/buy/browse/v1/item_summary/search`, { q: query, limit: 20, fieldgroups: 'MATCHING_ITEMS' });
  return (response.data.itemSummaries ?? [])
    .filter((item) => exactCandidate(item, product))
    .sort((a, b) => scoreSummary(b, product) - scoreSummary(a, product))
    .slice(0, 5);
}
async function getDetail(itemId) {
  const response = await ebayGet(`${BASE}/buy/browse/v1/item/${encodeURIComponent(itemId)}`);
  return response.data;
}
function parseProductCompatibilityXml(xml) {
  const applications = [];
  const blocks = String(xml).match(/<(?:application|compatibleProduct)>[\s\S]*?<\/(?:application|compatibleProduct)>/gi) ?? [];
  for (const block of blocks) {
    const props = {};
    const pairs = block.matchAll(/<propertyName>([\s\S]*?)<\/propertyName>[\s\S]*?<value>[\s\S]*?<value>([\s\S]*?)<\/value>/gi);
    for (const pair of pairs) props[stripHtml(pair[1])] = stripHtml(pair[2]);
    if (Object.keys(props).length) applications.push(props);
  }
  return applications;
}
async function getProductCompatibility(epid) {
  if (!epid) return [];
  try {
    const response = await request({
      method: 'get',
      url: 'https://svcs.ebay.com/services/marketplacecatalog/ProductService/v1',
      params: {
        'OPERATION-NAME': 'getProductCompatibilities',
        'SECURITY-APPNAME': process.env.EBAY_CLIENT_ID,
        'GLOBAL-ID': 'EBAY-MOTOR',
        'productIdentifier.ePID': epid,
      },
      responseType: 'text',
    });
    return parseProductCompatibilityXml(response.data);
  } catch { return []; }
}
function readState(totalRows) {
  try { return JSON.parse(fs.readFileSync(OUTPUT, 'utf8')); }
  catch { return { version: 1, sourceFile: INPUT, totalRows, items: {}, generatedAt: null }; }
}
function save(state) {
  state.generatedAt = new Date().toISOString();
  const temp = `${OUTPUT}.tmp`;
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(temp, OUTPUT);
}

async function inspectProduct(product) {
  const summaries = await search(product);
  const details = [];
  for (const summary of summaries) {
    try {
      const detail = await getDetail(summary.itemId);
      const validation = validateDetail(detail, product);
      if (!validation.exact) continue;
      details.push({
        itemId: detail.itemId,
        legacyItemId: detail.legacyItemId,
        itemWebUrl: detail.itemWebUrl,
        title: detail.title,
        brand: detail.brand || validation.aspects.brand || '',
        epid: detail.epid || summary.epid || '',
        gtin: detail.gtin || '',
        categoryId: detail.categoryId || '',
        shortDescription: stripHtml(detail.shortDescription),
        description: stripHtml(detail.description).slice(0, 12_000),
        imageUrls: imageUrls(detail),
        localizedAspects: validation.aspects,
        textEvidenceScore: textEvidenceScore(detail),
        matchEvidence: validation,
      });
    } catch { /* retain other exact candidates */ }
  }
  details.sort((a, b) => b.textEvidenceScore - a.textEvidenceScore || b.imageUrls.length - a.imageUrls.length);
  const best = details[0] ?? null;
  const imageCandidate = [...details].sort((a, b) => b.imageUrls.length - a.imageUrls.length)[0] ?? null;
  const productCompatibilities = best?.epid ? await getProductCompatibility(best.epid) : [];
  return {
    ...product,
    exactCandidateCount: details.length,
    selectedItemId: best?.legacyItemId || '',
    selectedListingUrl: best?.itemWebUrl || '',
    selectedEpid: best?.epid || '',
    imageUrls: imageCandidate?.imageUrls ?? [],
    imageEvidenceItemId: imageCandidate?.legacyItemId || '',
    imageEvidenceUrl: imageCandidate?.itemWebUrl || '',
    fitmentEvidence: details.slice(0, 3).map((item) => ({
      itemId: item.legacyItemId,
      listingUrl: item.itemWebUrl,
      title: item.title,
      shortDescription: item.shortDescription,
      description: item.description,
      epid: item.epid,
      textEvidenceScore: item.textEvidenceScore,
    })),
    productCompatibilities,
    status: details.length ? 'exact_match' : 'no_exact_match',
    processedAt: new Date().toISOString(),
  };
}

async function main() {
  const parsed = parseCsv(fs.readFileSync(INPUT, 'utf8'));
  const headers = parsed.shift();
  const products = parsed.map((cells, index) => {
    const raw = Object.fromEntries(headers.map((header, column) => [header, cells[column] ?? '']));
    return {
      index,
      sourceRow: index + 2,
      sku: value(raw, 'Custom Label (SKU)', 'SKU'),
      title: value(raw, 'Title'),
      brand: value(raw, 'Brand'),
      mpn: value(raw, 'MPN'),
      upc: value(raw, 'UPC'),
      ean: value(raw, 'EAN'),
      partType: value(raw, 'Product Type', 'Part Type'),
    };
  });
  token = await clientToken();
  const state = readState(products.length);
  state.totalRows = products.length;
  let cursor = 0;
  let completed = Object.keys(state.items).length;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= products.length) return;
      const product = products[index];
      if (state.items[String(product.index)]) continue;
      try { state.items[String(product.index)] = await inspectProduct(product); }
      catch (error) {
        state.items[String(product.index)] = { ...product, status: 'error', error: error instanceof Error ? error.message : String(error), processedAt: new Date().toISOString() };
      }
      completed += 1;
      if (completed % 10 === 0) { save(state); console.log(`[catalog-evidence] ${completed}/${products.length}`); }
    }
  }
  await Promise.all(Array.from({ length: 3 }, () => worker()));
  save(state);
  const items = Object.values(state.items);
  console.log(JSON.stringify({
    totalRows: products.length,
    exactMatches: items.filter((item) => item.status === 'exact_match').length,
    rowsWithImages: items.filter((item) => item.imageUrls?.length).length,
    rowsWithTextFitmentEvidence: items.filter((item) => item.fitmentEvidence?.some((evidence) => evidence.textEvidenceScore > 0)).length,
    rowsWithProductCompatibility: items.filter((item) => item.productCompatibilities?.length).length,
    output: OUTPUT,
  }, null, 2));
}

main().catch((error) => { console.error(error?.stack || error); process.exitCode = 1; });
