/**
 * VIN decode model benchmark — tests OpenRouter models on a fixed VIN
 * using the production VinDecodeService enrichment prompt shape.
 *
 * Usage: node scripts/model-comparison/vin-model-benchmark.mjs
 *        node scripts/model-comparison/vin-model-benchmark.mjs only=google/gemini-2.5-flash,openai/gpt-4.1-mini
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'docs', 'model-comparison', 'vin-benchmark');
fs.mkdirSync(OUT_DIR, { recursive: true });

const TEST_VIN = 'JTNB29HK8K3019731';

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

const ALL_MODELS = [
  'minimax/minimax-m3',
  'openai/gpt-4o-mini',
  'openai/gpt-4.1-mini',
  'openai/gpt-4.1',
  'google/gemini-2.5-flash',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3.5-haiku',
  'deepseek/deepseek-chat-v3-0324',
  'meta-llama/llama-3.3-70b-instruct',
  'qwen/qwen-2.5-72b-instruct',
  'mistralai/mistral-small-3.1-24b-instruct',
];

const onlyArg = process.argv.find((a) => a.startsWith('only='));
const MODELS = onlyArg ? onlyArg.slice(5).split(',') : ALL_MODELS;

const SYSTEM_PROMPT = `You are an automotive VIN decoder expert. Given a VIN and any partial NHTSA decode data, return a JSON object with comprehensive vehicle information.

Return ONLY valid JSON with this exact structure:
{
  "make": "string",
  "model": "string",
  "trim": "string",
  "year": "string",
  "bodyClass": "string (e.g. SUV, Sedan, Pickup, Coupe)",
  "driveType": "string (e.g. AWD, FWD, RWD, 4WD)",
  "engineCylinders": "string (e.g. 4, 6, 8)",
  "engineDisplacementL": "string (e.g. 2.0, 3.5)",
  "engineDescription": "string (e.g. 2.0L Turbo I-4)",
  "fuelType": "string (e.g. Gasoline, Diesel, Hybrid)",
  "transmission": "string (e.g. 8-speed Automatic, CVT, 6-speed Manual)",
  "mpg": "string (e.g. 24 city / 30 highway)",
  "horsepower": "string (e.g. 235 hp)",
  "torque": "string (e.g. 258 lb-ft)",
  "seatingCapacity": "string",
  "wheelbase": "string (e.g. 105.1 in)",
  "curbWeight": "string (e.g. 3,940 lbs)",
  "plantCountry": "string",
  "plantCity": "string",
  "plantName": "string",
  "vehicleType": "string",
  "manufacturingCountry": "string",
  "recallsOrSafetyNotes": "string",
  "confidenceNotes": "string — explain which fields are verified vs inferred",
  "dataSourcesRecommended": ["string array of authoritative sources to verify uncertain fields"],
  "commonParts": ["string array of 5-10 common aftermarket parts for this vehicle"],
  "knownFitment": ["string array of known compatible vehicle years/models sharing parts"],
  "ebayMotorsListingHints": {
    "titleKeywords": ["string"],
    "categoryHints": ["string"],
    "itemSpecifics": {"key": "value"}
  },
  "description": "brief 1-2 sentence description of this vehicle"
}

Be precise. Distinguish verified facts from assumptions. If unsure about a field, use an empty string and explain uncertainty in confidenceNotes.`;

async function fetchNhtsa(vin) {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`;
  const { data } = await axios.get(url, { timeout: 60_000 });
  const results = data?.Results ?? [];
  const raw = {};
  for (const r of results) {
    if (r.Value && String(r.Value).trim()) raw[r.Variable] = String(r.Value).trim();
  }
  return raw;
}

function nhtsaSummary(raw) {
  const fields = [
    ['Model Year', raw['Model Year']],
    ['Make', raw['Make']],
    ['Model', raw['Model']],
    ['Trim', raw['Trim']],
    ['Body Class', raw['Body Class']],
    ['Drive Type', raw['Drive Type']],
    ['Engine Number of Cylinders', raw['Engine Number of Cylinders']],
    ['Displacement (L)', raw['Displacement (L)']],
    ['Fuel Type - Primary', raw['Fuel Type - Primary']],
    ['Vehicle Type', raw['Vehicle Type']],
    ['Plant Country', raw['Plant Country']],
    ['Plant City', raw['Plant City']],
    ['Plant Company Name', raw['Plant Company Name']],
    ['Error Code', raw['Error Code']],
    ['Error Text', raw['Error Text']],
    ['Suggested VIN', raw['Suggested VIN']],
    ['Additional Error Text', raw['Additional Error Text']],
  ];
  return fields.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ');
}

async function fetchPricing() {
  const { data } = await axios.get(`${BASE}/models`, {
    headers: { Authorization: `Bearer ${KEY}` },
    timeout: 30_000,
  });
  return new Map((data.data || []).map((m) => [m.id, m]));
}

function estimateCost(modelId, pricingMap, usage) {
  const m = pricingMap.get(modelId);
  if (!m?.pricing || !usage) return null;
  const inP = Number(m.pricing.prompt) * usage.prompt_tokens;
  const outP = Number(m.pricing.completion) * usage.completion_tokens;
  return inP + outP;
}

function scoreResponse(parsed, groundTruth) {
  const gt = groundTruth;
  const p = parsed || {};
  const checks = {
    yearMatch: String(p.year || '') === gt.year,
    makeMatch: String(p.make || '').toUpperCase().includes('TOYOTA'),
    plantCountryMatch: !p.plantCountry || String(p.plantCountry).toUpperCase().includes('JAPAN'),
    vehicleTypeMatch: !p.vehicleType || /passenger|sedan|car/i.test(String(p.vehicleType)),
    hasConfidenceNotes: Boolean(p.confidenceNotes && String(p.confidenceNotes).length > 10),
    mentionsNhtsaGap: /nhtsa|incomplete|error|uncertain|verify|partial/i.test(
      JSON.stringify({ confidenceNotes: p.confidenceNotes, recallsOrSafetyNotes: p.recallsOrSafetyNotes }),
    ),
    hasTransmission: Boolean(p.transmission),
    hasEngineDescription: Boolean(p.engineDescription),
    hasEbayHints: Boolean(p.ebayMotorsListingHints && typeof p.ebayMotorsListingHints === 'object'),
    hasCommonParts: Array.isArray(p.commonParts) && p.commonParts.length >= 3,
    hasFitment: Array.isArray(p.knownFitment) && p.knownFitment.length >= 1,
    hasDataSources: Array.isArray(p.dataSourcesRecommended) && p.dataSourcesRecommended.length >= 1,
    jsonComplete: Boolean(p.make && p.model && p.year),
  };

  const fieldCount = [
    'model', 'trim', 'bodyClass', 'driveType', 'engineCylinders', 'engineDisplacementL',
    'engineDescription', 'fuelType', 'transmission', 'plantCity', 'plantName',
  ].filter((k) => p[k] && String(p[k]).trim()).length;

  const score =
    Object.values(checks).filter(Boolean).length * 5 +
    Math.min(fieldCount, 11) * 3;

  return { checks, fieldCount, score, maxScore: Object.keys(checks).length * 5 + 33 };
}

async function runModel(client, modelId, userPrompt, pricingMap) {
  const started = Date.now();
  try {
    const resp = await client.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });
    const latencyMs = Date.now() - started;
    const rawContent = resp.choices?.[0]?.message?.content ?? '';
    let parsed = null;
    let parseError = null;
    try {
      parsed = JSON.parse(rawContent);
    } catch (e) {
      parseError = e.message;
    }
    const meta = pricingMap.get(modelId);
    return {
      modelId,
      ok: true,
      latencyMs,
      usage: resp.usage,
      estimatedCostUsd: estimateCost(modelId, pricingMap, resp.usage),
      contextLength: meta?.context_length ?? null,
      rawContent,
      parsed,
      parseError,
    };
  } catch (err) {
    return {
      modelId,
      ok: false,
      latencyMs: Date.now() - started,
      error: err.message,
      status: err.status,
    };
  }
}

async function main() {
  if (!KEY) {
    console.error('OPENAI_API_KEY missing in .env');
    process.exit(1);
  }

  console.log(`Fetching NHTSA ground truth for ${TEST_VIN}...`);
  const nhtsaRaw = await fetchNhtsa(TEST_VIN);
  fs.writeFileSync(path.join(OUT_DIR, 'nhtsa-raw.json'), JSON.stringify(nhtsaRaw, null, 2));

  const groundTruth = {
    vin: TEST_VIN,
    year: nhtsaRaw['Model Year'] || '2019',
    make: nhtsaRaw['Make'] || 'TOYOTA',
    model: nhtsaRaw['Model'] || '',
    trim: nhtsaRaw['Trim'] || '',
    plantCountry: nhtsaRaw['Plant Country'] || 'JAPAN',
    plantCity: nhtsaRaw['Plant City'] || 'TOYOTA CITY',
    plantCompany: nhtsaRaw['Plant Company Name'] || '',
    vehicleType: nhtsaRaw['Vehicle Type'] || 'PASSENGER CAR',
    nhtsaIncomplete: !nhtsaRaw['Model'],
    nhtsaErrors: nhtsaRaw['Error Text'] || '',
  };

  const summary = nhtsaSummary(nhtsaRaw);
  const userPrompt = `Decode this VIN comprehensively:
VIN: ${TEST_VIN}
Partial NHTSA data: ${summary || 'No data available'}

Provide the full vehicle specification.`;

  console.log('Loading OpenRouter pricing catalog...');
  const pricingMap = await fetchPricing();

  const client = new OpenAI({ apiKey: KEY, baseURL: BASE, timeout: 120_000 });

  const results = [];
  for (const modelId of MODELS) {
    if (!pricingMap.has(modelId)) {
      console.log(`SKIP (not in catalog): ${modelId}`);
      continue;
    }
    console.log(`Testing ${modelId}...`);
    const r = await runModel(client, modelId, userPrompt, pricingMap);
    if (r.ok && r.parsed) {
      r.scoring = scoreResponse(r.parsed, groundTruth);
    }
    results.push(r);
    fs.writeFileSync(path.join(OUT_DIR, `${modelId.replace(/\//g, '__')}.json`), JSON.stringify(r, null, 2));
    console.log(
      r.ok
        ? `  OK ${r.latencyMs}ms cost=$${(r.estimatedCostUsd ?? 0).toFixed(6)} score=${r.scoring?.score ?? 'n/a'}`
        : `  FAIL ${r.error}`,
    );
  }

  const report = {
    testVin: TEST_VIN,
    runAt: new Date().toISOString(),
    groundTruth,
    nhtsaSummary: summary,
    models: results.map((r) => ({
      modelId: r.modelId,
      ok: r.ok,
      latencyMs: r.latencyMs,
      estimatedCostUsd: r.estimatedCostUsd,
      contextLength: r.contextLength,
      parseError: r.parseError,
      error: r.error,
      scoring: r.scoring,
      decoded: r.parsed
        ? {
            year: r.parsed.year,
            make: r.parsed.make,
            model: r.parsed.model,
            trim: r.parsed.trim,
            engineDescription: r.parsed.engineDescription,
            transmission: r.parsed.transmission,
            driveType: r.parsed.driveType,
            bodyClass: r.parsed.bodyClass,
            plantCountry: r.parsed.plantCountry,
            confidenceNotes: r.parsed.confidenceNotes,
          }
        : null,
    })),
  };

  fs.writeFileSync(path.join(OUT_DIR, 'REPORT.json'), JSON.stringify(report, null, 2));

  const ranked = report.models
    .filter((m) => m.ok && m.scoring)
    .sort((a, b) => b.scoring.score - a.scoring.score || a.latencyMs - b.latencyMs);

  console.log('\n=== RANKED BY SCORE ===');
  for (const m of ranked) {
    const p = pricingMap.get(m.modelId);
    const inM = p ? (Number(p.pricing.prompt) * 1_000_000).toFixed(3) : '?';
    const outM = p ? (Number(p.pricing.completion) * 1_000_000).toFixed(3) : '?';
    console.log(
      `${m.modelId.padEnd(42)} score=${m.scoring.score}/${m.scoring.maxScore}  ${m.latencyMs}ms  $${(m.estimatedCostUsd ?? 0).toFixed(5)}  in=$${inM}/M out=$${outM}/M`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
