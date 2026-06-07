#!/usr/bin/env node
/**
 * Offline regression gate for gpt-4.1-mini benchmark artifacts.
 * No API key required — validates cached raw output + listing quality scores.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyListingGuards, validateListing } from '../lib/listing-quality.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const RAW_PATH = path.join(
  ROOT,
  'docs/model-comparison/raw/openai_gpt-4.1-mini.json',
);

const MIN_COMPOSITE = Number(process.env.AI_REGRESSION_MIN_COMPOSITE || 95);
const MIN_PASS_RATE = Number(process.env.AI_REGRESSION_MIN_PASS_RATE || 0.875);

function fail(msg) {
  console.error(`[FAIL] ${msg}`);
  process.exit(1);
}

function main() {
  if (!fs.existsSync(RAW_PATH)) {
    fail(`Missing benchmark artifact: ${RAW_PATH}\nRun: node scripts/model-comparison/run-comparison.mjs only=openai/gpt-4.1-mini`);
  }

  const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));

  if (!raw.ok || !raw.schemaValid) {
    fail(`Benchmark run not ok (ok=${raw.ok}, schemaValid=${raw.schemaValid})`);
  }

  const composite = raw.agg?.composite;
  if (composite == null || composite < MIN_COMPOSITE) {
    fail(`Composite ${composite} below threshold ${MIN_COMPOSITE}`);
  }

  const items = raw.items ?? [];
  if (items.length < 8) {
    fail(`Expected 8 sample items, got ${items.length}`);
  }

  let passed = 0;
  for (const item of items) {
    const srcPart = { partNumber: item.mpn, donorMake: 'mercedes' };
    const { item: guarded } = applyListingGuards(item, srcPart);
    const validation = validateListing(guarded, srcPart);
    if (validation.pass) passed++;
    else {
      console.warn(
        `[warn] item ${item.index} failed gate: ${validation.hardFails.join(', ')}`,
      );
    }
  }

  const passRate = passed / items.length;
  if (passRate < MIN_PASS_RATE) {
    fail(`Pass rate ${(passRate * 100).toFixed(1)}% below ${MIN_PASS_RATE * 100}%`);
  }

  console.log(
    `[OK] gpt-4.1-mini regression: composite=${composite}, passRate=${(passRate * 100).toFixed(1)}%, items=${items.length}`,
  );
}

main();
