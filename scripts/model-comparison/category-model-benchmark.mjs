/**
 * Benchmark OpenRouter models for eBay Motors category classification.
 * Ground truth: expected leaf category names (verified Motors taxonomy).
 *
 * Usage:
 *   node scripts/model-comparison/category-model-benchmark.mjs
 *   node scripts/model-comparison/category-model-benchmark.mjs only=deepseek/deepseek-chat-v3-0324,openai/gpt-4o-mini
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import {
  getCategoryNamesForPrompt,
  resolveCategoryByName,
} from '../lib/motors-category-catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'docs', 'model-comparison', 'category-benchmark');
const PRICING_PATH = path.join(ROOT, 'scripts', 'model-comparison', 'catalog-pricing.json');

fs.mkdirSync(OUT_DIR, { recursive: true });

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
  'deepseek/deepseek-chat-v3-0324',
  'meta-llama/llama-3.3-70b-instruct',
  'openai/gpt-4o-mini',
  'google/gemini-2.5-flash',
  'openai/gpt-4.1-mini',
  'minimax/minimax-m3',
  'qwen/qwen-2.5-72b-instruct',
];

const onlyArg = process.argv.find((a) => a.startsWith('only='));
const MODELS = onlyArg ? onlyArg.slice(5).split(',') : ALL_MODELS;

/** Representative dismantler inventory — expected Motors leaf names */
const FIXTURES = [
  { partName: 'Seat frame upholstery', note: 'front left', expected: 'Seats' },
  { partName: 'Headrest guide', note: 'rear', expected: 'Seats' },
  { partName: 'Door armrest', note: 'interior trim', expected: 'Interior Door Panels & Parts' },
  { partName: 'Interior door panel', note: 'front right', expected: 'Interior Door Panels & Parts' },
  { partName: 'Exterior door shell', note: 'driver side', expected: 'Exterior Door Panels & Frames' },
  { partName: 'Door handle', note: 'exterior chrome', expected: 'Door Handles' },
  { partName: 'Window regulator', note: 'front', expected: 'Window Motors, Parts & Accessories' },
  { partName: 'Dashboard trim', note: 'center', expected: 'Dashboards & Dashboard Parts' },
  { partName: 'Instrument cluster', note: '', expected: 'Dashboards & Dashboard Parts' },
  { partName: 'Headlight', note: 'xenon left', expected: 'Headlights' },
  { partName: 'Tail light', note: 'inner', expected: 'Tail Lights' },
  { partName: 'Side mirror', note: 'power fold', expected: 'Exterior Mirrors' },
  { partName: 'Brake caliper', note: 'front', expected: 'Brake Discs, Rotors & Hardware' },
  { partName: 'Alternator', note: '', expected: 'Complete Engines' },
  { partName: 'Radiator', note: 'aluminum', expected: 'Radiators & Parts' },
  { partName: 'Control unit', note: 'ECU engine', expected: 'Engine Computers' },
  { partName: 'Speaker', note: 'door', expected: 'Car Speakers' },
  { partName: 'Center console', note: 'lid', expected: 'Center Consoles' },
  { partName: 'Wheel', note: 'alloy 18in', expected: 'Wheels' },
  { partName: 'Bumper cover', note: 'front', expected: 'Bumpers & Parts' },
];

const pricing = JSON.parse(fs.readFileSync(PRICING_PATH, 'utf8'));
const priceByModel = new Map(pricing.map((p) => [p.id, p]));

function buildSystemPrompt() {
  return `You classify automotive parts into eBay Motors US leaf categories.
Use ONLY names from this list (copy exactly):
${getCategoryNamesForPrompt()}
Return JSON: { "items": [ { "index": 0, "categoryName": "...", "confidence": 0.9 } ] }`;
}

function buildUserPrompt(batch) {
  return `Classify:\n${JSON.stringify(
    batch.map((f, index) => ({
      index,
      make: 'Audi',
      partName: f.partName,
      note: f.note,
    })),
  )}`;
}

function scoreFixture(fixture, predictedName) {
  const resolved = resolveCategoryByName(predictedName, 0.5);
  const predictedId = resolved?.categoryName ?? predictedName;
  const exact = norm(predictedId) === norm(fixture.expected);
  const partial =
    norm(predictedId).includes(norm(fixture.expected)) ||
    norm(fixture.expected).includes(norm(predictedId));
  return { exact, partial, predicted: predictedId };
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
}

function estimateCostUsd(model, usage) {
  const p = priceByModel.get(model);
  if (!p || !usage) return null;
  const inCost = ((usage.prompt_tokens ?? 0) / 1_000_000) * p.inputPerM;
  const outCost = ((usage.completion_tokens ?? 0) / 1_000_000) * p.outputPerM;
  return inCost + outCost;
}

async function runModel(client, model) {
  const start = Date.now();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: buildUserPrompt(FIXTURES) },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });
  const latencyMs = Date.now() - start;
  const content = response.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content);
  const items = Array.isArray(parsed) ? parsed : (parsed.items || []);

  let exact = 0;
  let partial = 0;
  const details = FIXTURES.map((fixture, index) => {
    const row = items.find((it) => it.index === index) ?? items[index];
    const { exact: isExact, partial: isPartial, predicted } = scoreFixture(
      fixture,
      row?.categoryName,
    );
    if (isExact) exact += 1;
    else if (isPartial) partial += 1;
    return {
      partName: fixture.partName,
      expected: fixture.expected,
      predicted,
      aiName: row?.categoryName ?? null,
      confidence: row?.confidence ?? null,
      exact: isExact,
      partial: isPartial,
    };
  });

  const usage = response.usage;
  const costUsd = estimateCostUsd(model, usage);
  const accuracy = exact / FIXTURES.length;
  const accuracyPartial = (exact + partial) / FIXTURES.length;

  return {
    model,
    latencyMs,
    exact,
    partial,
    accuracy,
    accuracyPartial,
    tokens: usage?.total_tokens ?? 0,
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    costUsd,
    costPer1000Parts:
      costUsd != null ? (costUsd / FIXTURES.length) * 1000 : null,
    valueScore: costUsd != null && costUsd > 0 ? accuracy / costUsd : accuracy * 1000,
    details,
  };
}

async function main() {
  if (!KEY) {
    console.error('OPENAI_API_KEY not set — cannot run category benchmark');
    process.exit(1);
  }

  const client = new OpenAI({
    apiKey: KEY,
    baseURL: BASE,
    defaultHeaders: {
      'HTTP-Referer': 'https://realtrackapp.com',
      'X-Title': 'RealTrackApp Category Benchmark',
    },
  });

  const results = [];
  for (const model of MODELS) {
    process.stdout.write(`Testing ${model}... `);
    try {
      const result = await runModel(client, model);
      results.push(result);
      console.log(
        `${(result.accuracy * 100).toFixed(0)}% exact, $${result.costUsd?.toFixed(4) ?? '?'}, ${result.latencyMs}ms`,
      );
      fs.writeFileSync(
        path.join(OUT_DIR, `${model.replace(/\//g, '__')}.json`),
        JSON.stringify(result, null, 2),
      );
    } catch (err) {
      console.log(`FAIL: ${err.message}`);
      results.push({ model, error: err.message });
    }
  }

  const ranked = results
    .filter((r) => r.accuracy != null)
    .sort((a, b) => b.valueScore - a.valueScore);

  const report = {
    generatedAt: new Date().toISOString(),
    fixtureCount: FIXTURES.length,
    recommendation: ranked[0]?.model ?? null,
    ranked: ranked.map((r) => ({
      model: r.model,
      accuracy: r.accuracy,
      accuracyPartial: r.accuracyPartial,
      costUsd: r.costUsd,
      costPer1000Parts: r.costPer1000Parts,
      latencyMs: r.latencyMs,
      valueScore: r.valueScore,
    })),
    results,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'REPORT.json'), JSON.stringify(report, null, 2));

  const md = [
    '# Category classification model benchmark',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `**Recommended model:** \`${report.recommendation}\` (best accuracy/cost value score)`,
    '',
    '| Model | Exact accuracy | Partial | Cost (20 parts) | Est. / 1000 parts | Latency |',
    '|-------|----------------|---------|-----------------|-------------------|---------|',
    ...ranked.map(
      (r) =>
        `| ${r.model} | ${(r.accuracy * 100).toFixed(1)}% | ${(r.accuracyPartial * 100).toFixed(1)}% | $${r.costUsd?.toFixed(4) ?? '—'} | $${r.costPer1000Parts?.toFixed(3) ?? '—'} | ${r.latencyMs}ms |`,
    ),
    '',
    'Set `PIPELINE_CATEGORY_AI_MODEL` to the recommended model.',
  ].join('\n');

  fs.writeFileSync(path.join(OUT_DIR, 'REPORT.md'), md);
  console.log('\n' + md);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
