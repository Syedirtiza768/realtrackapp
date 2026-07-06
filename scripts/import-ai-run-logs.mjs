#!/usr/bin/env node
/**
 * Import pipeline ai-run-logs.json into PostgreSQL ai_run_logs.
 *
 * Usage:
 *   node scripts/import-ai-run-logs.mjs
 *   node scripts/import-ai-run-logs.mjs output/ai-run-logs.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const { Client } = require(path.join(ROOT, 'backend/node_modules/pg'));

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

const env = {
  ...loadEnv(path.resolve(ROOT, 'backend/.env')),
  ...loadEnv(path.resolve(ROOT, '.env')),
  ...process.env,
};

const inputPath =
  process.argv[2] || path.resolve(ROOT, 'output/ai-run-logs.json');

if (!fs.existsSync(inputPath)) {
  console.error(`Missing ${inputPath} — run the enrichment pipeline first.`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const logs = Array.isArray(raw) ? raw : raw.logs ?? [];

if (!logs.length) {
  console.error('No log entries found in input file.');
  process.exit(1);
}

const client = new Client({
  host: env.DB_HOST || 'localhost',
  port: Number(env.DB_PORT || 5432),
  user: env.DB_USER || 'postgres',
  password: env.DB_PASSWORD || 'postgres',
  database: env.DB_NAME || 'listingpro',
});

const insertSql = `
  INSERT INTO ai_run_logs (
    sku, part_number, part_type, price, lane, model, attempt,
    prompt_version, routing_policy_version, validation_score,
    hard_fails, soft_fails, escalated, passed_gate, fitment_row_count,
    fitment_source, fitment_rows_pre, fitment_rows_post, tokens_saved_estimate,
    guard_fixes, created_at
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7,
    $8, $9, $10,
    $11::jsonb, $12::jsonb, $13, $14, $15,
    $16, $17, $18, $19,
    $20::jsonb, COALESCE($21::timestamptz, NOW())
  )
`;

async function main() {
  await client.connect();
  let inserted = 0;
  try {
    await client.query('BEGIN');
    for (const row of logs) {
      await client.query(insertSql, [
        row.sku ?? null,
        row.partNumber ?? null,
        row.partType ?? null,
        row.price ?? null,
        row.lane ?? 'default',
        row.model ?? 'unknown',
        row.attempt ?? 1,
        row.promptVersion ?? 'enrichment-v1',
        row.routingPolicyVersion ?? null,
        row.validationScore ?? null,
        JSON.stringify(row.hardFails ?? []),
        JSON.stringify(row.softFails ?? []),
        Boolean(row.escalated),
        Boolean(row.passedGate),
        row.fitmentRowCount ?? null,
        row.fitmentSource ?? null,
        row.fitmentRowsPre ?? null,
        row.fitmentRowsPost ?? null,
        row.tokensSavedEstimate ?? null,
        row.guardFixes?.length ? JSON.stringify(row.guardFixes) : null,
        row.createdAt ?? null,
      ]);
      inserted++;
    }
    await client.query('COMMIT');
    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM ai_run_logs');
    console.log(`Imported ${inserted} rows from ${inputPath}`);
    console.log(`ai_run_logs total: ${rows[0].n}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
