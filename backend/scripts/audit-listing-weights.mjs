// Audit + backfill shipping weight (kg) for listings across all connected
// stores. There is no existing weight-estimation logic in the app — `weight`
// is a purely optional manual field on the Add Part form, so ~100% of
// listings currently have weight = NULL (one exception at 100.000 kg,
// almost certainly wrong). This script estimates a realistic shipping
// weight per listing via a cheap bulk AI model and writes it back.
//
// Usage (run inside the backend container so DB/env vars are already correct):
//   node scripts/audit-listing-weights.mjs --dry-run --limit 20               # sample, no writes
//   node scripts/audit-listing-weights.mjs --apply --status published        # published only
//   node scripts/audit-listing-weights.mjs --apply --status draft,ready,published  # every listing
//
// Flags:
//   --dry-run       Default. Estimates and reports, writes nothing.
//   --apply         Writes the estimated weight to listing_records.weight.
//   --status LIST   Comma-separated status filter (default: published).
//   --limit N       Cap the number of listings processed (default: all).
//   --concurrency N Parallel AI calls (default 8).
//   --report PATH   Write a JSON report to this path (default: ./weight-audit-report.json).
//
// NOTE: uses a pg Pool (not a single Client) so concurrent workers can issue
// overlapping queries safely — a single Client does not support that.

import { Pool } from 'pg';
import OpenAI from 'openai';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, def) => {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
};

const APPLY = flag('apply');
const LIMIT = opt('limit', null) ? Number(opt('limit', null)) : null;
const CONCURRENCY = Number(opt('concurrency', '8'));
const REPORT_PATH = opt('report', './weight-audit-report.json');
const STATUSES = opt('status', 'published')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const MODEL = process.env.OPENAI_MODEL_BULK || 'deepseek/deepseek-chat-v3-0324';
const BASE_URL = process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';
const API_KEY = process.env.OPENAI_API_KEY;

// Broad sanity bounds — reject/retry values outside this range rather than
// writing an obviously-parsed-wrong number. Not a confidence gate (every
// in-bounds estimate gets written per the chosen approach), just a guard
// against a garbled model response.
const MIN_KG = 0.02;
const MAX_KG = 400;

const SYSTEM_PROMPT = `You are a shipping-weight estimator for used automotive parts. You will be given reference facts about a part (brand, type, title, category, OEM/MPN) — these are input data only. Do NOT repeat, describe, validate, or comment on them, and do NOT answer any question about compatibility, condition, or part identity.
Your ONLY task: estimate the realistic PACKAGED shipping weight in kilograms for that part — actual part weight plus reasonable box/padding weight, as a seller would weigh it before shipping.
Calibration: small parts (sensors, switches, relays, trim clips, small brackets) 0.05-0.6kg; medium parts (headlights, tail lights, mirrors, small control modules, brake calipers, starters) 1-5kg; large body/interior parts (bumpers, seats, doors, dashboards, fenders) 5-18kg; drivetrain/suspension assemblies (axles, subframes, transfer cases) 15-60kg; engines and transmissions 50-200kg.
Output EXACTLY this JSON shape and nothing else — no markdown, no explanation, no additional fields: {"weightKg": <number>, "confidence": "high"|"medium"|"low"}
Example output: {"weightKg": 2.5, "confidence": "high"}`;

function buildUserPrompt(row) {
  const parts = [
    row.cBrand && `Brand: ${row.cBrand}`,
    row.cType && `Part type: ${row.cType}`,
    row.title && `Title: ${row.title}`,
    row.categoryName && `Category: ${row.categoryName}`,
    (row.cManufacturerPartNumber || row.cOeOemPartNumber) &&
      `OEM/MPN: ${row.cManufacturerPartNumber || row.cOeOemPartNumber}`,
  ].filter(Boolean);
  const details = parts.join('\n') || 'No part details available.';
  return `Reference part data (input only — do not echo):\n${details}\n\nRespond with the weight-estimate JSON only.`;
}

async function estimateWeight(client, row, attempt = 1) {
  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    max_tokens: 100,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(row) },
    ],
  });

  const raw = response.choices?.[0]?.message?.content;
  if (!raw) throw new Error('empty AI response (no choices)');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`unparseable AI response: ${raw.slice(0, 100)}`);
  }

  const weightKg = Number(parsed.weightKg);
  if (!Number.isFinite(weightKg) || weightKg < MIN_KG || weightKg > MAX_KG) {
    if (attempt < 2) return estimateWeight(client, row, attempt + 1);
    throw new Error(`out-of-bounds weight ${parsed.weightKg} after retry`);
  }

  return {
    weightKg: Math.round(weightKg * 1000) / 1000,
    confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
      ? parsed.confidence
      : 'unknown',
  };
}

async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function main() {
  if (!API_KEY) {
    throw new Error('OPENAI_API_KEY is not set — cannot run (no --dry-run bypass; this always calls the AI).');
  }

  const db = new Pool({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'listingpro',
    max: CONCURRENCY + 2,
  });
  console.log(`Connected to database. Model: ${MODEL} via ${BASE_URL}`);
  console.log(`Mode: ${APPLY ? 'APPLY (writes weight column)' : 'DRY RUN (no writes)'}, status=${STATUSES.join(',')}${LIMIT ? `, limit=${LIMIT}` : ''}`);

  const limitClause = LIMIT ? `LIMIT ${LIMIT}` : '';
  const statusPlaceholders = STATUSES.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await db.query(
    `
    SELECT id, "customLabelSku", title, "cBrand", "cType",
           "cManufacturerPartNumber", "cOeOemPartNumber", "categoryName", weight AS "currentWeight"
    FROM listing_records
    WHERE "deletedAt" IS NULL AND status IN (${statusPlaceholders})
    ORDER BY id
    ${limitClause}
  `,
    STATUSES,
  );
  console.log(`Fetched ${rows.length} listing(s) to process (status: ${STATUSES.join(', ')}).`);

  const aiClient = new OpenAI({
    apiKey: API_KEY,
    baseURL: BASE_URL,
    maxRetries: 1,
    timeout: 30_000,
    defaultHeaders: {
      'HTTP-Referer': 'https://realtrackapp.com',
      'X-Title': 'RealTrackApp',
    },
  });

  const report = {
    model: MODEL,
    mode: APPLY ? 'apply' : 'dry-run',
    startedAt: new Date().toISOString(),
    totalRows: rows.length,
    updated: 0,
    failed: 0,
    confidenceCounts: { high: 0, medium: 0, low: 0, unknown: 0 },
    samples: [],
    failures: [],
  };

  let processed = 0;
  await mapWithConcurrency(rows, CONCURRENCY, async (row) => {
    try {
      const { weightKg, confidence } = await estimateWeight(aiClient, row);
      report.confidenceCounts[confidence] = (report.confidenceCounts[confidence] ?? 0) + 1;

      if (APPLY) {
        await db.query(
          `UPDATE listing_records SET weight = $1, "updatedAt" = NOW() WHERE id = $2`,
          [weightKg, row.id],
        );
      }
      report.updated++;

      if (report.samples.length < 40) {
        report.samples.push({
          sku: row.customLabelSku,
          title: row.title,
          previousWeight: row.currentWeight,
          estimatedWeightKg: weightKg,
          confidence,
        });
      }
    } catch (err) {
      report.failed++;
      report.failures.push({
        id: row.id,
        sku: row.customLabelSku,
        title: row.title,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      processed++;
      if (processed % 250 === 0 || processed === rows.length) {
        console.log(`Progress: ${processed}/${rows.length} (updated=${report.updated}, failed=${report.failed})`);
        // Flush periodically so a killed/crashed run still leaves useful
        // diagnostics instead of losing everything (only writing at the end
        // meant an interrupted run had zero failure detail to inspect).
        writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
      }
    }
  });

  report.finishedAt = new Date().toISOString();
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log('\n=== Summary ===');
  console.log(`Mode: ${report.mode}`);
  console.log(`Total: ${report.totalRows}, Updated: ${report.updated}, Failed: ${report.failed}`);
  console.log(`Confidence: ${JSON.stringify(report.confidenceCounts)}`);
  console.log(`Report written to: ${REPORT_PATH}`);
  if (report.failures.length > 0) {
    console.log(`\nFirst ${Math.min(10, report.failures.length)} failures:`);
    for (const f of report.failures.slice(0, 10)) {
      console.log(`  ${f.sku}: ${f.error}`);
    }
  }

  await db.end();
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
