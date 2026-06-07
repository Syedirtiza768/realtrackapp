import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', '..', 'docs', 'model-comparison');
const RAW = path.join(OUT, 'raw');

const ORDER = [
  'minimax/minimax-m3',
  'openai/gpt-4o-mini',
  'openai/gpt-4.1-mini',
  'google/gemini-2.5-flash',
  'anthropic/claude-3.5-haiku',
  'deepseek/deepseek-chat-v3-0324',
  'meta-llama/llama-3.3-70b-instruct',
  'amazon/nova-lite-v1',
];

const results = [];
for (const model of ORDER) {
  const slug = model.replace(/[\/:]/g, '_');
  const f = path.join(RAW, slug + '.json');
  if (!fs.existsSync(f)) continue;
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  results.push({
    model: r.model, ok: r.ok, latencyMs: r.latencyMs, attempts: r.attempts,
    promptTokens: r.promptTokens, completionTokens: r.completionTokens, totalTokens: r.totalTokens,
    costUsd: r.costUsd, inputPerM: r.inputPerM, outputPerM: r.outputPerM,
    schemaValid: r.schemaValid, schemaRepaired: r.schemaRepaired, itemCount: r.itemCount,
    agg: r.agg, parseError: r.parseError,
  });
}
const prior = JSON.parse(fs.readFileSync(path.join(OUT, 'metrics-summary.json'), 'utf8'));
fs.writeFileSync(path.join(OUT, 'metrics-summary.json'),
  JSON.stringify({ vehicle: prior.vehicle, sampleSize: prior.sampleSize, generatedAt: new Date().toISOString(), results }, null, 2));
console.log('Rebuilt metrics-summary.json from', results.length, 'raw files');
for (const r of results) console.log(`${r.model.padEnd(40)} ok=${r.ok} composite=${r.agg?.composite ?? '-'} $${r.costUsd?.toFixed(5)} ${r.latencyMs}ms`);
