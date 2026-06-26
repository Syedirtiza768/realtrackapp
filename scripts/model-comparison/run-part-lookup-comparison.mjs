/**
 * Benchmark OpenRouter models for /listings/new OEM text part lookup
 * (production prompt from single-listing-form.service.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'docs', 'model-comparison');
const OUT_FILE = path.join(OUT_DIR, 'part-lookup-comparison.json');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
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

const pricing = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'catalog-pricing.json'), 'utf8'),
);
const priceById = new Map(pricing.map((p) => [p.id, p]));

const SYSTEM_PROMPT = `You are an automotive parts identification specialist.
Given a part number or OEM number, infer the most likely part details for an eBay Motors listing.
Return ONLY valid JSON with these keys (use empty string when unknown):
{
  "partName": "human-readable part name with position if known",
  "brand": "vehicle or parts brand (OEM manufacturer, not aftermarket unless clearly an aftermarket number)",
  "model": "primary vehicle model line if identifiable from the part number pattern",
  "category": "eBay-oriented category hint e.g. Brakes, Engine Cooling, Lighting",
  "note": "2-4 sentences: condition assumptions (used OEM), fitment hints, interchange notes, seller-facing details for listing enrichment",
  "confidence": "high|medium|low"
}
Rules:
- Never fabricate exact cross-reference numbers.
- Mercedes A-numbers, BMW numbers, Toyota/Lexus formats should inform brand/model.
- If uncertain, use lower confidence and leave fields empty rather than guessing wildly.
- The note field must be ready to paste into a listing form as additional seller details.`;

/** Representative OEM lookup cases with credibility expectations */
const CASES = [
  {
    id: 'mercedes-engine',
    partNumber: '272.970',
    expectBrand: /mercedes/i,
    keywords: [/engine/i, /m272/i, /3\.5/i, /v6/i],
    minConfidence: 'medium',
  },
  {
    id: 'mercedes-regulator',
    partNumber: 'A 204 720 06 79',
    expectBrand: /mercedes/i,
    keywords: [/window/i, /regulator/i],
    expectModel: /c-class|c class|w204|204/i,
    minConfidence: 'medium',
  },
  {
    id: 'mercedes-latch',
    partNumber: 'A 204 730 08 35',
    expectBrand: /mercedes/i,
    keywords: [/latch|actuator|lock|door/i],
    minConfidence: 'medium',
  },
  {
    id: 'toyota-alternator',
    partNumber: '27060-0V210',
    expectBrand: /toyota/i,
    keywords: [/alternator/i],
    minConfidence: 'medium',
  },
  {
    id: 'bosch-aftermarket',
    partNumber: '0986424590',
    expectBrand: /bosch/i,
    keywords: [/brake|pad|sensor/i],
    minConfidence: 'low',
  },
  {
    id: 'unknown-fake',
    partNumber: 'ZZZ-INVALID-00000',
    expectLowOrEmpty: true,
  },
];

const MODELS = [
  'openai/gpt-4o-mini',
  'openai/gpt-4.1-mini',
  'google/gemini-2.5-flash',
  'deepseek/deepseek-chat-v3-0324',
  'anthropic/claude-3.5-haiku',
  'minimax/minimax-m3',
  'meta-llama/llama-3.3-70b-instruct',
];

function estCost(model, promptTokens, completionTokens) {
  const p = priceById.get(model);
  if (!p) return null;
  return (promptTokens / 1e6) * p.inputPerM + (completionTokens / 1e6) * p.outputPerM;
}

function parseJson(raw) {
  let s = String(raw ?? '').trim();
  s = s.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '');
  const start = s.indexOf('{');
  if (start < 0) throw new Error('no json object');
  s = s.slice(start);
  const end = s.lastIndexOf('}');
  if (end >= 0) s = s.slice(0, end + 1);
  return JSON.parse(s);
}

function isUsable(r) {
  if (!r || r.confidence === 'low') return false;
  if (!r.partName?.trim()) return false;
  if (!r.brand?.trim() && !r.category?.trim() && !r.note?.trim()) return false;
  if (r.confidence === 'medium' && !r.brand?.trim() && !r.category?.trim()) return false;
  return true;
}

function scoreCase(parsed, spec) {
  let score = 0;
  const notes = [];

  if (!parsed) {
    return { score: 0, notes: ['parse failed'], usable: false };
  }

  const fields = ['partName', 'brand', 'category', 'note'];
  for (const f of fields) {
    if (parsed[f]?.trim()) score += 10;
  }

  if (spec.expectLowOrEmpty) {
    const low = parsed.confidence === 'low' || !isUsable(parsed);
    if (low) {
      score += 30;
      notes.push('correctly cautious on unknown PN');
    } else {
      notes.push('hallucinated on fake PN');
    }
    return { score, notes, usable: isUsable(parsed) };
  }

  if (spec.expectBrand && spec.expectBrand.test(parsed.brand || '')) {
    score += 25;
    notes.push('brand match');
  } else {
    notes.push('brand mismatch');
  }

  const pn = (parsed.partName || '').toLowerCase();
  const hit = (spec.keywords || []).some((re) => re.test(pn) || re.test(parsed.note || ''));
  if (hit) {
    score += 20;
    notes.push('part type plausible');
  } else {
    notes.push('part type weak');
  }

  if (spec.expectModel && spec.expectModel.test(`${parsed.model || ''} ${parsed.partName || ''}`)) {
    score += 10;
    notes.push('model/platform hint');
  }

  const conf = parsed.confidence || 'medium';
  const rank = { high: 3, medium: 2, low: 1 };
  if (rank[conf] >= rank[spec.minConfidence || 'medium']) {
    score += 15;
    notes.push('confidence ok');
  } else {
    notes.push('confidence too low');
  }

  return { score, notes, usable: isUsable(parsed) };
}

async function callModel(client, model, partNumber) {
  const start = Date.now();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Part number / OEM: ${partNumber}` },
    ],
    temperature: 0.2,
    max_tokens: 800,
    response_format: { type: 'json_object' },
  });
  const latencyMs = Date.now() - start;
  const raw = response.choices[0]?.message?.content ?? '';
  const usage = response.usage || {};
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  let parsed = null;
  let parseError = null;
  try {
    parsed = parseJson(raw);
  } catch (e) {
    parseError = e.message;
  }
  const cost = estCost(model, promptTokens, completionTokens);
  return { raw, parsed, parseError, latencyMs, promptTokens, completionTokens, cost };
}

async function main() {
  if (!KEY) {
    console.error('OPENAI_API_KEY missing');
    process.exit(1);
  }

  const client = new OpenAI({
    apiKey: KEY,
    baseURL: BASE,
    defaultHeaders: { 'HTTP-Referer': 'https://realtrackapp.com', 'X-Title': 'RealTrackApp' },
  });

  const results = [];

  for (const model of MODELS) {
    console.log(`\n=== ${model} ===`);
    const modelResult = {
      model,
      cases: [],
      totalScore: 0,
      maxScore: CASES.length * 100,
      avgLatencyMs: 0,
      totalCostUsd: 0,
      avgCostUsd: 0,
      usableRate: 0,
      parseFailures: 0,
    };

    let latencySum = 0;
    let costSum = 0;
    let usableCount = 0;

    for (const spec of CASES) {
      process.stdout.write(`  ${spec.id}... `);
      try {
        const res = await callModel(client, model, spec.partNumber);
        latencySum += res.latencyMs;
        costSum += res.cost ?? 0;
        if (res.parseError) modelResult.parseFailures++;

        const { score, notes, usable } = scoreCase(res.parsed, spec);
        if (usable) usableCount++;
        modelResult.totalScore += score;

        modelResult.cases.push({
          id: spec.id,
          partNumber: spec.partNumber,
          score,
          usable,
          notes,
          parseError: res.parseError,
          latencyMs: res.latencyMs,
          costUsd: res.cost,
          parsed: res.parsed,
        });
        console.log(`score=${score} usable=${usable} ${res.latencyMs}ms`);
      } catch (err) {
        console.log(`ERROR ${err.message}`);
        modelResult.cases.push({
          id: spec.id,
          partNumber: spec.partNumber,
          score: 0,
          usable: false,
          error: err.message,
        });
        modelResult.parseFailures++;
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    modelResult.avgLatencyMs = Math.round(latencySum / CASES.length);
    modelResult.totalCostUsd = costSum;
    modelResult.avgCostUsd = costSum / CASES.length;
    modelResult.usableRate = usableCount / CASES.length;
    modelResult.credibilityPct = Math.round((modelResult.totalScore / modelResult.maxScore) * 100);
    modelResult.cost15000Usd = modelResult.avgCostUsd * 15000;
    modelResult.cost15000With10PctVisionFallback = modelResult.avgCostUsd * 15000 + modelResult.avgCostUsd * 2.5 * 1500;

    results.push(modelResult);
    console.log(
      `  → credibility ${modelResult.credibilityPct}% | avg $${modelResult.avgCostUsd.toFixed(6)}/lookup | 15k $${modelResult.cost15000Usd.toFixed(2)}`,
    );
  }

  results.sort((a, b) => {
    if (b.credibilityPct !== a.credibilityPct) return b.credibilityPct - a.credibilityPct;
    return a.avgCostUsd - b.avgCostUsd;
  });

  const report = {
    generatedAt: new Date().toISOString(),
    task: 'single-listing OEM text part lookup',
    cases: CASES.length,
    modelsTested: MODELS.length,
    rankings: results.map((r) => ({
      model: r.model,
      credibilityPct: r.credibilityPct,
      usableRate: r.usableRate,
      parseFailures: r.parseFailures,
      avgLatencyMs: r.avgLatencyMs,
      avgCostUsd: r.avgCostUsd,
      cost15000Usd: r.cost15000Usd,
      cost15000With10PctVisionFallback: r.cost15000With10PctVisionFallback,
    })),
    details: results,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${OUT_FILE}`);
  console.log('\n--- RANKING (credibility, then cost) ---');
  for (const r of report.rankings) {
    console.log(
      `${r.model.padEnd(40)} cred=${r.credibilityPct}% usable=${Math.round(r.usableRate * 100)}% 15k=$${r.cost15000Usd.toFixed(2)} avg=$${r.avgCostUsd.toFixed(6)}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
