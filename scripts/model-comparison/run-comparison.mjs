/**
 * eBay Motors AI model comparison harness.
 *
 * Reuses the EXACT production enrichment prompt from
 * scripts/ebay-enrichment-pipeline.mjs and runs a fixed, representative
 * sample of real parts from "2008 Mercedes C350 AMG.xlsx" through multiple
 * OpenRouter models. Captures latency, token usage, live cost, schema
 * reliability, and structured quality/fitment metrics.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'docs', 'model-comparison');
const RAW_DIR = path.join(OUT_DIR, 'raw');
fs.mkdirSync(RAW_DIR, { recursive: true });

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
const env = { ...loadEnv(path.join(ROOT, 'backend/.env')), ...loadEnv(path.join(ROOT, '.env')) };
const KEY = env.OPENAI_API_KEY;
const BASE = env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';

const pricing = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog-pricing.json'), 'utf8'));
const priceById = new Map(pricing.map((p) => [p.id, p]));

// ── Models under test (validated slugs, spanning price/quality tiers) ──
const ALL_MODELS = [
  'minimax/minimax-m3',                       // production default
  'openai/gpt-4o-mini',
  'openai/gpt-4.1-mini',
  'google/gemini-2.5-flash',
  'anthropic/claude-3.5-haiku',
  'deepseek/deepseek-chat-v3-0324',
  'meta-llama/llama-3.3-70b-instruct',
  'amazon/nova-lite-v1',
];
// Optional CLI filter: `node run-comparison.mjs only=google/gemini-2.5-flash,minimax/minimax-m3`
const onlyArg = process.argv.find((a) => a.startsWith('only='));
const MODELS = onlyArg ? onlyArg.slice(5).split(',') : ALL_MODELS;
const MAX_TOKENS = Number(process.env.MC_MAX_TOKENS || 16000);

// ── Donor vehicle (from input master row / sheet name) ──
const VEHICLE = {
  year: '2008',
  make: 'Mercedes-Benz',
  model: 'C-350',
  trim: 'AMG / Sport',
  engine: '3.5L V6 (M272)',
  bodyClass: 'Sedan',
  driveType: 'RWD',
  fuelType: 'Gasoline',
  chassis: 'W204',
  vin: 'WDDGF56X68A018867',
};

// ── Representative sample: 8 diverse real parts from the input file ──
const SAMPLE = [
  { sku: 'MRC-C350-8867-EN', partNumber: '272.970', note: 'This is C-350 2008 MODEL VIN WDDGF56X68A018867 - complete working engine tested. M272 3.5L V6.', price: 2499.99 },
  { sku: 'MRC-C350-8867-DR-W', partNumber: 'A 204 720 06 79', note: '2008 MERCEDES C-350 Front Right Side Door Window Regulator Used OEM', price: 64.99 },
  { sku: 'MRC-C350-8867-GL1', partNumber: 'A 204 725 01 10', note: '2008 MERCEDES C-350 Front Left door window glass Used OEM', price: 59.99 },
  { sku: 'MRC-C350-8867-DP1', partNumber: 'A 204 720 95 62 8N28', note: '2008 MERCEDES C-350 Front Right door panel Used OEM', price: 179.99 },
  { sku: 'MRC-C350-8867-SP1', partNumber: 'A 204 720 02 48 9051', note: '2008 MERCEDES C-350 Front Right Side Door Panel Tweeter Speaker Used OEM', price: 49.99 },
  { sku: 'MRC-C350-8867-HG1', partNumber: 'A 204 730 02 37', note: '2008 MERCEDES C-350 REAR RIGHT DOOR UPPER HINGE Used OEM', price: 49.99 },
  { sku: 'MRC-C350-8867-AC1', partNumber: 'A 204 730 08 35', note: '2008 MERCEDES C-350 Rear Left Door Lock Latch Actuator Used OEM', price: 54.99 },
  { sku: 'MRC-C350-8867-SH1', partNumber: 'A 204 730 21 00', note: '2008 MERCEDES C-350 Rear Left Driver Side Door Shell maroon Used OEM', price: 434.99 },
];

function buildPayload() {
  return SAMPLE.map((p, idx) => ({
    index: idx,
    sku: p.sku,
    brand: VEHICLE.make,
    vehicle: `${VEHICLE.year} ${VEHICLE.make} ${VEHICLE.model}`,
    vehicleTrim: VEHICLE.trim,
    vehicleEngine: VEHICLE.engine,
    vehicleBodyClass: VEHICLE.bodyClass,
    vehicleDriveType: VEHICLE.driveType,
    vehicleFuelType: VEHICLE.fuelType,
    partName: p.note,
    partNumber: p.partNumber,
    note: p.note,
    price: p.price,
  }));
}

// ── EXACT production system prompt (verbatim from ebay-enrichment-pipeline.mjs) ──
const SYSTEM_PROMPT = `Role: You are a Senior Automotive Parts Interchange Specialist with 20+ years of experience in OEM parts databases (EPCs), cross-reference systems, and eBay Motors listing optimization. You have deep expertise across ALL makes — European, Japanese, American, Korean, and specialty manufacturers.

TASK: Analyze each provided automotive part and generate:
1. An optimized eBay Motors listing (title, description, specifics)
2. Comprehensive vehicle compatibility / interchange data
3. Technical installation requirements and notes

═══ INTERCHANGE & COMPATIBILITY RULES ═══

** CRITICAL — AVOID DONOR-ONLY DATA **
The vehicle each part was removed from is the "donor vehicle". You MUST NOT limit compatibility to ONLY the donor.
- Use the Part Number (MPN) to research the FULL OEM application range
- Expand fitment to ALL vehicles that use this exact part number across all shared platforms
- If the donor is a 2018 Mercedes C300, but the same part fits 2015-2023 C-Class, E-Class, and GLC — list ALL of them
- Cross-reference luxury/standard brand siblings (e.g., Camry↔ES, 3-Series↔Supra, Tucson↔Sportage)
- The goal is MAXIMUM legitimate fitment coverage for eBay Motors Master Vehicle List (MVL)

For EACH part, you MUST:

A) OEM Interchange Research:
   - Identify every Make, Model, and Year range that used this exact part from the factory
   - Use the provided MPN/Part Number to determine the full OEM application range
   - Parts often span multiple model years within a generation/platform

B) Cross-Platform Compatibility:
   - Identify shared platforms where the part may fit with different branding:
     • VW Group: VW / Audi / Porsche / Bentley / Lamborghini (MQB, MLB, PQ35)
     • Toyota / Lexus (TNGA), Honda / Acura, Nissan / Infiniti
     • GM: Chevrolet / GMC / Cadillac / Buick (shared truck/SUV platforms)
     • Ford / Lincoln, Stellantis: Dodge / Jeep / Ram / Chrysler
     • Jaguar / Land Rover (PLA, iQ, D7a), Hyundai / Kia / Genesis
     • Subaru / Toyota (shared BRZ/86 platform)
   - Only include cross-platform fits when the SAME part number is used

C) Chassis/Body Codes:
   - ALWAYS include the chassis or body code in the compatibility data:
     • BMW: E46, F30, G20, etc.  • Mercedes: W204, W205, W206, etc.
     • Audi: B8, C7, 8V, etc.  • Toyota: XV70, XA50, E210, etc.
     • Honda: FC/FK, CV, etc.  • Porsche: 996, 997, 991, 992, etc.
   - Include these codes in the title when space allows

D) Technical Requirements — flag if the part requires:
   - Coding/Programming (VIN-unlocking, dealer-only activation, ECU coding)
   - Specific Trims only (e.g., "Only for models with Bose Audio", "Sport package only")
   - Engine-specific (e.g., "2.0T only", "Non-Turbo models only", "V6 only")
   - Positioning (e.g., "Front Left / Driver Side only", "Passenger side")
   - Drive type restrictions (e.g., "AWD only", "RWD only", "4WD only")

═══ LISTING RULES ═══

TITLE (max 80 chars):
- Format: [Year Range] [Make] [Model] [Chassis] [PartName] [MPN] [OEM/Genuine]
- Lead with highest-value search terms (year+make+model+chassis)
- Include condition: "OEM", "Genuine", or "Used OEM"
- Include placement (Left/Right/Front/Rear) when relevant
- End with MPN or OEM number if space permits
- Never use ALL CAPS, special chars (!@#$%), or filler words
- Examples:
  "2015-2021 Mercedes C-Class W205 Front Left Door Lock Actuator A2057200135 OEM"
  "2018-2023 Toyota Camry XV70 Brake Caliper Front Right 47730-06330 OEM"
  "2014-2020 BMW 3 Series F30 Headlight Control Module 63117316217 Genuine"

DESCRIPTION:
- Professional HTML with structured sections
- Include: Part identification, Full vehicle fitment list, Condition, Technical notes
- Always include: "Please verify part number compatibility before purchasing"
- Format: <h3>Title</h3><p>intro</p><h4>Details</h4><ul><li>...</li></ul><h4>Compatibility</h4><p>Full vehicle list with chassis codes</p><h4>Technical Notes</h4><p>Any coding/programming/trim requirements</p><h4>Condition</h4><p>Used - Removed from running vehicle. Inspected and tested.</p>

SPECIFICS:
- brand: OEM manufacturer name (e.g., "Mercedes-Benz" not "Mercedes", "BMW" not "Bmw")
- type: Specific part type (e.g., "Door Lock Actuator" not "Door Parts")
- mpn: ONLY use the provided partNumber — NEVER fabricate
- oemNumber: Same as mpn unless explicitly different
- placement: Extract from notes/name (e.g., "Front Left", "Rear Right", "Upper", "Lower")
- material: Only if determinable from part type
- warranty: "No Warranty" for used parts
- fitmentType: "Direct Replacement" for OEM parts
- color: Only if determinable from notes (never guess)
- interchangeNumber: Only if known from cross-reference — NEVER fabricate

INTERCHANGE OUTPUT (eBay MVL Format):
- Return a "compatibility" array with EVERY vehicle that uses this part — NOT just the donor
- Each entry: { year, make, model, chassisCode, trim, engine, notes }
- Include cross-platform vehicles if same part number applies
- Expand year ranges: list EACH year individually (e.g., 2015, 2016, 2017, 2018 — not just 2015-2018)
- "technicalNotes": any coding/programming/trim/engine restrictions as a string
- The compatibility array will be formatted as eBay File Exchange / MIP pipe-separated strings:
  Year=YYYY|Make=XXX|Model=YYY|Submodel=ZZZ|Trim=TTT|Engine=EEE

Return JSON:
{
  "items": [{
    "index": N,
    "title": "...",
    "description": "<h3>...</h3>...",
    "brand": "...",
    "type": "...",
    "mpn": "...",
    "oemNumber": "...",
    "placement": "...",
    "material": "...",
    "warranty": "No Warranty",
    "fitmentType": "Direct Replacement",
    "color": "",
    "interchangeNumber": "",
    "surfaceFinish": "",
    "performanceType": "",
    "bundleDescription": "",
    "itemSpecifics": {
      "Brand": "...",
      "Manufacturer Part Number": "...",
      "Type": "...",
      "Placement on Vehicle": "...",
      "Material": "...",
      "Color": "..."
    },
    "compatibility": [
      { "year": "2015", "make": "Mercedes-Benz", "model": "C-Class", "chassisCode": "W205", "trim": "", "engine": "", "notes": "" }
    ],
    "technicalNotes": "Requires dealer coding after installation"
  }]
}`;

function buildUserPrompt(payload) {
  return `Analyze these ${payload.length} automotive parts as a Senior Interchange Specialist. For each part:
1. Research the Part Number (MPN) to identify ALL Makes, Models, and Year ranges that use this exact part
2. Check for cross-platform compatibility (shared platforms between luxury/standard brands)
3. Include chassis/body codes for every compatible vehicle
4. Note any technical requirements (coding, trim-specific, engine-specific, positioning)

Each part was removed from a real vehicle identified by VIN. Use the decoded vehicle data (including engine, body class, drive type) for accurate fitment.

${JSON.stringify(payload)}`;
}

// ── JSON parsing (mirrors production parseOpenAiJson fallback chain) ──
function tryParse(t) { try { return { ok: true, v: JSON.parse(t) }; } catch (e) { return { ok: false, e: e.message }; } }
function parseModelJson(content) {
  const d = tryParse(content);
  if (d.ok) return { value: d.v, repaired: false };
  const fb = content.indexOf('{'), fbk = content.indexOf('[');
  const starts = [fb, fbk].filter((i) => i >= 0);
  if (!starts.length) throw new Error('non-JSON');
  const start = Math.min(...starts);
  const end = Math.max(content.lastIndexOf('}'), content.lastIndexOf(']'));
  if (end <= start) throw new Error('truncated');
  const ex = content.slice(start, end + 1);
  const exp = tryParse(ex);
  if (exp.ok) return { value: exp.v, repaired: true };
  const norm = ex.replace(/,\s*([}\]])/g, '$1');
  const np = tryParse(norm);
  if (np.ok) return { value: np.v, repaired: true };
  throw new Error('parse-failed');
}

// ── Quality scoring (programmatic, deterministic) ──
const REQUIRED_SPECIFICS = ['Brand', 'Manufacturer Part Number', 'Type', 'Placement on Vehicle'];
const OPTIONAL_SPECIFICS = ['Material', 'Color'];

function scoreItem(item, srcPart) {
  const s = { flags: [] };
  const title = String(item.title || '');
  // Title
  s.titleLen = title.length;
  s.titleWithinLimit = title.length > 0 && title.length <= 80;
  s.titleHasYear = /\b(19|20)\d{2}\b/.test(title);
  s.titleHasMake = /mercedes/i.test(title);
  s.titleHasModel = /c[\s-]?class|c[\s-]?350/i.test(title);
  s.titleHasChassis = /w204/i.test(title);
  s.titleHasCondition = /\bOEM\b|\bGenuine\b|\bUsed\b/i.test(title);
  s.titleNoAllCaps = !/\b[A-Z]{4,}\b/.test(title.replace(/OEM|AMG|RWD|MPN|W204/g, ''));
  s.titleScore = [s.titleWithinLimit, s.titleHasYear, s.titleHasMake, s.titleHasModel, s.titleHasChassis, s.titleHasCondition].filter(Boolean).length;

  // Description
  const desc = String(item.description || '');
  s.descHasHtml = /<h[34]>|<ul>|<li>/i.test(desc);
  s.descHasVerify = /verify part number compatibility/i.test(desc);
  s.descHasCompat = /compatib/i.test(desc);
  s.descHasCondition = /used|removed|inspected|tested/i.test(desc);
  s.descLen = desc.length;
  s.descScore = [s.descHasHtml, s.descHasVerify, s.descHasCompat, s.descHasCondition, desc.length > 300].filter(Boolean).length;

  // Item specifics
  const sp = item.itemSpecifics || {};
  s.requiredSpecificsFilled = REQUIRED_SPECIFICS.filter((k) => sp[k] && String(sp[k]).trim()).length;
  s.optionalSpecificsFilled = OPTIONAL_SPECIFICS.filter((k) => sp[k] && String(sp[k]).trim()).length;
  s.brandNormalized = /mercedes-benz/i.test(String(item.brand || sp.Brand || ''));
  s.hasPlacement = !!(item.placement || sp['Placement on Vehicle']);
  s.hasType = !!(item.type || sp.Type);
  s.hasWarranty = /no warranty/i.test(String(item.warranty || ''));
  s.hasFitmentType = !!item.fitmentType;

  // MPN fidelity — must match the provided partNumber, never fabricated
  const provided = String(srcPart.partNumber || '').replace(/\s+/g, '').toLowerCase();
  const mpn = String(item.mpn || sp['Manufacturer Part Number'] || '').replace(/\s+/g, '').toLowerCase();
  s.mpnMatchesProvided = provided.length > 0 && mpn.includes(provided.slice(0, 8)) || mpn === provided;
  if (mpn && provided && !mpn.includes(provided.slice(0, 6))) {
    s.flags.push(`MPN_MISMATCH provided=${srcPart.partNumber} got=${item.mpn}`);
  }

  // Fitment / compatibility
  const compat = Array.isArray(item.compatibility) ? item.compatibility : [];
  s.fitmentRows = compat.length;
  const years = new Set(compat.map((c) => String(c.year)));
  s.fitmentDistinctYears = years.size;
  s.fitmentExpandedBeyondDonor = compat.some((c) => String(c.year) !== '2008');
  s.fitmentHasChassis = compat.some((c) => /w20[0-9]/i.test(String(c.chassisCode || c.model || '')));
  s.fitmentAllMercedes = compat.length > 0 && compat.every((c) => /mercedes/i.test(String(c.make || '')));
  // Cross-platform hallucination flag: engine/door parts of W204 should NOT fit non-Mercedes
  const nonMercedes = compat.filter((c) => c.make && !/mercedes/i.test(String(c.make)));
  if (nonMercedes.length) s.flags.push(`CROSS_MAKE x${nonMercedes.length}: ${[...new Set(nonMercedes.map((c) => c.make))].join(',')}`);
  // Implausible year flag (W204 C-Class is 2008-2014; engine M272 2005-2015)
  const badYears = [...years].filter((y) => Number(y) < 2000 || Number(y) > 2016);
  if (badYears.length) s.flags.push(`IMPLAUSIBLE_YEARS: ${badYears.join(',')}`);

  // Hallucination: interchangeNumber fabricated (no source) / color guessed
  if (item.interchangeNumber && String(item.interchangeNumber).trim()) {
    s.flags.push(`INTERCHANGE_SET=${item.interchangeNumber}`);
  }

  // Composite (0-100)
  s.composite = Math.round(
    (s.titleScore / 6) * 25 +
    (s.descScore / 5) * 20 +
    (s.requiredSpecificsFilled / 4) * 20 +
    (Math.min(s.fitmentRows, 12) / 12) * 20 +
    (s.fitmentExpandedBeyondDonor ? 5 : 0) +
    (s.fitmentHasChassis ? 5 : 0) +
    (s.mpnMatchesProvided ? 5 : 0)
  );
  return s;
}

async function runModel(client, model, payload) {
  const userPrompt = buildUserPrompt(payload);
  const result = { model, ok: false, attempts: 0 };
  const t0 = Date.now();
  let resp;
  for (let attempt = 1; attempt <= 3; attempt++) {
    result.attempts = attempt;
    try {
      resp = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.25,
        max_tokens: MAX_TOKENS,
        response_format: { type: 'json_object' },
      });
      break;
    } catch (err) {
      result.lastError = err?.message || String(err);
      if (attempt === 3) { result.latencyMs = Date.now() - t0; return result; }
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  result.latencyMs = Date.now() - t0;
  const usage = resp.usage || {};
  result.promptTokens = usage.prompt_tokens || 0;
  result.completionTokens = usage.completion_tokens || 0;
  result.totalTokens = usage.total_tokens || 0;

  const pr = priceById.get(model);
  if (pr) {
    result.costUsd = (result.promptTokens / 1e6) * pr.inputPerM + (result.completionTokens / 1e6) * pr.outputPerM;
    result.inputPerM = pr.inputPerM;
    result.outputPerM = pr.outputPerM;
  }

  const content = resp.choices?.[0]?.message?.content || '';
  result.rawLength = content.length;
  try {
    const { value, repaired } = parseModelJson(content);
    result.schemaRepaired = repaired;
    const items = Array.isArray(value) ? value : (value.items || value.results || value.parts || [value]);
    result.itemCount = items.length;
    result.schemaValid = items.length === payload.length;
    result.items = items;
    // score each item
    const scores = items.map((it, i) => scoreItem(it, SAMPLE[it.index ?? i] || SAMPLE[i]));
    result.scores = scores;
    result.ok = true;
    // aggregate
    const avg = (f) => scores.reduce((a, s) => a + (f(s) || 0), 0) / scores.length;
    result.agg = {
      composite: Math.round(avg((s) => s.composite)),
      titleScore: +avg((s) => s.titleScore).toFixed(2),
      titleWithinLimit: scores.filter((s) => s.titleWithinLimit).length,
      descScore: +avg((s) => s.descScore).toFixed(2),
      requiredSpecificsFilled: +avg((s) => s.requiredSpecificsFilled).toFixed(2),
      fitmentRows: +avg((s) => s.fitmentRows).toFixed(1),
      fitmentDistinctYears: +avg((s) => s.fitmentDistinctYears).toFixed(1),
      expandedBeyondDonor: scores.filter((s) => s.fitmentExpandedBeyondDonor).length,
      hasChassis: scores.filter((s) => s.fitmentHasChassis).length,
      mpnFidelity: scores.filter((s) => s.mpnMatchesProvided).length,
      totalFlags: scores.reduce((a, s) => a + s.flags.length, 0),
      flags: scores.flatMap((s, i) => s.flags.map((f) => `[item${i}] ${f}`)),
    };
  } catch (err) {
    result.schemaValid = false;
    result.parseError = err.message;
    result.rawSample = content.slice(0, 500);
  }
  return result;
}

async function main() {
  if (!KEY) { console.error('No OPENAI_API_KEY'); process.exit(1); }
  const client = new OpenAI({ apiKey: KEY, baseURL: BASE, timeout: 180000 });
  const payload = buildPayload();
  fs.writeFileSync(path.join(OUT_DIR, 'sample-payload.json'), JSON.stringify(payload, null, 2));

  const results = await Promise.all(MODELS.map(async (model) => {
    console.log(`▶ start ${model}`);
    const r = await runModel(client, model, payload);
    const slug = model.replace(/[\/:]/g, '_');
    fs.writeFileSync(path.join(RAW_DIR, `${slug}.json`), JSON.stringify(r, null, 2));
    if (r.ok) {
      console.log(`✔ ${model}  ${r.latencyMs}ms  tok=${r.totalTokens}  $${r.costUsd?.toFixed(5)}  composite=${r.agg.composite}  fitment=${r.agg.fitmentRows}rows  flags=${r.agg.totalFlags}`);
    } else {
      console.log(`✖ ${model}  ${r.latencyMs}ms  err=${r.parseError || r.lastError}`);
    }
    return r;
  }));

  const summary = [];
  for (const r of results) {
    summary.push({
      model: r.model,
      ok: r.ok,
      latencyMs: r.latencyMs,
      attempts: r.attempts,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      totalTokens: r.totalTokens,
      costUsd: r.costUsd,
      inputPerM: r.inputPerM,
      outputPerM: r.outputPerM,
      schemaValid: r.schemaValid,
      schemaRepaired: r.schemaRepaired,
      itemCount: r.itemCount,
      agg: r.agg,
      parseError: r.parseError,
    });
  }
  // Merge with any prior summary so partial re-runs accumulate.
  const summaryPath = path.join(OUT_DIR, 'metrics-summary.json');
  let prior = { results: [] };
  if (fs.existsSync(summaryPath)) { try { prior = JSON.parse(fs.readFileSync(summaryPath, 'utf8')); } catch {} }
  const byModel = new Map((prior.results || []).map((x) => [x.model, x]));
  for (const x of summary) byModel.set(x.model, x);
  const merged = ALL_MODELS.map((m) => byModel.get(m)).filter(Boolean);
  fs.writeFileSync(summaryPath, JSON.stringify({ vehicle: VEHICLE, sampleSize: SAMPLE.length, generatedAt: new Date().toISOString(), results: merged }, null, 2));
  console.log('\n\nWrote metrics-summary.json + raw/*.json');
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
