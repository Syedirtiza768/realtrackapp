#!/usr/bin/env node
/**
 * mercedes-c350-pipeline.mjs
 * Processes 2008 Mercedes C350 AMG parts Excel → eBay Motors CSV
 * with AI-enriched attributes, descriptions, and fitments
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ───── Configuration ─────
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
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

const backendEnv = loadEnv(path.resolve(ROOT, 'backend/.env'));
const rootEnv = loadEnv(path.resolve(ROOT, '.env'));
const env = { ...backendEnv, ...rootEnv };

const INPUT_FILE = String.raw`C:\Users\Irtiza Hassan\Downloads\2008 Mercedes C350 AMG.xlsx`;
const OUTPUT_FILE = path.resolve(ROOT, 'output', 'inventory-export-selected-96-2026-04-06.csv');
const OUTPUT_FILE_FINAL = String.raw`C:\Users\Irtiza Hassan\Downloads\inventory-export-selected-96-2026-04-06.csv`;

const MODEL = 'gpt-4o-mini';
const BATCH_SIZE = 25;
const CONCURRENCY = 5;
const MAX_RETRIES = 3;

// ───── Vehicle Info (from sheet name) ─────
const VEHICLE = {
  year: '2008',
  make: 'Mercedes-Benz',
  model: 'C350',
  platform: 'W204',
  engine: '3.5L V6 M272',
  vin: 'WDDGF56X68A018867', // from first row description
};

// W204 C-Class platform years and models
const W204_PLATFORM = {
  years: [2008, 2009, 2010, 2011, 2012, 2013, 2014],
  models: ['C250', 'C300', 'C350', 'C63 AMG'],
  make: 'Mercedes-Benz',
  chassis: 'W204',
};

// ───── Business Policies ─────
const POLICIES = {
  shipping: 'Salvage Speedpak shipping policy - 5 to 6 KG Updated',
  return: 'Salvage Auto Parts Return Policy',
  payment: 'Salvage Auto Parts payment Policy',
};

// ───── Helper Functions ─────
function clean(v) { return v == null ? '' : String(v).trim(); }
function titleCase(s) {
  return clean(s).replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function extractPlacementFromDesc(desc) {
  const d = (desc || '').toLowerCase();
  const parts = [];
  if (d.includes('front')) parts.push('Front');
  if (d.includes('rear') || d.includes('back')) parts.push('Rear');
  if (d.includes('left') || d.includes('driver')) parts.push('Left');
  if (d.includes('right') || d.includes('passenger')) parts.push('Right');
  if (d.includes('upper') || d.includes('top')) parts.push('Upper');
  if (d.includes('lower') || d.includes('bottom')) parts.push('Lower');
  if (d.includes('centre') || d.includes('center')) parts.push('Center');
  return parts.join(', ');
}

function normalizePN(pn) {
  return clean(pn).replace(/[\s\-\.]/g, '').toUpperCase();
}

// CSV escaping
function csvEscape(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvRow(fields) {
  return fields.map(csvEscape).join(',');
}

// ───── HTML Description Builder ─────
function buildDescription(title, descText, fitments, partNumber, partType, placement) {
  const fitmentTableRows = fitments.map(f =>
    `<tr><td>${f.make}</td><td>${f.model}</td><td>${f.year}</td></tr>`
  ).join('');

  return `<style>.tab-wrap {font-family: Arial, sans-serif;font-size: 14px;color: #333;max-width: 800px;margin: auto;}.tab-title {background-color: #222;color: #fff;padding: 12px;font-size: 18px;font-weight: bold;text-align: center;}.product-description {padding: 15px;border: 1px solid #ddd;background-color: #f9f9f9;margin-bottom: 10px;}.fitment tbody tr:nth-child(even) {background-color: #f9f9f9;}.fitment tbody tr:nth-child(odd) {background-color: #fff;}.fitment tbody td {padding: 8px;border: 1px solid #ddd;}input[type="radio"] {display: none;}.tab-labels {display: flex;flex-wrap: wrap;background-color: #333;}.tab-labels label {flex: 1;text-align: center;padding: 10px;font-weight: bold;cursor: pointer;background-color: #333;color: white;border-right: 1px solid #444;transition: background 0.3s;}.tab-labels label:hover {background-color: #444;}.tab-content {display: none;padding: 15px;border: 1px solid #ddd;background-color: #f9f9f9;}#tab1:checked ~ .tabs #content1,#tab2:checked ~ .tabs #content2,#tab3:checked ~ .tabs #content3,#tab4:checked ~ .tabs #content4,#tab5:checked ~ .tabs #content5 {display: block;}#tab1:checked ~ .tab-labels label[for="tab1"],#tab2:checked ~ .tab-labels label[for="tab2"],#tab3:checked ~ .tab-labels label[for="tab3"],#tab4:checked ~ .tab-labels label[for="tab4"],#tab5:checked ~ .tab-labels label[for="tab5"] {background-color: #fff;color: #000;border-bottom: none;}</style><div class="tab-wrap"><div class="tab-title">Product Information</div><div class="product-description">${descText}</div>${fitmentTableRows ? `<div class="fitment-section" style="margin-top: 15px;"><h3 style="font-size: 16px;font-weight: bold;margin-bottom: 10px;color: #333;">Vehicle Compatibility</h3><table class="fitment" style="width: 100%;border-collapse: collapse;margin-bottom: 10px;"><thead><tr style="background-color: #333;color: white;"><th style="padding: 8px;text-align: left;border: 1px solid #ddd;">Make</th><th style="padding: 8px;text-align: left;border: 1px solid #ddd;">Model</th><th style="padding: 8px;text-align: left;border: 1px solid #ddd;">Year</th></tr></thead><tbody>${fitmentTableRows}</tbody></table></div>` : ''}<input type="radio" name="tab" id="tab1" checked><input type="radio" name="tab" id="tab2"><input type="radio" name="tab" id="tab3"><input type="radio" name="tab" id="tab4"><input type="radio" name="tab" id="tab5"><div class="tab-labels"><label for="tab1">Payment Policy</label><label for="tab2">Shipping Policy</label><label for="tab3">Returns Policy</label><label for="tab4">Handling Time</label><label for="tab5">International Buyers</label></div><div class="tabs"><div id="content1" class="tab-content">- We accept only online payment methods provided by eBay at checkout.</div><div id="content2" class="tab-content">- We provide worldwide shipping to most countries using reputed couriers like DHL, FedEx or Aramex.</div><div id="content3" class="tab-content">- We accept 14-day returns. Please clarify all doubts before purchasing.</div><div id="content4" class="tab-content">- All packages are shipped within 3 working days.</div><div id="content5" class="tab-content">- Import Duties, Taxes and charges are not included in the item price or shipping cost. These charges are Buyer's responsibility. Please check with your country's customs office before buying.</div></div></div>`;
}

// ───── Parse Input ─────
function parseInput() {
  console.log('📖 Parsing input file...');
  const wb = XLSX.readFile(INPUT_FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Row 0 = info, Row 1 = headers, Row 2+ = data
  const headers = raw[1].map(h => clean(h).toLowerCase());
  const colMap = {};
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (h === 'part number') colMap.partNumber = i;
    if (h === 'price') colMap.price = i;
    if (h === 'quantity') colMap.quantity = i;
    if (h === 'vehicle make') colMap.make = i;
    if (h === 'description') colMap.description = i;
    if (h === 'image urls') colMap.images = i;
    if (h === 'sku') colMap.sku = i;
    if (h === 'weight major') colMap.weightMajor = i;
    if (h === 'weight minor') colMap.weightMinor = i;
    if (h === 'package length') colMap.pkgLength = i;
    if (h === 'package width') colMap.pkgWidth = i;
    if (h === 'package depth') colMap.pkgDepth = i;
  }

  const parts = [];
  for (let i = 2; i < raw.length; i++) {
    const row = raw[i];
    if (!row || !row.some(c => c != null && c !== '')) continue;

    const partNumber = clean(row[colMap.partNumber]);
    const description = clean(row[colMap.description]);
    const sku = clean(row[colMap.sku]);

    if (!partNumber && !description) continue;

    parts.push({
      rowIndex: i,
      partNumber,
      price: parseFloat(row[colMap.price]) || 0,
      quantity: parseInt(row[colMap.quantity]) || 1,
      make: clean(row[colMap.make]),
      description,
      images: clean(row[colMap.images]),
      sku,
      weightMajor: clean(row[colMap.weightMajor]),
      weightMinor: clean(row[colMap.weightMinor]),
      pkgLength: clean(row[colMap.pkgLength]),
      pkgWidth: clean(row[colMap.pkgWidth]),
      pkgDepth: clean(row[colMap.pkgDepth]),
      placement: extractPlacementFromDesc(description),
    });
  }

  console.log(`  ✓ Parsed ${parts.length} parts from sheet "${wb.SheetNames[0]}"`);
  return parts;
}

// ───── Gap Analysis ─────
function analyzeGaps(parts) {
  console.log('\n📊 GAP ANALYSIS');
  console.log('═══════════════════════════════════════════════════');

  const gaps = {
    missingCategory: 0,
    missingTitle: 0,         // All need optimized titles
    missingDescription: 0,   // All need HTML descriptions
    missingType: 0,
    missingPlacement: 0,
    missingMaterial: 0,
    missingFeatures: 0,
    missingCountryOfMfg: 0,
    missingOEMNumbers: 0,
    missingFitment: 0,       // All need fitment rows
    noPlacementInDesc: 0,
  };

  for (const p of parts) {
    gaps.missingCategory++;     // No eBay category IDs
    gaps.missingTitle++;        // Need SEO-optimized titles
    gaps.missingDescription++;  // Need HTML descriptions
    gaps.missingType++;         // Need part type classification
    gaps.missingMaterial++;     // Need material info
    gaps.missingFeatures++;     // Need features
    gaps.missingCountryOfMfg++; // Need country of manufacture
    gaps.missingOEMNumbers++;   // Need cross-ref OEM numbers
    gaps.missingFitment++;      // Need compatibility rows

    if (!p.placement) gaps.noPlacementInDesc++;
  }

  console.log(`  Total parts: ${parts.length}`);
  console.log(`  ❌ Missing eBay Category ID:        ${gaps.missingCategory}/${parts.length}`);
  console.log(`  ❌ Need SEO-optimized Title:         ${gaps.missingTitle}/${parts.length}`);
  console.log(`  ❌ Need HTML Description:            ${gaps.missingDescription}/${parts.length}`);
  console.log(`  ❌ Missing Part Type (C:Type):       ${gaps.missingType}/${parts.length}`);
  console.log(`  ⚠️  Missing Placement:               ${gaps.noPlacementInDesc}/${parts.length} (${parts.length - gaps.noPlacementInDesc} extracted from description)`);
  console.log(`  ❌ Missing Material:                 ${gaps.missingMaterial}/${parts.length}`);
  console.log(`  ❌ Missing Features:                 ${gaps.missingFeatures}/${parts.length}`);
  console.log(`  ❌ Missing Country of Manufacture:   ${gaps.missingCountryOfMfg}/${parts.length}`);
  console.log(`  ❌ Missing OE/OEM Part Numbers:      ${gaps.missingOEMNumbers}/${parts.length}`);
  console.log(`  ❌ Missing Fitment Compatibility:    ${gaps.missingFitment}/${parts.length}`);
  console.log(`  ✅ Have Part Number:                 ${parts.filter(p => p.partNumber).length}/${parts.length}`);
  console.log(`  ✅ Have Price:                       ${parts.filter(p => p.price > 0).length}/${parts.length}`);
  console.log(`  ✅ Have Images:                      ${parts.filter(p => p.images).length}/${parts.length}`);
  console.log(`  ✅ Have SKU:                         ${parts.filter(p => p.sku).length}/${parts.length}`);
  console.log('═══════════════════════════════════════════════════\n');
  return gaps;
}

// ───── OpenAI Enrichment ─────
const SYSTEM_PROMPT = `You are a Senior Automotive Parts Interchange Specialist with 20+ years of Mercedes-Benz EPC (Electronic Parts Catalog) expertise. You specialize in W204 C-Class (2008-2014) parts listing on eBay Motors.

TASK: For each part from a 2008 Mercedes-Benz C350 W204 (VIN: WDDGF56X68A018867, 3.5L V6 M272), provide:

1. eBay Category ID (numeric, from eBay Motors categories)
2. SEO-optimized title (max 80 chars)
3. Part type classification
4. Material (if determinable)
5. Features (comma-separated)
6. Country of manufacture
7. OE/OEM cross-reference part numbers (alternate formats, superseded numbers)
8. Product description text (2-3 sentences, professional)
9. Full vehicle compatibility list (all W204 models/years that use this exact part)

RULES:
- Title format: [Year Range] Mercedes-Benz [Model] [W204] [Part Name] [Part Number] [OEM]
- Max 80 characters for title
- Part number: Use the provided Mercedes-Benz OEM part number (A XXX XXX XX XX format)
- OEM Numbers: Provide comma-separated alternate formats (without "A" prefix, with dashes, etc.)
- Compatibility: The W204 C-Class platform (2008-2014) shares many parts across C250, C300, C350, C63 AMG
- NOT all parts fit all W204 variants - some are model/side/trim specific  
- Category IDs should be real eBay Motors category numbers
- Country of Manufacture: Germany for most Mercedes parts
- For Left/Right specific parts, only include that side in compatibility
- Material: Only state if determinable (e.g., "Plastic" for trim, "Steel" for hinges, "Glass" for windows)

Common eBay Category IDs for Mercedes parts:
- 262124: Car & Truck Parts & Accessories (generic)  
- 33646: Hoods (Body)
- 33650: Fenders
- 33712: Bumpers & Parts
- 174062: Door Panels & Hardware
- 262156: Latches & Locks
- 179847: Wiring & Wiring Harnesses
- 33710: Exterior Mirrors
- 174109: Interior Door Panels
- 33723: Seat Covers, Cushions & Parts
- 262134: Seat Belts & Parts
- 262095: Window Motors, Parts & Accessories
- 262165: Window Regulators
- 33706: Side Marker Lights
- 262125: Trunk Lid & Parts
- 174094: Grilles
- 262199: Headlights
- 262222: Control Arms & Parts
- 33721: Steering Wheels & Horns
- 262183: Trim
- 174064: Door Shells
- 262153: Hinges
- 174110: Interior Trim
- 33718: Engines & Components
- 174063: Interior Switches & Controls
- 33711: Exterior Door Handles
- 33709: Interior Door Handles  
- 262154: Door Lock Actuators
- 33697: Front Bumper & Parts
- 33698: Rear Bumper & Parts
- 262130: Seat Adjustment Motors
- 174128: Speakers & Speaker Systems
- 33699: Emblems, Ornaments & Badges
- 33701: License Plate Frames & Brackets

Return JSON array:
[{
  "index": N,
  "categoryId": "NNNNNN",
  "title": "...",
  "type": "...",
  "placement": "...",
  "material": "...",
  "features": "...",
  "countryOfManufacture": "Germany",
  "oemNumbers": "...",
  "descriptionText": "...",
  "compatibility": [
    {"year": "2008", "make": "Mercedes-Benz", "model": "C300"},
    {"year": "2008", "make": "Mercedes-Benz", "model": "C350"}
  ]
}]`;

async function callOpenAI(messages, maxTokens = 8000) {
  const body = JSON.stringify({
    model: MODEL,
    messages,
    temperature: 0.2,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  });
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body,
    signal: AbortSignal.timeout(90000), // Hard 90s timeout
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`${resp.status} ${errText.slice(0, 200)}`);
  }
  return await resp.json();
}

async function enrichBatch(batchParts) {
  const partsForPrompt = batchParts.map((part, idx) => ({
    index: idx,
    partNumber: part.partNumber,
    description: part.description,
    price: part.price,
    sku: part.sku,
    extractedPlacement: part.placement,
  }));

  const userPrompt = `Analyze these ${batchParts.length} parts from a 2008 Mercedes-Benz C350 W204 (VIN: WDDGF56X68A018867). Generate full eBay listing data for each:

${JSON.stringify(partsForPrompt)}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await sleep(100); // Rate limiting
      const data = await callOpenAI([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ]);

      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response');

      const parsed = JSON.parse(content);
      const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.results || parsed.parts || [parsed]);
      return items;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`  ⚠ Batch failed (attempt ${attempt}/${MAX_RETRIES}): ${err.message}. Retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        console.error(`  ❌ Batch failed after ${MAX_RETRIES} attempts: ${err.message}`);
        return null;
      }
    }
  }
  return null;
}

async function enrichAllParts(parts) {
  console.log('🤖 AI Enrichment (OpenAI)...');

  // Validate key
  try {
    const test = await callOpenAI([{ role: 'user', content: 'Reply with just the word OK in JSON: {"status":"OK"}' }], 10);
    console.log('  ✓ OpenAI API key validated');
  } catch (err) {
    console.error(`  ❌ OpenAI API key invalid: ${err.message}`);
    throw err;
  }

  const batches = chunk(parts, BATCH_SIZE);
  console.log(`  Processing ${parts.length} parts in ${batches.length} batches of ${BATCH_SIZE}...`);

  let enrichedCount = 0;
  let failedCount = 0;
  let totalTokens = 0;

  for (let groupStart = 0; groupStart < batches.length; groupStart += CONCURRENCY) {
    const group = batches.slice(groupStart, groupStart + CONCURRENCY);
    console.log(`  Batches ${groupStart + 1}-${Math.min(groupStart + CONCURRENCY, batches.length)}/${batches.length}...`);

    const results = await Promise.allSettled(
      group.map(batch => enrichBatch(batch))
    );

    for (let i = 0; i < results.length; i++) {
      const batch = group[i];
      const result = results[i];
      const enrichedItems = result.status === 'fulfilled' ? result.value : null;

      if (enrichedItems) {
        for (const enriched of enrichedItems) {
          const idx = enriched.index ?? enrichedItems.indexOf(enriched);
          if (idx >= 0 && idx < batch.length) {
            batch[idx]._enriched = {
              categoryId: clean(enriched.categoryId) || '262124',
              title: clean(enriched.title).slice(0, 80),
              type: clean(enriched.type),
              placement: clean(enriched.placement) || batch[idx].placement,
              material: clean(enriched.material),
              features: clean(enriched.features),
              countryOfManufacture: clean(enriched.countryOfManufacture) || 'Germany',
              oemNumbers: clean(enriched.oemNumbers),
              descriptionText: clean(enriched.descriptionText),
              compatibility: Array.isArray(enriched.compatibility) ? enriched.compatibility : [],
            };
            enrichedCount++;
          }
        }
      }

      // Fallback for parts that weren't enriched
      for (const part of batch) {
        if (!part._enriched) {
          part._enriched = {
            categoryId: '262124',
            title: `2008 Mercedes-Benz C350 W204 ${part.description.replace(/^2008 MERCEDES C-350\s*/i, '').replace(/Used OEM$/i, '').trim()}`.slice(0, 80),
            type: part.description.replace(/^2008 MERCEDES C-350\s*/i, '').replace(/Used OEM$/i, '').trim(),
            placement: part.placement,
            material: '',
            features: '',
            countryOfManufacture: 'Germany',
            oemNumbers: part.partNumber.replace(/^A\s*/, '').replace(/\s+/g, ''),
            descriptionText: `Genuine OEM ${part.description.replace(/Used OEM$/i, '').trim()} removed from a 2008 Mercedes-Benz C350 W204. Part has been inspected and verified. Please verify part number compatibility before purchasing.`,
            compatibility: W204_PLATFORM.years.map(y => ({ year: String(y), make: 'Mercedes-Benz', model: 'C350' })),
          };
          failedCount++;
        }
      }
    }

    // Rate limiting between groups
    if (groupStart + CONCURRENCY < batches.length) {
      await sleep(50);
    }
  }

  console.log(`  ✓ Enriched: ${enrichedCount}, Fallback: ${failedCount}`);
  return { enrichedCount, failedCount };
}

// ───── Generate CSV Output ─────
function generateCSV(parts) {
  console.log('\n📄 Generating CSV output...');

  const HEADERS = [
    '*Action(SiteID=eBayMotors|Country=AE|Currency=USD|Version=1193|CC=UTF-8)',
    'CustomLabel',
    '*Category',
    '*Title',
    'Relationship',
    'RelationshipDetails',
    '*StartPrice',
    '*Quantity',
    'PicURL',
    'AdditionalPicURL',
    'AdditionalPicURL1',
    'AdditionalPicURL2',
    'AdditionalPicURL3',
    'AdditionalPicURL4',
    'AdditionalPicURL5',
    'AdditionalPicURL6',
    'AdditionalPicURL7',
    '*ConditionID',
    '*Description',
    '*Format',
    '*Duration',
    '*Location',
    '*C:Brand',
    'C:Type',
    'C:Placement on Vehicle',
    'C:Material',
    'C:Features',
    'C:Country/Region of Manufacture',
    'C:Manufacturer Part Number',
    'C:OE/OEM Part Number',
    'ShippingProfileName',
    'ReturnProfileName',
    'PaymentProfileName',
  ];

  const rows = [];

  // Row 1: Info/metadata
  rows.push('Info,Version=1.0.0,Template=fx_category_template_EBAY_MOTOR' + ','.repeat(HEADERS.length - 3));

  // Row 2: Headers
  rows.push(csvRow(HEADERS));

  let itemCount = 0;
  let fitmentCount = 0;

  for (const part of parts) {
    const e = part._enriched;
    if (!e) continue;

    // Build fitment list for this part
    const fitments = e.compatibility || [];

    // Build HTML description
    const htmlDesc = buildDescription(
      e.title,
      e.descriptionText,
      fitments,
      part.partNumber,
      e.type,
      e.placement
    );

    // Format the Mercedes part number with A prefix
    const mpn = part.partNumber;
    // Normalize the display format
    const mpnDisplay = mpn.startsWith('A') ? mpn : (mpn.startsWith('Q') ? mpn : `A${mpn}`);

    // Item row
    const itemRow = [
      'Add',                           // Action
      part.sku,                         // CustomLabel
      e.categoryId,                     // Category
      e.title,                          // Title
      '',                               // Relationship
      '',                               // RelationshipDetails
      part.price,                       // StartPrice
      part.quantity,                    // Quantity
      // Images: split pipe-separated URLs into separate eBay AdditionalPicURL columns
      ...(() => {
        const imgs = (part.images || '').split('|').map(u => u.trim()).filter(Boolean).slice(0, 9);
        const imgCols = new Array(9).fill('');
        imgs.forEach((url, i) => { imgCols[i] = url; });
        return imgCols; // PicURL + AdditionalPicURL through AdditionalPicURL7
      })(),
      '3000-Used',                      // ConditionID
      htmlDesc,                         // Description
      'FixedPrice',                     // Format
      'GTC',                            // Duration
      'Dubai',                          // Location
      'MERCEDES-BENZ',                  // Brand
      e.type,                           // Type
      e.placement,                      // Placement on Vehicle
      e.material,                       // Material
      e.features,                       // Features
      e.countryOfManufacture,           // Country/Region of Manufacture
      mpn,                              // Manufacturer Part Number
      e.oemNumbers,                     // OE/OEM Part Number
      POLICIES.shipping,               // ShippingProfileName
      POLICIES.return,                  // ReturnProfileName
      POLICIES.payment,                // PaymentProfileName
    ];

    rows.push(csvRow(itemRow));
    itemCount++;

    // Fitment compatibility rows
    for (const fit of fitments) {
      if (!fit.year || !fit.make || !fit.model) continue;
      const fitRow = new Array(HEADERS.length).fill('');
      fitRow[4] = 'Compatibility';  // Relationship
      fitRow[5] = `Make=${fit.make}|Model=${fit.model}|Year=${fit.year}`; // RelationshipDetails
      rows.push(csvRow(fitRow));
      fitmentCount++;
    }
  }

  // Write CSV — write to workspace output/, then try to copy to Downloads
  const csvContent = rows.join('\n');
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, csvContent, 'utf8');
  console.log(`  ✓ Written to workspace: ${OUTPUT_FILE}`);

  // Try to copy to Downloads
  try {
    fs.writeFileSync(OUTPUT_FILE_FINAL, csvContent, 'utf8');
    console.log(`  ✓ Copied to: ${OUTPUT_FILE_FINAL}`);
  } catch (err) {
    console.log(`  ⚠ Cannot copy to Downloads (${err.code}). File available at workspace output/`);
  }

  console.log(`  ✓ Written ${itemCount} item rows + ${fitmentCount} fitment rows`);
  console.log(`  ✓ Total CSV rows: ${rows.length} (incl. header & metadata)`);

  return { itemCount, fitmentCount };
}

// ───── MAIN ─────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Mercedes C350 W204 → eBay Motors CSV Pipeline              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Step 1: Parse input
  const parts = parseInput();
  if (parts.length === 0) {
    console.error('No parts found!');
    process.exit(1);
  }

  // Step 2: Gap analysis
  const gaps = analyzeGaps(parts);

  // Step 3: AI Enrichment
  const enrichResult = await enrichAllParts(parts);

  // Step 4: Post-enrichment validation
  console.log('\n✅ POST-ENRICHMENT SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  let totalFitments = 0;
  const categoryDist = {};
  for (const p of parts) {
    if (p._enriched) {
      const cat = p._enriched.categoryId;
      categoryDist[cat] = (categoryDist[cat] || 0) + 1;
      totalFitments += (p._enriched.compatibility || []).length;
    }
  }
  console.log(`  Parts enriched: ${parts.filter(p => p._enriched).length}/${parts.length}`);
  console.log(`  Total fitment entries: ${totalFitments}`);
  console.log(`  Category distribution:`);
  Object.entries(categoryDist)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => console.log(`    ${cat}: ${count} parts`));

  // Step 5: Generate CSV
  const csvResult = generateCSV(parts);

  console.log('\n🎉 Pipeline complete!');
  console.log(`  ${csvResult.itemCount} listings + ${csvResult.fitmentCount} fitment rows → ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Pipeline failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
