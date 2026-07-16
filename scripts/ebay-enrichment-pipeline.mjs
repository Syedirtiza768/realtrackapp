#!/usr/bin/env node
/**
 * ebay-fast-pipeline.mjs
 * Fast reprocessing pipeline — skips VIN decode, Browse API, Taxonomy API.
 * Uses input file data directly (part number, description, make are already known).
 * MVL database for fitment/compatibility. AI only for title+description polish.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import XLSX from 'xlsx';
import axios from 'axios';
import OpenAI from 'openai';

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 10 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });
axios.defaults.httpAgent = httpAgent;
axios.defaults.httpsAgent = httpsAgent;

// ── Config ──
const ROOT = process.env.PIPELINE_PROJECT_ROOT || path.resolve(process.cwd(), '..');
const INPUT = process.env.PIPELINE_INPUT_FILE;
const OUTPUT_DIR = process.env.PIPELINE_OUTPUT_DIR;
const JOB_ID = process.env.PIPELINE_JOB_ID;

if (!INPUT || !OUTPUT_DIR || !JOB_ID) {
  console.error('Missing PIPELINE_INPUT_FILE, PIPELINE_OUTPUT_DIR, or PIPELINE_JOB_ID');
  process.exit(1);
}

// AI DISABLED — descriptions come directly from input file

const CONFIG = {
  location: 'Fort Lauderdale, FL, US',
  defaultConditionId: '3000',
  defaultFormat: 'FixedPrice',
  defaultDuration: 'GTC',
  defaultQuantity: 1,
  marketplace: process.env.PIPELINE_TARGET_MARKETPLACE || 'US',
  shippingProfile: process.env.PIPELINE_SHIPPING_PROFILE || '',
  returnProfile: process.env.PIPELINE_RETURN_PROFILE || '',
  paymentProfile: process.env.PIPELINE_PAYMENT_PROFILE || '',
  storeId: process.env.PIPELINE_STORE_ID || '',
};

// ── Helpers ──
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (v) => (v == null ? '' : String(v).trim());

function progress(stage, data = {}) {
  const pairs = Object.entries({ stage, ...data })
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  console.log(`[PROGRESS] ${pairs}`);
}

function titleCase(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Vehicle info extraction from filename + description ──
const MAKE_ALIASES = {
  audi: 'Audi', bmw: 'BMW', gmc: 'GMC', vw: 'Volkswagen',
  volkswagen: 'Volkswagen', lincoln: 'Lincoln', lincon: 'Lincoln',
  benz: 'Mercedes-Benz', mercedes: 'Mercedes-Benz', mb: 'Mercedes-Benz',
  porche: 'Porsche', porsche: 'Porsche', landrover: 'Land Rover',
  'land rover': 'Land Rover', rolls: 'Rolls-Royce', bentley: 'Bentley',
  maserati: 'Maserati', lexus: 'Lexus', toyota: 'Toyota',
};

function extractVehicleFromFilename(filename) {
  const base = filename.replace(/\.(xlsx?|csv)$/i, '').replace(/^\d+_/, '');
  const vinMatch = base.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
  const vin = vinMatch ? vinMatch[1].toUpperCase() : null;
  // Remove VIN indicator text AND any bare 17-char VIN token from the name.
  // The VIN is captured separately above; if left in it pollutes both the
  // title and the MVL model lookup (e.g. model "Ghibli ZAM57XSA3F1153518"
  // fails to match "Ghibli" in the MVL table -> no compatibility rows).
  let cleaned = base.replace(/\bVIN\b\s*[A-HJ-NPR-Z0-9]{17}\b/gi, '').trim();
  if (vin) {
    cleaned = cleaned.replace(new RegExp('\\b' + vin + '\\b', 'gi'), '').trim();
  }
  // Also drop any other stray 17-char VIN-like token (upper/lower)
  cleaned = cleaned.replace(/\b[A-HJ-NPR-Za-hj-npr-z0-9]{17}\b/g, '').trim();
  // Remove trailing numbers/dates that look like timestamps
  cleaned = cleaned.replace(/\s*\d{10,}\s*/g, '').trim();
  // Try to extract year, make, model
  const yearMatch = cleaned.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? parseInt(yearMatch[0]) : null;
  // Extract make
  const cleanedLower = cleaned.toLowerCase();
  let make = null;
  for (const [alias, canonical] of Object.entries(MAKE_ALIASES)) {
    if (cleanedLower.includes(alias)) {
      make = canonical;
      break;
    }
  }
  // Try to get model from what's left after year+make
  let model = null;
  if (make) {
    const makeIdx = cleaned.toLowerCase().indexOf(make.toLowerCase());
    const afterMake = cleaned.substring(makeIdx + make.length).trim();
    // Model is typically the next word(s) before color or other metadata
    const modelWords = afterMake.split(/[\s,\-_]+/).filter(w =>
      w &&
      !/^\(?\d+\)?$/.test(w) &&              // stray sequence numbers like "2" or "(1)"
      !/^[A-HJ-NPR-Z0-9]{17}$/i.test(w) &&      // residual VIN token
      !/silver|black|white|blue|red|green|grey|gray|gold|brown|testing|test|xlsx|xls|csv|sheet|part/i.test(w)
    ).slice(0, 3);
    if (modelWords.length) {
      model = modelWords.join(' ').replace(/[,\.]+$/, '').trim();
      // Clean up common suffixes that aren't model names
      model = model.replace(/\s+\d+$/, '').trim(); // trailing numbers
      if (!model) model = null;
    }
  }
  return { year, make, model, vin, rawName: cleaned };
}

function extractPosition(desc) {
  const s = String(desc || '').toLowerCase();
  const pos = [];
  if (/\bfront\b|\bfr\b/.test(s)) pos.push('Front');
  if (/\brear\b|\brr\b/.test(s)) pos.push('Rear');
  if (/\bleft\b|\blh\b|\bdriver\b/.test(s)) pos.push('Left');
  if (/\bright\b|\brh\b|\bpassenger\b/.test(s)) pos.push('Right');
  if (/\bupper\b/.test(s)) pos.push('Upper');
  if (/\blower\b/.test(s)) pos.push('Lower');
  if (/\binner\b/.test(s)) pos.push('Inner');
  if (/\bouter\b/.test(s)) pos.push('Outer');
  return pos.join(' ');
}

// Position words captured separately by extractPosition() -- strip them from the
// part name so the title doesn't repeat them (mirrors extractPosition's set).
const POSITION_STRIP = /\b(front|fr|rear|rr|left|lh|driver|right|rh|passenger|upper|lower|inner|outer)\b/gi;
// Listing boilerplate that duplicates the deterministic "OEM Used" title suffix.
const BOILERPLATE_STRIP = /\b(used|oem|oe|genuine|original)\b/gi;

function cleanPartName(desc, make, model) {
  // Strip VIN, year, make, model, position words, and OEM/Used boilerplate so
  // the remaining text is just the part type (e.g. "Intercooler Support
  // Bracket"). Model + position + "OEM Used" are added by the title template
  // separately; leaving them here duplicated them in the title.
  let name = String(desc || '');
  name = name.replace(/\b[A-HJ-NPR-Z0-9]{17}\b/gi, ''); // VIN
  name = name.replace(/\bVIN\s*[:.]?\s*/gi, '');
  name = name.replace(/\b(19|20)\d{2}\b/g, ''); // year
  if (make) {
    const mk = make.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    name = name.replace(new RegExp('\\b' + mk + '\\b', 'gi'), '');
  }
  if (model) {
    const md = String(model).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (md) name = name.replace(new RegExp('\\b' + md + '\\b', 'gi'), '');
  }
  name = name.replace(POSITION_STRIP, ' ');
  name = name.replace(BOILERPLATE_STRIP, ' ');
  name = name.replace(/[,\-]+$/g, '').trim();
  name = name.replace(/\s+/g, ' ').trim();
  return name;
}

// ── Category resolution — deterministic keyword lookup, no live API calls ──
// Sources: ebay_category_mappings DB table (active rows) + the corrected
// CATEGORY_KEYWORD_ROWS in backend/src/channels/ebay/ebay-german-listing.util.ts
// (IDs verified live via getCategorySuggestions on 2026-07-13). Falls back to
// 9886 "Other Car & Truck Parts & Accessories" — a confirmed-valid generic
// leaf — for anything unmatched, so no row ever needs the live Taxonomy API.
const CATEGORY_KEYWORD_ROWS = [
  { kw: ['dashboard', 'dash panel', 'instrument panel', 'dash trim', 'dash bezel'], id: '262191', name: 'Dash Panels' },
  { kw: ['armrest', 'door armrest', 'inner panel', 'door finisher'], id: '33696', name: 'Door Panels' },
  { kw: ['interior door', 'door moulding', 'door molding', 'door trim'], id: '33696', name: 'Door Panels' },
  { kw: ['exterior door panel', 'door skin', 'door shell', 'exterior door'], id: '179850', name: 'Doors & Door Skins' },
  { kw: ['complete door', 'door assembly', 'driver door', "driver's door"], id: '179850', name: 'Doors & Door Skins' },
  { kw: ['door handle', 'handle strip'], id: '179851', name: 'Door Handles' },
  { kw: ['window regulator', 'window lifter', 'window motor'], id: '33706', name: 'Window Motors & Regulators' },
  { kw: ['mirror', 'side mirror', 'rearview'], id: '262161', name: 'Mirror Assemblies' },
  { kw: ['headlight', 'headlamp'], id: '33710', name: 'Headlight Assemblies' },
  { kw: ['center console', 'armrest console'], id: '262189', name: 'Center & Overhead Console Parts' },
  { kw: ['radiator', 'support radiator'], id: '33602', name: 'Radiators' },
  { kw: ['fastener', 'hardware', 'bolt', 'screw', 'nut', 'clip', 'rivet'], id: '174907', name: 'Nuts, Bolts & Fasteners' },
  { kw: ['brake caliper', 'caliper', 'disc brake caliper'], id: '33563', name: 'Brake Calipers' },
  { kw: ['brake pad', 'brake shoe', 'disc pad'], id: '33564', name: 'Brake Pads & Shoes' },
  { kw: ['control arm', 'suspension arm', 'lower control arm', 'upper control arm'], id: '177707', name: 'Control Arms & Parts' },
  { kw: ['alternator', 'generator', 'charging'], id: '33603', name: 'Alternators & Generators' },
  { kw: ['wheel hub', 'hub bearing', 'hub assembly'], id: '33573', name: 'Wheel Hubs & Bearings' },
  { kw: ['sensor', 'oxygen sensor', 'speed sensor', 'abs sensor'], id: '33555', name: 'Sensors' },
  { kw: ['ignition coil', 'coil pack'], id: '33596', name: 'Ignition Coils' },
  { kw: ['shock', 'strut', 'shock absorber', 'dampener'], id: '33571', name: 'Shock Absorbers' },
  { kw: ['starter', 'starter motor'], id: '33577', name: 'Starters' },
  { kw: ['water pump', 'coolant pump'], id: '33612', name: 'Water Pumps' },
  { kw: ['catalytic converter', 'cat converter'], id: '43961', name: 'Catalytic Converters' },
  { kw: ['turbo', 'turbocharger', 'turbo charger'], id: '174044', name: 'Turbochargers & Parts' },
];
const FALLBACK_CATEGORY = { id: '9886', name: 'Other Car & Truck Parts & Accessories' };

function resolveCategory(partName, rawDesc) {
  const text = `${partName || ''} ${rawDesc || ''}`.toLowerCase();
  let best = null;
  for (const row of CATEGORY_KEYWORD_ROWS) {
    const matchedKeyword = row.kw.find((kw) => text.includes(kw));
    if (matchedKeyword && (!best || matchedKeyword.length > best.kwLen)) {
      best = { id: row.id, name: row.name, kwLen: matchedKeyword.length };
    }
  }
  return best ? { id: best.id, name: best.name } : FALLBACK_CATEGORY;
}

// ── Title building per eBay guidelines ──
function buildTitle(vehicle, partName, partNumber, position) {
  // Template: [Year Range] [Make] [Model] [Position] [Part Name] [OEM Part#] OEM Used
  const parts = [];
  if (vehicle.year) parts.push(String(vehicle.year));
  if (vehicle.make) parts.push(vehicle.make);
  if (vehicle.model) parts.push(vehicle.model);
  if (position) parts.push(position);
  if (partName) parts.push(titleCase(partName));
  if (partNumber) parts.push(partNumber);
  parts.push('OEM Used');

  let title = parts.filter(Boolean).join(' ');
  // Enforce 80-char limit
  if (title.length > 80) {
    // Try dropping "OEM Used" first
    title = title.replace(/\s*OEM Used$/, '');
    if (title.length > 80) {
      title = title.substring(0, 77) + '...';
    }
  }
  return title;
}

// ── HTML Description builder — minimal inline-styled, no CSS bloat ──
// HTML Description builder. Takes the AI-enhanced description text
// directly. Deliberately no fitment/compatibility table here -- compatibility
// is fully populated as separate eBay Item Compatibility rows in the output
// (see below), not duplicated into the listing description.
function buildDescriptionHtml(descriptionText) {
  return `<div style="font-family:Arial,sans-serif;max-width:800px;margin:auto"><h2 style="background:#222;color:#fff;padding:10px;text-align:center">Product Information</h2><div style="padding:10px;border:1px solid #ddd;background:#f9f9f9"><p>${descriptionText}</p></div><div style="margin-top:10px"><b>Payment:</b> Online payment via eBay checkout.<br><b>Shipping:</b> Worldwide via DHL, FedEx or Aramex.<br><b>Returns:</b> 14-day returns accepted. Buyer pays return shipping.<br><b>Handling:</b> Ships within 3 business days.<br><b>International:</b> Import duties/taxes are buyer's responsibility.</div></div>`;
}

// ── MVL Database via pg — donor-year-scoped ──
async function queryMvl(vehicleMake, vehicleModel, donorYear) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'listingpro',
  });
  try {
    if (!vehicleMake) return [];
    // Find canonical make
    const makeRes = await pool.query(
      `SELECT DISTINCT make FROM ebay_mvl_entries WHERE marketplace = $1 AND make ILIKE $2 LIMIT 5`,
      ['US', vehicleMake],
    );
    if (makeRes.rows.length === 0) return [];
    const canonicalMake = makeRes.rows[0].make;

    if (!vehicleModel) return [];

    // Normalize model for matching: remove spaces, lowercase
    const normModel = vehicleModel.replace(/\s+/g, '').toLowerCase();

    // Try exact model match first (e.g., "TT" = "TT", "740Li" = "740Li", "IS250" = "IS250")
    let modelRes = await pool.query(
      `SELECT DISTINCT model FROM ebay_mvl_entries WHERE marketplace = $1 AND make = $2 AND LOWER(REPLACE(model, ' ', '')) = $3 LIMIT 5`,
      ['US', canonicalMake, normModel],
    );

    // Fallback: fuzzy ILIKE match
    if (modelRes.rows.length === 0) {
      modelRes = await pool.query(
        `SELECT DISTINCT model FROM ebay_mvl_entries WHERE marketplace = $1 AND make = $2 AND model ILIKE $3 LIMIT 5`,
        ['US', canonicalMake, `%${vehicleModel}%`],
      );
    }
    // Fallback: try partial model (e.g., "740Li" → try "740")
    if (modelRes.rows.length === 0 && normModel.length > 3) {
      const shorter = normModel.slice(0, Math.ceil(normModel.length * 0.6));
      modelRes = await pool.query(
        `SELECT DISTINCT model FROM ebay_mvl_entries WHERE marketplace = $1 AND make = $2 AND LOWER(REPLACE(model, ' ', '')) LIKE $3 LIMIT 5`,
        ['US', canonicalMake, `%${shorter}%`],
      );
    }
    if (modelRes.rows.length === 0) return [];
    const canonicalModel = modelRes.rows[0].model;

    // Get ALL entries for this make+model
    const allEntries = await pool.query(
      `SELECT DISTINCT year, trim, engine, submodel, display_name, epid FROM ebay_mvl_entries WHERE marketplace = $1 AND make = $2 AND model = $3 ORDER BY year`,
      ['US', canonicalMake, canonicalModel],
    );
    const all = allEntries.rows.map((r) => ({
      year: r.year, make: canonicalMake, model: canonicalModel,
      trim: r.trim || '', engine: r.engine || '', submodel: r.submodel || '',
      display_name: r.display_name || '', epid: r.epid || '',
    }));

    if (!donorYear || all.length === 0) return all;

    // Scope to donor year ± 5 years to find the correct generation
    const scoped = all.filter((r) => Math.abs(r.year - donorYear) <= 5);
    // If scoped results are too few (< 3), widen to ±8
    if (scoped.length < 3) {
      const wider = all.filter((r) => Math.abs(r.year - donorYear) <= 8);
      return wider.length > 0 ? wider : all;
    }
    return scoped;
  } finally {
    await pool.end();
  }
}

// ── Build compatibility string for eBay File Exchange — limit to 20 entries per cell ──
// AI description enhancement -- title/category/compatibility stay fully
// deterministic; AI is used only to polish the listing description text,
// grounded in the supplier's original description (no fabricated specs).
const AI_MODEL = process.env.PIPELINE_DESCRIPTION_AI_MODEL || process.env.OPENAI_CHAT_MODEL || 'openai/gpt-4o-mini';
const AI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';
const AI_CONCURRENCY = Math.max(1, Number(process.env.PIPELINE_AI_CONCURRENCY || '5') || 5);

let _openai = null;
function getOpenAI() {
  if (_openai) return _openai;
  if (!process.env.OPENAI_API_KEY) return null;
  _openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: AI_BASE_URL,
    defaultHeaders: { 'HTTP-Referer': 'https://realtrackapp.com', 'X-Title': 'RealTrackApp' },
  });
  return _openai;
}

function fallbackDescription(partName, partNumber, vehicle) {
  return `Used OEM ${titleCase(partName || '')} for ${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}. ${partNumber ? 'Part number ' + partNumber + '.' : ''} Please verify compatibility before purchasing.`;
}

async function enhanceDescription(rawDesc, partName, partNumber, vehicle) {
  const fallback = fallbackDescription(partName, partNumber, vehicle);
  const client = getOpenAI();
  if (!client) return { text: fallback, aiUsed: false };
  try {
    const resp = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You write concise, professional eBay used-auto-parts listing descriptions. 2-3 sentences, plain text (no markdown, no HTML). Do not invent specs not present in the input. Do not include a fitment/compatibility list -- that is provided separately. Mention it is a used OEM part.',
        },
        {
          role: 'user',
          content: `Part: ${partName || 'auto part'}\nOEM part number: ${partNumber || 'n/a'}\nVehicle: ${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}\nSupplier description: ${rawDesc || 'n/a'}`,
        },
      ],
      max_tokens: 150,
      temperature: 0.4,
    });
    const text = resp.choices?.[0]?.message?.content?.trim();
    return text ? { text, aiUsed: true } : { text: fallback, aiUsed: false };
  } catch (err) {
    console.log(`AI description enhancement failed for "${partName}": ${err.message} -- using fallback`);
    return { text: fallback, aiUsed: false };
  }
}

async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

// ── Main ──
async function main() {
  progress('vin_decode', { message: 'fast-mode: skipping VIN decode' });
  await sleep(100);
  progress('category_mapping', { message: 'fast-mode: skipping category mapping' });
  await sleep(100);
  progress('enrichment', { message: 'Starting fast enrichment pipeline' });

  // 1. Parse input XLSX
  console.log(`Reading input: ${INPUT}`);
  const wb = XLSX.readFile(INPUT);
  const sheetName = wb.SheetNames.find((n) => !/instruction/i.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log(`Sheet: ${sheetName}, ${rawRows.length} rows`);

  // Find data start (GridX format has info row at 0, headers at 1, data at 2+)
  let headerIdx = -1;
  for (let i = 0; i < Math.min(5, rawRows.length); i++) {
    const row = rawRows[i];
    if (row && row.some((c) => /part\s*number/i.test(String(c)))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    // Try less strict match
    for (let i = 0; i < Math.min(5, rawRows.length); i++) {
      const row = rawRows[i];
      if (row && row.some((c) => /part/i.test(String(c)))) {
        headerIdx = i;
        break;
      }
    }
  }
  if (headerIdx === -1) {
    console.error('Could not find header row');
    process.exit(1);
  }

  const headers = rawRows[headerIdx].map((h) => String(h ?? '').trim());
  console.log('Headers:', headers.join(', '));

  const colIdx = (name) => {
    const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return headers.findIndex((h) => h.toLowerCase().replace(/[^a-z0-9]/g, '').includes(norm));
  };

  const iPartNum = colIdx('partnumber') >= 0 ? colIdx('partnumber') : colIdx('part');
  const iPrice = colIdx('price');
  const iQty = colIdx('quantity');
  const iMake = colIdx('vehiclemake') >= 0 ? colIdx('vehiclemake') : colIdx('make');
  const iDesc = colIdx('description');
  const iImages = colIdx('imageurls') >= 0 ? colIdx('imageurls') : colIdx('image');
  const iSku = colIdx('sku');
  const iWeight = colIdx('weightmajor') >= 0 ? colIdx('weightmajor') : colIdx('weight');

  console.log(`Column indices: PartNum=${iPartNum} Price=${iPrice} Qty=${iQty} Make=${iMake} Desc=${iDesc} Images=${iImages} SKU=${iSku}`);

  // 2. Parse vehicle info from filename
  const originalFilename = process.env.PIPELINE_ORIGINAL_FILENAME || path.basename(INPUT);
  const vehicleInfo = extractVehicleFromFilename(originalFilename);
  console.log(`Vehicle from filename: year=${vehicleInfo.year} make=${vehicleInfo.make} model=${vehicleInfo.model} vin=${vehicleInfo.vin}`);

  // 3. Parse parts from data rows
  const parts = [];
  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    const partNumber = clean(row[iPartNum]);
    if (!partNumber) continue;

    const rawDesc = clean(row[iDesc]);
    const price = parseFloat(clean(row[iPrice])) || 0;
    const quantity = parseInt(clean(row[iQty])) || CONFIG.defaultQuantity;
    const make = clean(row[iMake]) || vehicleInfo.make || '';
    const sku = clean(row[iSku]) || '';
    const imageUrls = clean(row[iImages])
      .split(/[\n|]/)
      .map((u) => u.trim())
      .filter(Boolean);

    // Extract position from description
    const position = extractPosition(rawDesc);
    // Clean part name from description
    const partName = cleanPartName(rawDesc, make || vehicleInfo.make, vehicleInfo.model);

    parts.push({
      partNumber,
      rawDesc,
      price,
      quantity,
      make: titleCase(make || vehicleInfo.make || ''),
      sku,
      imageUrls,
      position,
      partName,
      year: vehicleInfo.year,
      model: vehicleInfo.model,
      vin: vehicleInfo.vin,
      weight: clean(row[iWeight]) || '',
      inputRow: i,
    });
  }

  console.log(`Parsed ${parts.length} parts from input`);
  progress('enrichment', { processed: 0, total: parts.length });

  // If no model from filename, try extracting from first part's description
  if (!vehicleInfo.model && parts.length > 0) {
    const firstDesc = parts[0].rawDesc || '';
    // Pattern 1: comma-separated "VIN, MAKE, MODEL, part name"
    const commaMatch = firstDesc.match(/^[A-HJ-NPR-Z0-9]{17}\s*,\s*[^,]+\s*,\s*([^,]+)/i);
    if (commaMatch) {
      const candidate = commaMatch[1].trim();
      if (candidate.length > 1 && candidate.length < 30) {
        vehicleInfo.model = candidate;
        console.log(`Extracted model from desc (comma): ${candidate}`);
      }
    }
    // Pattern 2: "YEAR MAKE MODEL part name" or other patterns
    if (!vehicleInfo.model) {
      const descMatch = firstDesc.match(/(?:^|\s|,\s*)([A-Z][A-Za-z0-9\s\-]+?)(?:\s*,|\s+(?:Used|OEM|Front|Rear|Left|Right|Upper|Lower|Inner|Outer|[A-Z]{2,}\d))/i);
      if (descMatch) {
        const candidate = descMatch[1].trim();
        if (candidate.length > 1 && candidate.length < 30 && !/part|gasket|seal|bolt|nut|clip|sensor|module|switch|motor|pump|hose|pipe|bracket|mount|arm|rod|bar|spring|shock|strut|bearing|bushing|gear|sprocket|chain|belt|filter|plug|cap|ring|pin|washer|spacer|adapter|connector|valve|actuator|cylinder|piston|crank|cam|shaft/i.test(candidate)) {
          vehicleInfo.model = candidate;
          console.log(`Extracted model from desc (pattern): ${candidate}`);
        }
      }
    }
  }

  // 4. MVL lookup for fitment
  console.log('Querying MVL for vehicle fitment...');
  let allFitments = [];
  try {
    allFitments = await queryMvl(
      vehicleInfo.make || parts[0]?.make || '',
      vehicleInfo.model || '',
      vehicleInfo.year,
    );
    console.log(`MVL returned ${allFitments.length} fitment entries`);
  } catch (err) {
    console.log(`MVL query failed: ${err.message}`);
  }

  // Build year range from MVL data — scoped to donor year ±5yr
  const mvlYears = allFitments.map((f) => f.year).filter(Boolean);
  const yearMin = mvlYears.length ? Math.min(...mvlYears) : vehicleInfo.year;
  const yearMax = mvlYears.length ? Math.max(...mvlYears) : vehicleInfo.year;
  const yearRange = yearMin === yearMax ? String(yearMin) : `${yearMin}-${yearMax}`;
  // Use MVL canonical model name when available
  const mvlModel = allFitments.length > 0 ? allFitments[0].model : (vehicleInfo.model || '');
  const mvlMake = allFitments.length > 0 ? allFitments[0].make : (vehicleInfo.make || '');
  console.log(`MVL year range: ${yearRange}, make=${mvlMake}, model=${mvlModel}, fitment entries=${allFitments.length}`);

  // 5. Build deterministic titles using MVL data (year always comes from MVL's
  // donor-year-scoped range, never guessed)
  for (const p of parts) {
    p.title = buildTitle(
      { year: yearRange, make: titleCase(mvlMake || p.make), model: mvlModel || p.model },
      p.partName,
      p.partNumber,
      p.position,
    );
    p.fitmentYearRange = yearRange;
  }

  // 6. AI-enhanced descriptions ─ title/category/compatibility remain deterministic;
  // AI only polishes the description text, grounded in the supplier's own description.
  console.log(`Enhancing ${parts.length} descriptions via AI (model=${AI_MODEL}, concurrency=${AI_CONCURRENCY})...`);
  let aiEnhancedCount = 0;
  let processedCount = 0;
  await mapWithConcurrency(parts, AI_CONCURRENCY, async (p) => {
    const vehicle = { year: yearRange, make: titleCase(mvlMake || p.make), model: mvlModel || p.model };
    const { text, aiUsed } = await enhanceDescription(p.rawDesc, p.partName, p.partNumber, vehicle);
    if (aiUsed) aiEnhancedCount++;
    p.descriptionHtml = buildDescriptionHtml(text);
    processedCount++;
    if (processedCount % 25 === 0 || processedCount === parts.length) {
      progress('enrichment', { processed: processedCount, total: parts.length });
    }
  });
  console.log(`AI-enhanced ${aiEnhancedCount}/${parts.length} descriptions (${parts.length - aiEnhancedCount} used fallback template)`);

  // 7. Generate output XLSX
  progress('output_generation', { message: 'Generating US-Motors output' });
  // Hardcoded headers matching what saveToCatalog parser expects — minimal, no unused columns
  const templateHeaders = [
    '*Action(SiteID=eBayMotors|Country=US|Currency=USD|Version=1193)',
    'Custom label (SKU)', 'Category ID', 'Category Name', 'Title', 'P:UPC',
    'Start price', 'Quantity', 'Condition ID', 'Description', 'Format', 'Duration',
    'Best Offer Enabled', 'Immediate pay required', 'Location', 'Max dispatch time',
    'Returns accepted option', 'Returns within option', 'Refund option',
    'Return shipping cost paid by', 'Shipping profile name', 'Return profile name',
    'Payment profile name', 'C:Brand', 'C:Type', 'C:Manufacturer Part Number',
    'C:OE/OEM Part Number', 'C:Placement on Vehicle', 'C:Fitment Type', 'C:Warranty',
    'C:Material', 'C:Country/Region of Manufacture', 'PicURL',
    'AdditionalPicURL', 'AdditionalPicURL1', 'AdditionalPicURL2', 'AdditionalPicURL3',
    'AdditionalPicURL4', 'AdditionalPicURL5', 'AdditionalPicURL6', 'AdditionalPicURL7',
    'AdditionalPicURL8', 'AdditionalPicURL9', 'AdditionalPicURL10', 'AdditionalPicURL11',
    'AdditionalPicURL12', 'AdditionalPicURL13', 'AdditionalPicURL14', 'AdditionalPicURL15',
    'AdditionalPicURL16', 'AdditionalPicURL17', 'AdditionalPicURL18', 'AdditionalPicURL19',
    'AdditionalPicURL20', 'AdditionalPicURL21', 'AdditionalPicURL22',
    'Relationship', 'Relationship details',
  ];

  // Build output rows
  const today = new Date().toISOString().split('T')[0];
  const outData = [
    ['#INFO', `Created=${Date.now()}`, null, null, null, null, ' Indicates missing required fields'],
    ['#INFO', 'Version=1.0', null, 'Template=fx_multi_category_template_EBAY_MOTOR', null, null, ' Indicates missing recommended field'],
    ['#INFO'],
    templateHeaders,
  ];

  for (const p of parts) {
    const row = new Array(templateHeaders.length).fill(null);
    const set = (colName, value) => {
      const idx = templateHeaders.findIndex((h) => h === colName || (typeof h === 'string' && h.toLowerCase() === colName.toLowerCase()));
      if (idx >= 0 && value !== undefined && value !== null && value !== '') row[idx] = value;
    };

    set('*Action(SiteID=eBayMotors|Country=US|Currency=USD|Version=1193)', 'Add');
    set('Custom label (SKU)', p.sku);
    const cat = resolveCategory(p.partName, p.rawDesc);
    set('Category ID', cat.id);
    set('Category Name', cat.name);
    set('Title', p.title);
    set('P:UPC', 'Does not apply');
    set('Start price', p.price);
    set('Quantity', p.quantity || CONFIG.defaultQuantity);
    set('Condition ID', CONFIG.defaultConditionId);
    set('Description', p.descriptionHtml);
    set('Format', CONFIG.defaultFormat);
    set('Duration', CONFIG.defaultDuration);
    set('Best Offer Enabled', 1);
    set('Immediate pay required', 1);
    set('Location', CONFIG.location);
    set('Max dispatch time', 3);
    set('Returns accepted option', 'ReturnsAccepted');
    set('Returns within option', 'Days_30');
    set('Refund option', 'MoneyBack');
    set('Return shipping cost paid by', 'Buyer');
    set('Shipping profile name', CONFIG.shippingProfile);
    set('Return profile name', CONFIG.returnProfile);
    set('Payment profile name', CONFIG.paymentProfile);
    set('C:Brand', p.make);
    set('C:Type', titleCase(p.partName));
    set('C:Manufacturer Part Number', p.partNumber);
    set('C:OE/OEM Part Number', p.partNumber);
    set('C:Placement on Vehicle', p.position || '');
    set('C:Fitment Type', 'Direct Replacement');
    set('C:Warranty', 'No Warranty');
    set('C:Country/Region of Manufacture', '');
    set('PicURL', p.imageUrls[0] || '');
    if (p.imageUrls.length > 1) set('AdditionalPicURL', p.imageUrls[1]);
    for (let i = 2; i < p.imageUrls.length && i < 24; i++) {
      set(`AdditionalPicURL${i - 1}`, p.imageUrls[i]);
    }
    set('fitment_year_range', p.fitmentYearRange);

    outData.push(row);

    // Fully populate eBay Item Compatibility -- one row per MVL fitment entry
    // (no cap), immediately following the product row per File Exchange format.
    const iRelationship = templateHeaders.indexOf('Relationship');
    const iRelationshipDetails = templateHeaders.indexOf('Relationship details');
    for (const f of allFitments) {
      const compatRow = new Array(templateHeaders.length).fill(null);
      compatRow[iRelationship] = 'Compatibility';
      compatRow[iRelationshipDetails] =
        `Make=${f.make || ''}|Model=${f.model || ''}|Year=${f.year || ''}|Trim=${f.trim || ''}|Engine=${f.engine || ''}|Submodel=${f.submodel || ''}`;
      outData.push(compatRow);
    }
  }

  // Write output as CSV — XLSX zip compression causes OOM in memory-constrained containers
  // XLSX.readFile parses CSV natively, and saveToCatalog uses XLSX.readFile to parse
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const csvLines = outData.map(row => row.map(cell => {
    if (cell == null) return '';
    const s = String(cell);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }).join(','));
  const outFile = path.join(OUTPUT_DIR, `US-Motors-Listings-${today}.csv`);
  fs.writeFileSync(outFile, csvLines.join('\n'));
  outData.length = 0;
  console.log(`Output: ${outFile} (${parts.length} listings, ${allFitments.length} fitment entries)`);

  // 8. Generate enrichment report
  const report = {
    jobId: JOB_ID,
    inputFile: path.basename(INPUT),
    inputParsedAt: new Date().toISOString(),
    totalInputParts: parts.length,
    totalAiEnriched: aiEnhancedCount,
    totalFallbackEnrichment: parts.length - aiEnhancedCount,
    totalListingsGenerated: parts.length,
    totalFitmentEntries: allFitments.length,
    yearRange: yearRange,
    enrichmentMode: 'fast-direct-ai-description',
    openai: { totalTokens: 0, defaultModel: AI_MODEL },
    categoryMapping: { categoryMode: 'default', apiMapped: 0, aiMapped: 0, fallbackMapped: parts.length },
    localization: { mode: 'fast-direct' },
    templatesGenerated: ['US-Motors'],
    errors: [],
  };
  const reportFile = path.join(OUTPUT_DIR, `enrichment-report-${today}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`Report: ${reportFile}`);

  // Write empty AI run logs for compatibility
  const logFile = path.join(OUTPUT_DIR, 'ai-run-logs.json');
  fs.writeFileSync(logFile, JSON.stringify({ runs: [], mode: 'fast-direct' }));

  progress('output_generation', { message: 'Complete', processed: parts.length, total: parts.length });
  console.log('Pipeline complete.');
}

main().catch((err) => {
  console.error('Pipeline failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});