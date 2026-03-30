#!/usr/bin/env node
/**
 * ebay-enrichment-pipeline.mjs
 * ═══════════════════════════════════════════════════════════════════════
 * eBay Motors VIN-to-Listing Enrichment Pipeline
 *
 * Processes VIN/parts inventory data through:
 *   1. NHTSA VIN Decoding
 *   2. eBay Taxonomy API (category + aspects)
 *   3. OpenAI Enrichment (titles, descriptions, specifics)
 *   4. eBay Compliance Validation
 *   5. Multi-template output generation (US Motors, AU, DE)
 *
 * Usage: node scripts/ebay-enrichment-pipeline.mjs
 * ═══════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import OpenAI from 'openai';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ═══════════════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════

function loadEnv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx < 0) continue;
    env[t.slice(0, idx).trim()] = t.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

// Load from both root and backend .env (root takes precedence for shared keys)
const backendEnv = loadEnv(path.resolve(ROOT, 'backend/.env'));
const rootEnv = fs.existsSync(path.resolve(ROOT, '.env'))
  ? loadEnv(path.resolve(ROOT, '.env'))
  : {};
const env = { ...backendEnv, ...rootEnv };

const CONFIG = {
  openai: {
    apiKey: env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',         // cost-effective for bulk; override with OPENAI_CHAT_MODEL
    batchSize: 25,                 // parts per OpenAI call
    concurrency: 3,                // parallel OpenAI calls
    temperature: 0.2,
    maxTokens: 6000,
    maxRetries: 3,
    delayBetweenCallsMs: 300,
  },
  ebay: {
    clientId: env.EBAY_CLIENT_ID,
    clientSecret: env.EBAY_CLIENT_SECRET,
    sandbox: env.EBAY_SANDBOX === 'true',
    get baseUrl() {
      return this.sandbox
        ? 'https://api.sandbox.ebay.com'
        : 'https://api.ebay.com';
    },
  },
  input: path.resolve(ROOT, 'Vins Report Status.xlsx'),
  templates: {
    us: path.resolve(ROOT, 'eBay-parts-and-accs-listing-template-Mar-28-2026-19-33-14.xlsx'),
    au: path.resolve(ROOT, 'eBay-category-listing-template-Mar-28-2026-19-39-50.xlsx'),
    de: path.resolve(ROOT, 'eBay-category-listing-template-Mar-28-2026-19-43-18.xlsx'),
  },
  outputDir: path.resolve(ROOT, 'output'),
  defaultConditionId: '3000',      // Used
  defaultQuantity: 1,
  defaultFormat: 'FixedPrice',
  defaultDuration: 'GTC',
  location: 'Dubai, AE',
};

// Override model from env if set
if (env.OPENAI_CHAT_MODEL) CONFIG.openai.model = env.OPENAI_CHAT_MODEL;

// ═══════════════════════════════════════════════════════════════════════
//  LOGGING & REPORTING
// ═══════════════════════════════════════════════════════════════════════

const REPORT = {
  totalInput: 0,
  totalProcessed: 0,
  totalFailed: 0,
  totalSkipped: 0,
  vinDecodeSuccess: 0,
  vinDecodeFail: 0,
  categoryMappingApi: 0,
  categoryMappingFallback: 0,
  openaiCalls: 0,
  openaiTokensUsed: 0,
  openaiErrors: 0,
  validationFixes: [],
  missingSpecifics: [],
  errors: [],
  startTime: Date.now(),
};

const log = {
  info:  (msg) => console.log(`[INFO]  ${new Date().toISOString().slice(11,19)} ${msg}`),
  warn:  (msg) => console.warn(`[WARN]  ${new Date().toISOString().slice(11,19)} ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString().slice(11,19)} ${msg}`),
  step:  (msg) => console.log(`\n${'═'.repeat(60)}\n  STEP: ${msg}\n${'═'.repeat(60)}`),
};

// ═══════════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════════

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function clean(v) { return v == null ? '' : String(v).trim(); }
function normalizePN(pn) { return clean(pn).replace(/[\s\-\.]/g, '').toUpperCase(); }
function titleCase(s) {
  return clean(s).replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}
function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ═══════════════════════════════════════════════════════════════════════
//  NHTSA VIN DECODER
// ═══════════════════════════════════════════════════════════════════════

const vinCache = new Map();

async function decodeVin(vin) {
  const cleaned = clean(vin).replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase();
  if (cleaned.length < 11) return null;

  // Use first 11 chars for caching (WMI + VDS + check digit)
  const cacheKey = cleaned.slice(0, 17);
  if (vinCache.has(cacheKey)) return vinCache.get(cacheKey);

  try {
    const { data } = await axios.get(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${encodeURIComponent(cleaned)}?format=json`,
      { timeout: 15000 }
    );

    const results = data.Results || [];
    const get = (varId) => {
      const r = results.find(r => r.VariableId === varId);
      return r && r.Value && r.Value !== 'Not Applicable' ? r.Value.trim() : '';
    };

    const decoded = {
      vin: cleaned,
      year: get(29) || '',          // Model Year
      make: get(26) || '',          // Make
      model: get(28) || '',         // Model
      trim: get(38) || '',          // Trim
      bodyClass: get(5) || '',      // Body Class
      engineCylinders: get(9) || '',
      engineDisplacement: get(11) || '',
      engineModel: get(18) || '',
      fuelType: get(24) || '',
      driveType: get(15) || '',
      plantCountry: get(75) || '',
      vehicleType: get(39) || '',
      manufacturer: get(27) || '',
    };

    vinCache.set(cacheKey, decoded);
    REPORT.vinDecodeSuccess++;
    return decoded;
  } catch (err) {
    log.warn(`VIN decode failed for ${cleaned}: ${err.message}`);
    REPORT.vinDecodeFail++;
    vinCache.set(cacheKey, null);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  EBAY TAXONOMY API CLIENT
// ═══════════════════════════════════════════════════════════════════════

let ebayAppToken = null;
let ebayTokenExpiry = 0;

async function getEbayAppToken() {
  if (ebayAppToken && Date.now() < ebayTokenExpiry - 60000) return ebayAppToken;

  const basic = Buffer.from(
    `${CONFIG.ebay.clientId}:${CONFIG.ebay.clientSecret}`
  ).toString('base64');

  try {
    const { data } = await axios.post(
      `${CONFIG.ebay.baseUrl}/identity/v1/oauth2/token`,
      'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
      {
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 15000,
      }
    );
    ebayAppToken = data.access_token;
    ebayTokenExpiry = Date.now() + (data.expires_in || 7200) * 1000;
    log.info('eBay application token acquired');
    return ebayAppToken;
  } catch (err) {
    log.error(`eBay token acquisition failed: ${err.response?.data?.error_description || err.message}`);
    return null;
  }
}

const categorySuggestionCache = new Map();

async function suggestCategory(keywords) {
  const cacheKey = keywords.toLowerCase().trim();
  if (categorySuggestionCache.has(cacheKey)) return categorySuggestionCache.get(cacheKey);

  const token = await getEbayAppToken();
  if (!token) return null;

  try {
    const { data } = await axios.get(
      `${CONFIG.ebay.baseUrl}/commerce/taxonomy/v1/category_tree/0/get_category_suggestions`,
      {
        params: { q: keywords },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      }
    );

    const suggestions = data.categorySuggestions || [];
    if (suggestions.length > 0) {
      const best = suggestions[0];
      const result = {
        categoryId: best.category?.categoryId,
        categoryName: best.category?.categoryName,
        categoryPath: best.categoryTreeNodeAncestors?.map(a => a.categoryName).join(' > ') || '',
      };
      categorySuggestionCache.set(cacheKey, result);
      REPORT.categoryMappingApi++;
      return result;
    }
  } catch (err) {
    log.warn(`eBay category suggestion failed for "${keywords}": ${err.message}`);
  }

  categorySuggestionCache.set(cacheKey, null);
  return null;
}

const aspectCache = new Map();

async function getCategoryAspects(categoryId) {
  if (aspectCache.has(categoryId)) return aspectCache.get(categoryId);

  const token = await getEbayAppToken();
  if (!token) return null;

  try {
    const { data } = await axios.get(
      `${CONFIG.ebay.baseUrl}/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category`,
      {
        params: { category_id: categoryId },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      }
    );

    const aspects = (data.aspects || []).map(a => ({
      name: a.localizedAspectName,
      required: a.aspectConstraint?.aspectRequired || false,
      mode: a.aspectConstraint?.aspectMode || 'FREE_TEXT',
      values: (a.aspectValues || []).map(v => v.localizedValue),
      usage: a.aspectConstraint?.aspectUsage || 'RECOMMENDED',
    }));

    aspectCache.set(categoryId, aspects);
    return aspects;
  } catch (err) {
    log.warn(`eBay aspects fetch failed for category ${categoryId}: ${err.message}`);
    aspectCache.set(categoryId, null);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  FALLBACK CATEGORY MAPPING
// ═══════════════════════════════════════════════════════════════════════

const CATEGORY_KEYWORDS = [
  // Doors & related
  { kw: ['complete door', 'door assembly', 'door front', 'door rear', 'driver door', "driver's door", 'door body-in-white', 'door, body'], id: '174105', name: 'Doors & Door Parts' },
  { kw: ['door panel', 'door skin', 'exterior door'], id: '33697', name: 'Exterior Door Panels & Frames' },
  { kw: ['interior door', 'door moulding', 'door trim', 'door armrest', 'door finisher', 'inner panel'], id: '33695', name: 'Interior Door Panels & Parts' },
  { kw: ['door handle', 'handle strip'], id: '174106', name: 'Door Handles' },
  { kw: ['door hinge', 'hinge upper', 'hinge lower', 'hinge front'], id: '174107', name: 'Door Hinges' },
  { kw: ['door lock', 'door latch', 'lock actuator', 'system latch', 'lock with code', 'central locking', 'd gate'], id: '174108', name: 'Door Lock Actuators, Latches & Related' },
  { kw: ['window regulator', 'window lifter', 'window motor', 'drive for window'], id: '174085', name: 'Window Motors, Parts & Accessories' },
  { kw: ['window glass', 'door glass', 'quarter glass'], id: '33843', name: 'Auto Glass' },
  { kw: ['door seal', 'door sealing', 'weatherstrip', 'weather strip', 'belt weatherstrip', 'circumf'], id: '33712', name: 'Window Sweeps, Felts & Weatherstrips' },
  { kw: ['mirror', 'side mirror', 'rearview'], id: '33726', name: 'Exterior Mirrors' },
  { kw: ['door brake', 'door stop', 'door check', 'check arm', 'door damping'], id: '174105', name: 'Doors & Door Parts' },
  // Audio & electronics
  { kw: ['speaker', 'tweeter', 'woofer', 'subwoofer', 'amplifier', 'sound system'], id: '174920', name: 'Car Speakers' },
  { kw: ['radio', 'stereo', 'head unit', 'infotainment', 'navigation', 'sat nav', 'display screen', 'multimedia'], id: '174921', name: 'Car Audio & Video Installation' },
  // Computers & modules
  { kw: ['control unit', 'module', 'ecu', 'ecm', 'tcm', 'bcm', 'sam module', 'abs module'], id: '33596', name: 'Engine Computers' },
  // Wiring
  { kw: ['wiring', 'harness', 'cable', 'loom'], id: '174924', name: 'Wiring Harnesses' },
  { kw: ['switch', 'button', 'control panel', 'window switch', 'master switch'], id: '174917', name: 'Switches & Controls' },
  // Body panels
  { kw: ['fender', 'wing', 'fender liner', 'wheel arch'], id: '33718', name: 'Fenders' },
  { kw: ['bumper', 'bumper cover', 'bumper support', 'bumper bracket'], id: '33719', name: 'Bumpers & Parts' },
  { kw: ['hood', 'bonnet', 'hood hinge', 'hood latch'], id: '174083', name: 'Hoods' },
  { kw: ['trunk', 'boot', 'rear lid', 'tailgate', 'trunk lid', 'liftgate'], id: '174849', name: 'Trunk Lids & Parts' },
  { kw: ['grille', 'grill', 'front grille'], id: '33720', name: 'Grilles' },
  { kw: ['roof', 'sunroof', 'panoramic', 'roof panel', 'roof rack'], id: '33721', name: 'Roofs' },
  // Lighting
  { kw: ['headlight', 'headlamp', 'head light', 'head lamp', 'hid', 'xenon'], id: '33710', name: 'Headlights' },
  { kw: ['tail light', 'taillight', 'rear light', 'rear lamp', 'brake light', 'stop light'], id: '33717', name: 'Tail Lights' },
  { kw: ['fog light', 'fog lamp', 'driving light'], id: '33715', name: 'Fog Lights' },
  { kw: ['turn signal', 'indicator', 'side marker', 'corner light'], id: '33714', name: 'Turn Signals' },
  // Safety
  { kw: ['air bag', 'airbag', 'srs', 'crash sensor'], id: '174098', name: 'Air Bags' },
  { kw: ['seat belt', 'seatbelt', 'belt pretensioner', 'belt buckle'], id: '174099', name: 'Seat Belts & Parts' },
  // Interior
  { kw: ['seat', 'seat cushion', 'seat back', 'seat frame', 'headrest'], id: '174089', name: 'Seats' },
  { kw: ['dashboard', 'dash panel', 'instrument cluster', 'instrument panel', 'gauge cluster', 'speedometer'], id: '33717', name: 'Dashboards & Dashboard Parts' },
  { kw: ['steering wheel', 'steering column', 'steering shaft', 'clock spring'], id: '33588', name: 'Steering Wheels & Horns' },
  { kw: ['center console', 'console lid', 'armrest console'], id: '174090', name: 'Center Consoles' },
  { kw: ['sun visor', 'visor'], id: '174091', name: 'Sun Visors' },
  { kw: ['carpet', 'floor mat', 'floor liner'], id: '174092', name: 'Floor Mats & Carpets' },
  { kw: ['glove box', 'glovebox'], id: '174093', name: 'Glove Boxes' },
  // Engine & drivetrain
  { kw: ['engine', 'motor assembly', 'long block', 'short block', 'engine block'], id: '33615', name: 'Complete Engines' },
  { kw: ['transmission', 'gearbox', 'transaxle', 'transfer case'], id: '33616', name: 'Complete Manual Transmissions' },
  { kw: ['turbo', 'turbocharger', 'supercharger', 'blower'], id: '174934', name: 'Turbo Chargers & Parts' },
  { kw: ['alternator', 'generator'], id: '33615', name: 'Alternators & Generators' },
  { kw: ['starter', 'starter motor'], id: '33617', name: 'Starters' },
  { kw: ['radiator', 'intercooler', 'charge air cooler'], id: '33613', name: 'Radiators & Parts' },
  { kw: ['exhaust', 'muffler', 'catalytic converter', 'exhaust manifold', 'downpipe'], id: '33619', name: 'Exhaust Parts' },
  { kw: ['fuel pump', 'fuel injector', 'fuel rail', 'fuel tank'], id: '33554', name: 'Fuel Pumps & Sending Units' },
  { kw: ['water pump', 'thermostat', 'coolant'], id: '33613', name: 'Radiators & Parts' },
  { kw: ['oil pump', 'oil pan', 'oil filter', 'dipstick'], id: '174938', name: 'Oil System Parts' },
  { kw: ['intake manifold', 'throttle body', 'air filter', 'mass air flow', 'maf'], id: '33547', name: 'Air Intake & Fuel Delivery' },
  // Suspension & steering
  { kw: ['shock', 'strut', 'shock absorber', 'air suspension', 'spring'], id: '33579', name: 'Shocks & Struts' },
  { kw: ['control arm', 'ball joint', 'tie rod', 'sway bar', 'stabilizer', 'bushing'], id: '33580', name: 'Control Arms & Parts' },
  { kw: ['wheel hub', 'wheel bearing', 'hub assembly', 'knuckle', 'spindle'], id: '33582', name: 'Wheel Hubs & Bearings' },
  { kw: ['power steering', 'steering rack', 'steering pump', 'steering gear'], id: '33586', name: 'Power Steering Pumps & Parts' },
  // Brakes
  { kw: ['brake caliper', 'brake disc', 'brake rotor', 'brake pad', 'brake shoe', 'abs sensor'], id: '33559', name: 'Brake Discs, Rotors & Hardware' },
  { kw: ['brake master', 'brake booster', 'brake line', 'brake hose'], id: '33560', name: 'Brake Master Cylinders & Parts' },
  // AC & heating
  { kw: ['a/c', 'ac compressor', 'condenser', 'evaporator', 'heater core', 'blower motor', 'climate control', 'hvac'], id: '33553', name: 'A/C & Heater Controls' },
  // Trim & accessories  
  { kw: ['water shield', 'vapor barrier'], id: '174105', name: 'Doors & Door Parts' },
  { kw: ['sound absorber', 'insulation', 'damping', 'deadening'], id: '174105', name: 'Doors & Door Parts' },
  { kw: ['trim strip', 'moulding', 'molding', 'garnish', 'decal', 'emblem', 'badge'], id: '33694', name: 'Body Kits' },
  { kw: ['bolt', 'screw', 'nut', 'fastener', 'clip', 'rivet', 'cable holder', 'torx'], id: '174907', name: 'Nuts, Bolts & Fasteners' },
  // Wheels & tires  
  { kw: ['wheel', 'rim', 'alloy wheel', 'hubcap'], id: '33592', name: 'Wheels' },
  { kw: ['tire', 'tyre'], id: '66471', name: 'Tires' },
  // Cooling
  { kw: ['fan', 'cooling fan', 'fan shroud', 'fan clutch'], id: '176658', name: 'Fans & Kits' },
  // Axle & CV
  { kw: ['axle', 'cv joint', 'drive shaft', 'half shaft', 'cv axle', 'propeller shaft'], id: '174935', name: 'CV Joints & Parts' },
];

function fallbackCategoryMatch(partName, note) {
  const text = `${partName} ${note}`.toLowerCase();
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.kw.some(kw => text.includes(kw))) {
      return { categoryId: entry.id, categoryName: entry.name };
    }
  }
  // Default: generic auto parts & accessories category (not Doors & Door Parts)
  return { categoryId: '262124', categoryName: 'Car & Truck Parts & Accessories' };
}

// ═══════════════════════════════════════════════════════════════════════
//  INPUT PARSER
// ═══════════════════════════════════════════════════════════════════════

function parseInputFile(filePath) {
  log.step('Parsing Input File');
  const wb = XLSX.readFile(filePath);
  const vinSheets = wb.SheetNames.filter(n => n !== 'All Vins');
  const allParts = [];

  for (const sheetName of vinSheets) {
    const ws = wb.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (rawData.length < 2) continue;

    const headers = rawData[0].map(h => clean(h).toLowerCase());
    const colMap = buildColumnMap(headers);

    let sheetParts = 0;
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || !row.some(c => c != null && c !== '')) continue;

      const part = extractPart(row, colMap, sheetName);
      if (part.partName || part.partNumber) {
        allParts.push(part);
        sheetParts++;
      }
    }
    log.info(`  Sheet "${sheetName}": ${sheetParts} parts`);
  }

  REPORT.totalInput = allParts.length;
  log.info(`Total parts parsed: ${allParts.length} from ${vinSheets.length} VIN sheets`);
  return allParts;
}

function buildColumnMap(headers) {
  const map = {
    sku: -1, brand: -1, model: -1, vin: -1,
    category: -1, partNumber: -1, partName: -1,
    note: -1, code: -1, price: -1,
  };

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h) continue;

    if (h === 'sku') map.sku = i;
    if (h === 'brand') map.brand = i;
    if (h === 'model') map.model = i;
    if (h === 'vin') map.vin = i;
    if (h === 'category') map.category = i;
    if (h === 'part number') map.partNumber = i;
    if (h === 'name' && map.partName === -1) map.partName = i;     // first "Name" col = part name
    if (h === 'part name') map.partName = i;                        // explicit "Part Name"
    if (h === 'note' || h === 'notes') map.note = i;
    if (h === 'code') map.code = i;
    if (h === 'price') map.price = i;
  }

  // Handle variant layouts:
  // Some sheets: [SKU, Brand, Model, VIN, Category, Name, PartNumber, PartName, Code, null, Price]
  // Others:      [Brand, Name, Model, VIN, SKU, Category, PartNumber, Name, Code, Notes, Price]
  // Fix: if "name" appears twice, second is partName
  const nameIndices = [];
  for (let i = 0; i < headers.length; i++) {
    if (headers[i] === 'name') nameIndices.push(i);
  }
  if (nameIndices.length === 2) {
    // First "Name" in Brand/Name/Model layout = vehicle name → treat as partName context
    // Second "Name" = part name
    // But also check if "part number" is between them
    map.partName = nameIndices[1];
    // If first "Name" col is index 1 and we have Brand at 0, it's a model alias
    if (nameIndices[0] === 1 && map.brand === 0) {
      // "Name" at index 1 is the vehicle name (Brand Name Model format)
      // Keep partName as second Name
    }
  }

  // If price is still not found, check last column
  if (map.price === -1) {
    for (let i = headers.length - 1; i >= 0; i--) {
      if (headers[i] === 'price') { map.price = i; break; }
    }
    // If still not found, last non-null header
    if (map.price === -1) map.price = headers.length - 1;
  }

  return map;
}

function extractPart(row, colMap, sheetVin) {
  const getVal = (idx) => idx >= 0 && idx < row.length ? clean(row[idx]) : '';

  return {
    vin: getVal(colMap.vin) || sheetVin,
    brand: getVal(colMap.brand),
    model: getVal(colMap.model),
    sku: getVal(colMap.sku) || getVal(colMap.category),
    category: getVal(colMap.category),
    partNumber: getVal(colMap.partNumber),
    partName: getVal(colMap.partName),
    note: getVal(colMap.note),
    code: getVal(colMap.code),
    price: parseFloat(row[colMap.price]) || 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  VIN DECODE + VEHICLE DATA
// ═══════════════════════════════════════════════════════════════════════

async function decodeAllVins(parts) {
  log.step('VIN Decoding (NHTSA API)');
  const uniqueVins = [...new Set(parts.map(p => p.vin).filter(v => v.length >= 11))];
  log.info(`Decoding ${uniqueVins.length} unique VINs...`);

  const results = new Map();
  for (const vin of uniqueVins) {
    const decoded = await decodeVin(vin);
    if (decoded) {
      results.set(vin, decoded);
      log.info(`  ✓ ${vin} → ${decoded.year} ${decoded.make} ${decoded.model}`);
    } else {
      log.warn(`  ✗ ${vin} → decode failed, using sheet data`);
    }
    await sleep(200); // Rate limiting
  }

  log.info(`VIN decode: ${REPORT.vinDecodeSuccess} success, ${REPORT.vinDecodeFail} failed`);
  return results;
}

function getVehicleInfo(part, vinData) {
  const decoded = vinData.get(part.vin);
  if (decoded) {
    return {
      year: decoded.year,
      make: decoded.make,
      model: decoded.model,
      trim: decoded.trim,
      engine: decoded.engineModel || `${decoded.engineDisplacement}L ${decoded.engineCylinders}cyl`,
      bodyClass: decoded.bodyClass,
      engineCylinders: decoded.engineCylinders,
      engineDisplacement: decoded.engineDisplacement,
      fuelType: decoded.fuelType,
      driveType: decoded.driveType,
    };
  }

  // Fallback: parse from sheet data
  const brand = titleCase(part.brand);
  const model = part.model;
  // Try to extract year from model string (e.g. "XF 2009 - 2015 (X250)")
  const yearMatch = model.match(/\b(19|20)\d{2}\b/);
  return {
    year: yearMatch ? yearMatch[0] : '',
    make: brand,
    model: model.replace(/\d{4}[\s\-]*/g, '').replace(/\(.*?\)/g, '').trim(),
    trim: '',
    engine: '',
    bodyClass: '',
    engineCylinders: '',
    engineDisplacement: '',
    fuelType: '',
    driveType: '',
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  CATEGORY MAPPING
// ═══════════════════════════════════════════════════════════════════════

async function mapCategories(parts, vinData) {
  log.step('Category Mapping (eBay Taxonomy API + Fallback)');

  // Group by unique part name patterns
  const partTypeCache = new Map();
  let apiAttempts = 0;

  for (const part of parts) {
    const vehicle = getVehicleInfo(part, vinData);
    const partKey = `${part.partName}|${part.note}`.toLowerCase();

    if (partTypeCache.has(partKey)) {
      part._category = partTypeCache.get(partKey);
      continue;
    }

    // Try eBay Taxonomy API first
    const keywords = `${vehicle.make} ${part.partName}`.replace(/[^\w\s]/g, ' ').trim();
    let category = null;

    if (apiAttempts < 100) { // Limit API calls
      category = await suggestCategory(keywords);
      apiAttempts++;
      if (apiAttempts % 20 === 0) await sleep(1000);
    }

    if (!category) {
      category = fallbackCategoryMatch(part.partName, part.note);
      REPORT.categoryMappingFallback++;
    }

    part._category = category;
    partTypeCache.set(partKey, category);
  }

  log.info(`Category mapping: ${REPORT.categoryMappingApi} via API, ${REPORT.categoryMappingFallback} fallback`);
}

// ═══════════════════════════════════════════════════════════════════════
//  OPENAI ENRICHMENT ENGINE
// ═══════════════════════════════════════════════════════════════════════

let _openai = null;
let openaiAvailable = false;

function getOpenAI() {
  if (!_openai) {
    if (!CONFIG.openai.apiKey) {
      log.warn('OPENAI_API_KEY not set — AI enrichment will use fallback mode');
      return null;
    }
    _openai = new OpenAI({ apiKey: CONFIG.openai.apiKey });
  }
  return _openai;
}

async function validateOpenAiKey() {
  const client = getOpenAI();
  if (!client) return false;

  try {
    const response = await client.chat.completions.create({
      model: CONFIG.openai.model,
      messages: [{ role: 'user', content: 'Reply with OK' }],
      max_tokens: 5,
    });
    if (response.choices?.[0]?.message?.content) {
      openaiAvailable = true;
      log.info('OpenAI API key validated successfully');
      return true;
    }
  } catch (err) {
    log.error(`OpenAI API key invalid: ${err.message}`);
  }
  return false;
}

async function enrichBatch(batchParts, vinData) {
  const partsForPrompt = batchParts.map((part, idx) => {
    const vehicle = getVehicleInfo(part, vinData);
    return {
      index: idx,
      sku: part.sku,
      brand: part.brand,
      vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim(),
      vehicleYear: vehicle.year,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      vehicleTrim: vehicle.trim,
      partName: part.partName,
      partNumber: part.partNumber,
      note: part.note,
      category: part._category?.categoryName || '',
      price: part.price,
    };
  });

  const systemPrompt = `You are a world-class eBay Motors Parts & Accessories listing expert with deep knowledge of automotive parts, OEM cross-references, and eBay SEO best practices.

TASK: Enrich automotive parts from dismantled vehicles into eBay-ready listings.

TITLE RULES (max 80 chars):
- Format: [Year] [Make] [Model] [PartName] [Key Detail] [MPN/OEM#]
- Lead with highest-value search terms (year+make+model)
- Include condition indicator for used parts: "OEM", "Genuine", or "Used"
- Never use ALL CAPS, special characters (!@#$%), or filler words ("Nice", "Great", "L@@K")
- Include placement (Left/Right/Front/Rear) when relevant
- End with MPN or OEM number if space permits
- Example: "2015 Mercedes C300 W205 Front Left Door Lock Actuator A2057200135 OEM"

DESCRIPTION RULES:
- Professional HTML with structured sections
- Include: Part identification, Vehicle fitment, Condition assessment, Compatibility notes
- Always include disclaimer: "Please verify part number compatibility before purchasing"
- Format: <h3>Title</h3><p>intro</p><h4>Details</h4><ul><li>...</li></ul><h4>Compatibility</h4><p>...</p><h4>Condition</h4><p>Used - Removed from running vehicle. Inspected and tested.</p>

SPECIFICS RULES:
- brand: Use OEM vehicle manufacturer name (e.g., "Mercedes-Benz" not "Mercedes")
- type: Specific part type (e.g., "Door Lock Actuator" not "Door Parts")
- mpn: ONLY use the provided partNumber — NEVER fabricate part numbers
- oemNumber: Same as mpn unless explicitly different in source data
- placement: Extract from notes/name (e.g., "Front Left", "Rear Right", "Upper", "Lower")
- material: Only if determinable from part type (e.g., "Aluminum" for engine blocks, "Steel" for hinges)
- warranty: "No Warranty" for used parts
- fitmentType: "Direct Replacement" for OEM parts
- color: Only if determinable from notes (never guess)
- interchangeNumber: Only if provided in source data — NEVER fabricate

Return JSON: {"items":[{"index":N,"title":"...","description":"<h3>...</h3>...","brand":"...","type":"...","mpn":"...","oemNumber":"...","placement":"...","material":"...","warranty":"No Warranty","fitmentType":"Direct Replacement","color":"","interchangeNumber":"","surfaceFinish":"","performanceType":"","bundleDescription":""}]}`;

  const userPrompt = `Enrich these ${partsForPrompt.length} automotive parts for eBay Motors listings. Each part was removed from a real vehicle identified by VIN. Use the vehicle info to generate accurate fitment data.\n\n${JSON.stringify(partsForPrompt, null, 2)}`;

  const client = getOpenAI();
  if (!client) return null;

  for (let attempt = 1; attempt <= CONFIG.openai.maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: CONFIG.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: CONFIG.openai.temperature,
        max_tokens: CONFIG.openai.maxTokens,
        response_format: { type: 'json_object' },
      });

      REPORT.openaiCalls++;
      const usage = response.usage;
      if (usage) REPORT.openaiTokensUsed += (usage.total_tokens || 0);

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty OpenAI response');

      const parsed = JSON.parse(content);
      // Handle both { items: [...] } and direct array
      const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.results || parsed.parts || [parsed]);

      return items;
    } catch (err) {
      REPORT.openaiErrors++;
      if (attempt < CONFIG.openai.maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        log.warn(`OpenAI call failed (attempt ${attempt}/${CONFIG.openai.maxRetries}): ${err.message}. Retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        log.error(`OpenAI enrichment failed after ${CONFIG.openai.maxRetries} attempts: ${err.message}`);
        return null;
      }
    }
  }
  return null;
}

async function enrichAllParts(parts, vinData) {
  log.step('OpenAI Enrichment');

  // Validate API key first
  if (!await validateOpenAiKey()) {
    log.warn('OpenAI unavailable — using fallback enrichment for all parts');
    for (const part of parts) {
      const vehicle = getVehicleInfo(part, vinData);
      const pn = normalizePN(part.partNumber);
      part._enriched = {
        title: buildSeoTitle(vehicle, part, pn),
        description: buildBasicDescription(part, vehicle),
        brand: normalizeBrand(part.brand) || vehicle.make,
        type: titleCase(part.partName),
        mpn: pn,
        oemNumber: part.partNumber,
        placement: extractPlacement(part.note),
        material: '',
        warranty: 'No Warranty',
        fitmentType: 'Direct Replacement',
        color: '',
        interchangeNumber: '',
        surfaceFinish: '',
        performanceType: '',
        bundleDescription: '',
      };
      REPORT.totalFailed++;
    }
    return;
  }

  const batches = chunk(parts, CONFIG.openai.batchSize);
  log.info(`Processing ${parts.length} parts in ${batches.length} batches of ${CONFIG.openai.batchSize}...`);

  let enrichedCount = 0;
  let failedCount = 0;
  const concurrency = CONFIG.openai.concurrency;

  // Process batches in parallel groups
  for (let groupStart = 0; groupStart < batches.length; groupStart += concurrency) {
    const groupBatches = batches.slice(groupStart, groupStart + concurrency);

    log.info(`  Batches ${groupStart + 1}-${Math.min(groupStart + concurrency, batches.length)}/${batches.length} (${groupBatches.reduce((s, b) => s + b.length, 0)} parts)...`);

    const results = await Promise.allSettled(
      groupBatches.map(batch => enrichBatch(batch, vinData))
    );

    for (let i = 0; i < results.length; i++) {
      const batch = groupBatches[i];
      const result = results[i];
      const enrichedItems = result.status === 'fulfilled' ? result.value : null;

      if (enrichedItems) {
        for (const enriched of enrichedItems) {
          const idx = enriched.index ?? enrichedItems.indexOf(enriched);
          if (idx >= 0 && idx < batch.length) {
            const part = batch[idx];
            part._enriched = {
              title: clean(enriched.title).slice(0, 80),
              description: clean(enriched.description),
              brand: clean(enriched.brand),
              type: clean(enriched.type),
              mpn: clean(enriched.mpn),
              oemNumber: clean(enriched.oemNumber),
              placement: clean(enriched.placement),
              material: clean(enriched.material),
              warranty: clean(enriched.warranty) || 'No Warranty',
              fitmentType: clean(enriched.fitmentType) || 'Direct Replacement',
              color: clean(enriched.color),
              interchangeNumber: clean(enriched.interchangeNumber),
              surfaceFinish: clean(enriched.surfaceFinish),
              performanceType: clean(enriched.performanceType),
              bundleDescription: clean(enriched.bundleDescription),
            };
            enrichedCount++;
          }
        }
      } else {
        for (const part of batch) {
          const vehicle = getVehicleInfo(part, vinData);
          const pn = normalizePN(part.partNumber);
          part._enriched = {
            title: buildSeoTitle(vehicle, part, pn),
            description: buildBasicDescription(part, vehicle),
            brand: titleCase(part.brand) || vehicle.make,
            type: titleCase(part.partName),
            mpn: pn,
            oemNumber: part.partNumber,
            placement: extractPlacement(part.note),
            material: '',
            warranty: 'No Warranty',
            fitmentType: 'Direct Replacement',
            color: '',
            interchangeNumber: '',
            surfaceFinish: '',
            performanceType: '',
            bundleDescription: '',
          };
          failedCount++;
        }
      }
    }

    // Rate limiting between parallel groups
    if (groupStart + concurrency < batches.length) {
      await sleep(CONFIG.openai.delayBetweenCallsMs);
    }
  }

  REPORT.totalProcessed = enrichedCount;
  REPORT.totalFailed = failedCount;
  log.info(`Enrichment complete: ${enrichedCount} enriched, ${failedCount} basic fallback`);
}

/**
 * Build an SEO-optimized eBay title following best practices.
 * Format: [Year] [Make] [Model] [Part Name] [Placement] [MPN] OEM
 * Max 80 chars.
 */
function buildSeoTitle(vehicle, part, normalizedPN) {
  const placement = extractPlacement(part.note);
  const partName = titleCase(part.partName);

  // Build title segments in priority order
  const segments = [
    vehicle.year,
    vehicle.make,
    vehicle.model,
    partName,
  ].filter(Boolean);

  let title = segments.join(' ');

  // Add placement if room
  if (placement && (title.length + placement.length + 1) <= 69) {
    title += ` ${placement}`;
  }

  // Add part number if room
  if (normalizedPN && (title.length + normalizedPN.length + 1) <= 75) {
    title += ` ${normalizedPN}`;
  }

  // Add OEM marker if room
  if ((title.length + 4) <= 80) {
    title += ' OEM';
  }

  return title.replace(/\s+/g, ' ').slice(0, 80).trim();
}

function buildBasicDescription(part, vehicle) {
  const pn = part.partNumber ? `<li><strong>Part Number:</strong> ${part.partNumber}</li>` : '';
  const placement = extractPlacement(part.note);
  const placementLi = placement ? `<li><strong>Placement:</strong> ${placement}</li>` : '';
  const noteLi = part.note ? `<li><strong>Notes:</strong> ${part.note}</li>` : '';
  const brandName = normalizeBrand(part.brand) || vehicle.make;

  return `<h3>${vehicle.year} ${vehicle.make} ${vehicle.model} ${titleCase(part.partName)}</h3>
<p>Genuine OEM ${titleCase(part.partName)} removed from a ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}. This part has been carefully removed and inspected for quality assurance.</p>
<h4>Part Details</h4>
<ul>
  <li><strong>Brand:</strong> ${brandName}</li>
  <li><strong>Part Type:</strong> ${titleCase(part.partName)}</li>
  ${pn}
  <li><strong>Vehicle:</strong> ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}</li>
  ${placementLi}
  ${noteLi}
</ul>
<h4>Condition</h4>
<p>Used — Removed from a running vehicle. Visually inspected and verified functional. Normal wear consistent with age and mileage.</p>
<h4>Compatibility</h4>
<p>This part was removed from a ${vehicle.year} ${vehicle.make} ${vehicle.model}. Please verify part number compatibility with your vehicle before purchasing. Cross-reference the part number to confirm fitment.</p>
<h4>Warranty & Returns</h4>
<p>Sold as-is with no warranty. 30-day return policy if item is not as described.</p>`;
}

function extractPlacement(note) {
  const n = (note || '').toLowerCase();
  const parts = [];
  if (n.includes('front')) parts.push('Front');
  if (n.includes('rear') || n.includes('back')) parts.push('Rear');
  if (n.includes('left') || n.includes('lh') || n.includes('driver')) parts.push('Left');
  if (n.includes('right') || n.includes('rh') || n.includes('passenger')) parts.push('Right');
  if (n.includes('upper') || n.includes('top')) parts.push('Upper');
  if (n.includes('lower') || n.includes('bottom')) parts.push('Lower');
  return parts.join(', ') || '';
}

// ═══════════════════════════════════════════════════════════════════════
//  COMPLIANCE VALIDATION
// ═══════════════════════════════════════════════════════════════════════

function validateAndFix(parts) {
  log.step('Compliance Validation');
  let fixes = 0;

  for (const part of parts) {
    if (!part._enriched) continue;
    const e = part._enriched;

    // Title length check
    if (e.title.length > 80) {
      e.title = e.title.slice(0, 77) + '...';
      REPORT.validationFixes.push({ sku: part.sku, field: 'title', fix: 'truncated to 80 chars' });
      fixes++;
    }

    // Title must not be empty
    if (!e.title) {
      const vehicle = getVehicleInfo(part, vinCache);
      e.title = `${part.brand} ${part.partName} ${part.partNumber}`.slice(0, 80).trim();
      fixes++;
    }

    // Brand normalization
    e.brand = normalizeBrand(e.brand || part.brand);

    // MPN: must not be fabricated — only use raw part number
    if (e.mpn && normalizePN(e.mpn) !== normalizePN(part.partNumber)) {
      // AI might have cleaned the format; keep if it's a normalized version
      const rawNorm = normalizePN(part.partNumber);
      const aiNorm = normalizePN(e.mpn);
      if (rawNorm && aiNorm && !aiNorm.includes(rawNorm) && !rawNorm.includes(aiNorm)) {
        // Divergent — revert to original
        e.mpn = part.partNumber;
        REPORT.validationFixes.push({ sku: part.sku, field: 'mpn', fix: 'reverted to original part number' });
        fixes++;
      }
    }

    // OEM number: must match source data
    if (!e.oemNumber) e.oemNumber = part.partNumber;

    // Price validation
    if (part.price <= 0) {
      part.price = 49.99; // Reasonable default
      REPORT.validationFixes.push({ sku: part.sku, field: 'price', fix: 'set default price 49.99' });
      fixes++;
    }

    // Description: must not be empty
    if (!e.description || e.description.length < 50) {
      const vehicle = getVehicleInfo(part, vinCache);
      e.description = buildBasicDescription(part, vehicle);
      fixes++;
    }

    // Track missing required specifics
    const missing = [];
    if (!e.brand) missing.push('Brand');
    if (!e.mpn && !part.partNumber) missing.push('Manufacturer Part Number');
    if (missing.length > 0) {
      REPORT.missingSpecifics.push({ sku: part.sku, missing });
    }
  }

  log.info(`Validation: ${fixes} automatic fixes applied`);
}

function normalizeBrand(brand) {
  const map = {
    'mercedes': 'Mercedes-Benz', 'mercedes-benz': 'Mercedes-Benz', 'mer': 'Mercedes-Benz',
    'bmw': 'BMW', 'jaguar': 'Jaguar', 'jag': 'Jaguar',
    'volkswagen': 'Volkswagen', 'vw': 'Volkswagen',
    'audi': 'Audi', 'aud': 'Audi',
    'dodge': 'Dodge', 'ford': 'Ford',
    'land rover': 'Land Rover', 'landrover': 'Land Rover', 'range rover': 'Land Rover', 'rangerover': 'Land Rover',
    'bentley': 'Bentley', 'bent': 'Bentley',
  };
  const lower = (brand || '').toLowerCase().trim();
  return map[lower] || titleCase(brand);
}

// ═══════════════════════════════════════════════════════════════════════
//  PART NUMBER INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════

function deduplicatePartNumbers(parts) {
  log.step('Part Number Intelligence');
  const pnMap = new Map();
  let dupes = 0;

  for (const part of parts) {
    const norm = normalizePN(part.partNumber);
    if (!norm) continue;

    if (pnMap.has(norm)) {
      const existing = pnMap.get(norm);
      if (existing.vin !== part.vin) {
        // Same part from different vehicles — not a dupe, cross-reference
        part._crossRef = existing.partNumber;
      } else {
        dupes++;
      }
    } else {
      pnMap.set(norm, part);
    }
  }

  log.info(`Part numbers: ${pnMap.size} unique, ${dupes} duplicates within same VIN`);
}

// ═══════════════════════════════════════════════════════════════════════
//  TEMPLATE OUTPUT GENERATORS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Read a template file and extract its structure.
 */
function readTemplate(filePath) {
  const wb = XLSX.readFile(filePath, { cellStyles: true });
  return wb;
}

/**
 * Extract business policies from a template.
 */
function getBusinessPolicies(wb) {
  const ws = wb.Sheets['BusinessPolicy'];
  if (!ws) return { shipping: '', returns: '', payment: '' };
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  return {
    shipping: data[1]?.[0] || '',
    returns: data[1]?.[1] || '',
    payment: data[1]?.[2] || '',
  };
}

/**
 * Build fitment compatibility string for eBay.
 * Format: Year=YYYY|Make=XXX|Model=YYY
 */
function buildFitmentString(vehicle) {
  const parts = [];
  if (vehicle.year) parts.push(`Year=${vehicle.year}`);
  if (vehicle.make) parts.push(`Make=${vehicle.make}`);
  if (vehicle.model) parts.push(`Model=${vehicle.model}`);
  if (vehicle.trim) parts.push(`Trim=${vehicle.trim}`);
  if (vehicle.engine) parts.push(`Engine=${vehicle.engine}`);
  return parts.join('|');
}

// ────────── US Motors Template ──────────

function generateUSMotorsOutput(parts, vinData) {
  log.info('Generating US Motors (eBay Motors) template...');
  const templateWb = readTemplate(CONFIG.templates.us);
  const policies = getBusinessPolicies(templateWb);

  // Get the full header from Cat-ConnectingRodsParts (it has the most complete column set)
  const refSheet = templateWb.Sheets['Cat-ConnectingRodsParts'];
  const refData = XLSX.utils.sheet_to_json(refSheet, { header: 1 });
  const fullHeaders = refData[3]; // Row 3 has headers

  // Build output workbook preserving template structure
  const outWb = XLSX.utils.book_new();

  // Copy INFO rows + headers for Listings sheet
  const listingsData = [
    ['#INFO', `Created=${Date.now()}`, null, null, null, null, ' Indicates missing required fields'],
    ['#INFO', 'Version=1.0', null, 'Template=fx_multi_category_template_EBAY_MOTOR', null, null, ' Indicates missing recommended field'],
    ['#INFO'],
    fullHeaders,
  ];

  // Add data rows
  for (const part of parts) {
    if (!part._enriched) continue;
    const e = part._enriched;
    const vehicle = getVehicleInfo(part, vinData);

    // Main listing row
    const row = buildUSRow(fullHeaders, part, e, vehicle, policies);
    listingsData.push(row);

    // Compatibility/fitment row
    if (vehicle.year && vehicle.make && vehicle.model) {
      const fitRow = new Array(fullHeaders.length).fill(null);
      fitRow[0] = '';                           // Action (empty for compatibility)
      fitRow[5] = 'Compatibility';              // Relationship
      fitRow[6] = buildFitmentString(vehicle);  // Relationship details
      listingsData.push(fitRow);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(listingsData);
  XLSX.utils.book_append_sheet(outWb, ws, 'Listings');

  // Copy supporting sheets
  copySheet(templateWb, outWb, 'Categories');
  copySheet(templateWb, outWb, 'BusinessPolicy');
  copySheet(templateWb, outWb, 'Aspects');

  return outWb;
}

function buildUSRow(headers, part, enriched, vehicle, policies) {
  const row = new Array(headers.length).fill(null);
  const set = (colName, value) => {
    const idx = headers.indexOf(colName);
    if (idx >= 0 && value !== undefined && value !== null && value !== '') row[idx] = value;
  };

  set('*Action(SiteID=eBayMotors|Country=US|Currency=USD|Version=1193)', 'Add');
  set('Custom label (SKU)', part.sku || part.category);
  set('Category ID', part._category?.categoryId || '262124');
  set('Category Name', part._category?.categoryName || 'Car & Truck Parts & Accessories');
  set('Title', enriched.title);
  set('P:UPC', 'Does not apply');
  set('Start price', part.price);
  set('Quantity', CONFIG.defaultQuantity);
  set('Condition ID', CONFIG.defaultConditionId);
  set('Description', enriched.description);
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
  set('Shipping profile name', policies.shipping);
  set('Return profile name', policies.returns);
  set('Payment profile name', policies.payment);
  // Item Specifics
  set('C:Brand', enriched.brand);
  set('C:Type', enriched.type);
  set('C:Manufacturer Part Number', enriched.mpn || part.partNumber);
  set('C:OE/OEM Part Number', enriched.oemNumber || part.partNumber);
  set('C:Placement on Vehicle', enriched.placement);
  set('C:Fitment Type', enriched.fitmentType || 'Direct Replacement');
  set('C:Warranty', enriched.warranty || 'No Warranty');
  set('C:Material', enriched.material);
  set('C:Color', enriched.color);
  set('C:Surface Finish', enriched.surfaceFinish);
  set('C:Interchange Part Number', enriched.interchangeNumber);
  set('C:Bundle Description', enriched.bundleDescription);

  return row;
}

// ────────── AU Template ──────────

function generateAUOutput(parts, vinData) {
  log.info('Generating AU (Australia) template...');
  const templateWb = readTemplate(CONFIG.templates.au);
  const policies = getBusinessPolicies(templateWb);

  const refSheet = templateWb.Sheets['Listings'];
  const refData = XLSX.utils.sheet_to_json(refSheet, { header: 1 });
  const fullHeaders = refData[3];

  const outWb = XLSX.utils.book_new();
  const listingsData = [
    ['#INFO', `Created=${Date.now()}`, null, null, null, null, ' Indicates missing required fields'],
    ['#INFO', 'Version=1.0', null, 'Template=fx_category_template_EBAY_AU', null, null, ' Indicates missing recommended field'],
    ['#INFO'],
    fullHeaders,
  ];

  for (const part of parts) {
    if (!part._enriched) continue;
    const e = part._enriched;
    const vehicle = getVehicleInfo(part, vinData);

    const row = new Array(fullHeaders.length).fill(null);
    const set = (colName, value) => {
      const idx = fullHeaders.indexOf(colName);
      if (idx >= 0) row[idx] = value;
    };

    set('*Action(SiteID=Australia|Country=AU|Currency=AUD|Version=1193)', 'Add');
    set('Custom label (SKU)', part.sku || part.category);
    set('Category ID', part._category?.categoryId || '262124');
    set('Category name', part._category?.categoryName || 'Car & Truck Parts & Accessories');
    set('Title', e.title);
    set('P:UPC', 'Does not apply');
    set('Start price', Math.round(part.price * 1.55 * 100) / 100); // ~USD→AUD
    set('Quantity', CONFIG.defaultQuantity);
    set('Condition ID', CONFIG.defaultConditionId);
    set('Description', e.description);
    set('Format', CONFIG.defaultFormat);
    set('Duration', CONFIG.defaultDuration);
    set('Best Offer Enabled', 1);
    set('Immediate pay required', 1);
    set('Location', CONFIG.location);
    set('Max dispatch time', 5);
    set('Returns accepted option', 'ReturnsAccepted');
    set('Returns within option', 'Days_30');
    set('Refund option', 'MoneyBack');
    set('Return shipping cost paid by', 'Buyer');
    set('Shipping profile name', policies.shipping);
    set('Return profile name', policies.returns);
    set('Payment profile name', policies.payment);
    // Item Specifics (AU uses English names like US, but OE/OEM is different)
    set('C:Brand', e.brand);
    set('C:Type', e.type);
    set('C:Manufacturer Part Number', e.mpn || part.partNumber);
    set('C:Reference OE/OEM Number', e.oemNumber || part.partNumber);
    set('C:Placement on Vehicle', e.placement);
    set('C:Fitment Type', e.fitmentType || 'Direct Replacement');
    set('C:Warranty', e.warranty || 'No Warranty');
    set('C:Material', e.material);
    set('C:Color', e.color);
    set('C:Surface Finish', e.surfaceFinish);
    set('C:Interchange Part Number', e.interchangeNumber);

    listingsData.push(row);

    // Fitment row
    if (vehicle.year && vehicle.make && vehicle.model) {
      const fitRow = new Array(fullHeaders.length).fill(null);
      fitRow[5] = 'Compatibility';
      fitRow[6] = buildFitmentString(vehicle);
      listingsData.push(fitRow);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(listingsData);
  XLSX.utils.book_append_sheet(outWb, ws, 'Listings');
  copySheet(templateWb, outWb, 'Categories');
  copySheet(templateWb, outWb, 'BusinessPolicy');
  copySheet(templateWb, outWb, 'Aspects');

  return outWb;
}

// ────────── DE Template ──────────

function generateDEOutput(parts, vinData) {
  log.info('Generating DE (Germany) template...');
  const templateWb = readTemplate(CONFIG.templates.de);
  const policies = getBusinessPolicies(templateWb);

  const refSheet = templateWb.Sheets['Listings'];
  const refData = XLSX.utils.sheet_to_json(refSheet, { header: 1 });
  const fullHeaders = refData[3];

  const outWb = XLSX.utils.book_new();
  const listingsData = [
    ['#INFO', `Created=${Date.now()}`, null, null, null, null, ' Kennzeichnet fehlende Felder, die erforderlich sind'],
    ['#INFO', 'Version=1.0', null, 'Template=fx_category_template_EBAY_DE', null, null, ' Kennzeichnet ein fehlendes Feld, das empfohlen wird'],
    ['#INFO'],
    fullHeaders,
  ];

  for (const part of parts) {
    if (!part._enriched) continue;
    const e = part._enriched;
    const vehicle = getVehicleInfo(part, vinData);

    const row = new Array(fullHeaders.length).fill(null);
    const set = (colName, value) => {
      const idx = fullHeaders.indexOf(colName);
      if (idx >= 0) row[idx] = value;
    };

    set('*Action(SiteID=Germany|Country=DE|Currency=EUR|Version=1193)', 'Add');
    set('Custom label (SKU)', part.sku || part.category);
    set('Category ID', part._category?.categoryId || '262124');
    set('Category name', part._category?.categoryName || 'Car & Truck Parts & Accessories');
    set('Title', e.title);
    set('P:EAN', 'Nicht zutreffend');  // "Does not apply" in German
    set('Start price', Math.round(part.price * 0.92 * 100) / 100); // ~USD→EUR
    set('Quantity', CONFIG.defaultQuantity);
    set('Condition ID', CONFIG.defaultConditionId);
    set('Description', e.description);
    set('Format', CONFIG.defaultFormat);
    set('Duration', CONFIG.defaultDuration);
    set('Best Offer Enabled', 1);
    set('VAT%', 19); // German VAT
    set('Immediate pay required', 1);
    set('Location', CONFIG.location);
    set('Max dispatch time', 5);
    set('Returns accepted option', 'ReturnsAccepted');
    set('Returns within option', 'Days_30');
    set('Refund option', 'MoneyBack');
    set('Return shipping cost paid by', 'Buyer');
    set('Shipping profile name', policies.shipping);
    set('Return profile name', policies.returns);
    set('Payment profile name', policies.payment);
    // German aspect names
    set('C:Hersteller', e.brand);                                      // Brand
    set('C:Produktart', e.type);                                       // Type
    set('C:Herstellernummer', e.mpn || part.partNumber);               // MPN
    set('C:OE/OEM Referenznummer(n)', e.oemNumber || part.partNumber); // OE/OEM Number
    set('C:Einbauposition', e.placement);                              // Placement
    // VIN-decoded vehicle specifics for DE templates
    if (vehicle.engineCylinders || (vinData.get && vinData.get(part.vin)?.engineCylinders)) {
      const cylinders = vehicle.engineCylinders || vinData.get(part.vin)?.engineCylinders || '';
      if (cylinders) set('C:Zylinder', cylinders);                    // Cylinders
    }
    if (vehicle.fuelType || (vinData.get && vinData.get(part.vin)?.fuelType)) {
      const fuel = vehicle.fuelType || vinData.get(part.vin)?.fuelType || '';
      if (fuel) set('C:Kraftstoffart', fuel);                         // Fuel type
    }
    if (vehicle.engineDisplacement || (vinData.get && vinData.get(part.vin)?.engineDisplacement)) {
      const disp = vehicle.engineDisplacement || vinData.get(part.vin)?.engineDisplacement || '';
      if (disp) set('C:Hubraum', disp.includes('L') ? disp : `${disp} L`); // Engine displacement
    }
    set('C:Material', e.material);
    set('C:Farbe', e.color);                                          // Color in German

    listingsData.push(row);

    // Fitment row
    if (vehicle.year && vehicle.make && vehicle.model) {
      const fitRow = new Array(fullHeaders.length).fill(null);
      fitRow[5] = 'Compatibility';
      fitRow[6] = buildFitmentString(vehicle);
      listingsData.push(fitRow);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(listingsData);
  XLSX.utils.book_append_sheet(outWb, ws, 'Listings');
  copySheet(templateWb, outWb, 'Categories');
  copySheet(templateWb, outWb, 'BusinessPolicy');
  copySheet(templateWb, outWb, 'Aspects');

  return outWb;
}

/**
 * Copy a sheet from source workbook to destination workbook.
 */
function copySheet(srcWb, dstWb, sheetName) {
  if (srcWb.Sheets[sheetName]) {
    XLSX.utils.book_append_sheet(dstWb, srcWb.Sheets[sheetName], sheetName);
  }
}

/**
 * Read template Aspects sheet to get valid aspect values for a category.
 * Returns Map<categoryId, Map<aspectName, string[]>> for lookup.
 */
function readTemplateAspects(wb) {
  const ws = wb.Sheets['Aspects'];
  if (!ws) return new Map();

  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const aspectMap = new Map();

  // Aspects sheet: CategoryID | AspectName | Value1 | Value2 | ...
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;
    const catId = String(row[0]);
    const aspectName = String(row[1] || '');
    if (!aspectName) continue;

    if (!aspectMap.has(catId)) aspectMap.set(catId, new Map());
    const catAspects = aspectMap.get(catId);

    const values = row.slice(2).filter(v => v != null && String(v).trim() !== '').map(v => String(v).trim());
    catAspects.set(aspectName, values);
  }

  return aspectMap;
}

/**
 * Save pipeline checkpoint for resume capability.
 */
function saveCheckpoint(parts, step) {
  const checkpointPath = path.join(CONFIG.outputDir, '.pipeline-checkpoint.json');
  try {
    const checkpoint = {
      step,
      timestamp: new Date().toISOString(),
      totalParts: parts.length,
      processedCount: parts.filter(p => p._enriched).length,
      // Save minimal data for resume — just enriched flags and core IDs
      partStates: parts.map(p => ({
        vin: p.vin,
        sku: p.sku,
        partNumber: p.partNumber,
        hasEnriched: !!p._enriched,
        hasCategory: !!p._category,
      })),
    };
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint));
    log.info(`Checkpoint saved: step=${step}, ${checkpoint.processedCount}/${parts.length} enriched`);
  } catch (err) {
    log.warn(`Failed to save checkpoint: ${err.message}`);
  }
}

/**
 * Check if a checkpoint exists and return it.
 */
function loadCheckpoint() {
  const checkpointPath = path.join(CONFIG.outputDir, '.pipeline-checkpoint.json');
  if (!fs.existsSync(checkpointPath)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
    log.info(`Found checkpoint from ${data.timestamp}: step=${data.step}, ${data.processedCount}/${data.totalParts} enriched`);
    return data;
  } catch {
    return null;
  }
}

/**
 * Clear checkpoint after successful completion.
 */
function clearCheckpoint() {
  const checkpointPath = path.join(CONFIG.outputDir, '.pipeline-checkpoint.json');
  if (fs.existsSync(checkpointPath)) {
    fs.unlinkSync(checkpointPath);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  REPORT GENERATOR
// ═══════════════════════════════════════════════════════════════════════

function generateReport() {
  const elapsed = ((Date.now() - REPORT.startTime) / 1000).toFixed(1);

  const report = {
    summary: {
      totalInputParts: REPORT.totalInput,
      totalProcessed: REPORT.totalProcessed,
      totalFailedEnrichment: REPORT.totalFailed,
      totalSkipped: REPORT.totalSkipped,
      processingTimeSeconds: parseFloat(elapsed),
      templatesGenerated: ['US-Motors', 'AU-Category', 'DE-Category'],
    },
    vinDecoding: {
      success: REPORT.vinDecodeSuccess,
      failed: REPORT.vinDecodeFail,
      successRate: REPORT.vinDecodeSuccess > 0
        ? `${((REPORT.vinDecodeSuccess / (REPORT.vinDecodeSuccess + REPORT.vinDecodeFail)) * 100).toFixed(1)}%`
        : '0%',
    },
    categoryMapping: {
      apiMapped: REPORT.categoryMappingApi,
      fallbackMapped: REPORT.categoryMappingFallback,
      apiRate: REPORT.categoryMappingApi > 0
        ? `${((REPORT.categoryMappingApi / (REPORT.categoryMappingApi + REPORT.categoryMappingFallback)) * 100).toFixed(1)}%`
        : '0%',
    },
    openai: {
      totalCalls: REPORT.openaiCalls,
      totalTokens: REPORT.openaiTokensUsed,
      errors: REPORT.openaiErrors,
      estimatedCost: `$${(REPORT.openaiTokensUsed * 0.00000015).toFixed(4)}`, // gpt-4o-mini pricing
      enrichmentRate: REPORT.totalInput > 0
        ? `${((REPORT.totalProcessed / REPORT.totalInput) * 100).toFixed(1)}%`
        : '0%',
    },
    validationFixes: REPORT.validationFixes.slice(0, 100),
    missingRequiredSpecifics: REPORT.missingSpecifics.slice(0, 100),
    errors: REPORT.errors.slice(0, 50),
  };

  return report;
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  eBay Motors Enrichment Pipeline                             ║
║  VIN → Enriched Listings (US · AU · DE)                      ║
╚══════════════════════════════════════════════════════════════╝
  `);

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // ── Step 1: Parse Input ──
  const parts = parseInputFile(CONFIG.input);
  if (parts.length === 0) {
    log.error('No parts found in input file. Exiting.');
    process.exit(1);
  }

  // ── Step 2: VIN Decoding ──
  const vinData = await decodeAllVins(parts);
  saveCheckpoint(parts, 'vin-decode');

  // ── Step 3: Category Mapping ──
  await mapCategories(parts, vinData);
  saveCheckpoint(parts, 'category-mapping');

  // ── Step 4: Part Number Intelligence ──
  deduplicatePartNumbers(parts);

  // ── Step 5: OpenAI Enrichment ──
  await enrichAllParts(parts, vinData);
  saveCheckpoint(parts, 'enrichment');

  // ── Step 6: Compliance Validation ──
  validateAndFix(parts);

  // ── Step 7: Generate Template Outputs ──
  log.step('Generating Output Templates');

  const enrichedParts = parts.filter(p => p._enriched);
  log.info(`${enrichedParts.length} enriched parts ready for output`);

  // US Motors (eBay Motors)
  const usWb = generateUSMotorsOutput(enrichedParts, vinData);
  const usPath = path.join(CONFIG.outputDir, `US-Motors-Listings-${new Date().toISOString().slice(0,10)}.xlsx`);
  XLSX.writeFile(usWb, usPath);
  log.info(`  ✓ US Motors: ${usPath}`);

  // Australia
  const auWb = generateAUOutput(enrichedParts, vinData);
  const auPath = path.join(CONFIG.outputDir, `AU-Category-Listings-${new Date().toISOString().slice(0,10)}.xlsx`);
  XLSX.writeFile(auWb, auPath);
  log.info(`  ✓ AU: ${auPath}`);

  // Germany
  const deWb = generateDEOutput(enrichedParts, vinData);
  const dePath = path.join(CONFIG.outputDir, `DE-Category-Listings-${new Date().toISOString().slice(0,10)}.xlsx`);
  XLSX.writeFile(deWb, dePath);
  log.info(`  ✓ DE: ${dePath}`);

  // ── Step 8: Generate Report ──
  log.step('Pipeline Report');
  const report = generateReport();
  const reportPath = path.join(CONFIG.outputDir, `enrichment-report-${new Date().toISOString().slice(0,10)}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n' + JSON.stringify(report.summary, null, 2));
  console.log(`\nFull report: ${reportPath}`);
  console.log(`\n✓ Pipeline complete. ${enrichedParts.length} listings generated across 3 templates.`);

  // Clear checkpoint on success
  clearCheckpoint();
}

main().catch(err => {
  log.error(`Pipeline failed: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
