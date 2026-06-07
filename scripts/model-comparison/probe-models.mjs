import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

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

// Candidate models to consider for the comparison (across price/quality tiers).
const CANDIDATES = [
  'minimax/minimax-m3',
  'minimaxai/minimax-m1',
  'minimax/minimax-01',
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'openai/gpt-4.1-mini',
  'openai/gpt-4.1',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3.5-haiku',
  'google/gemini-2.0-flash-001',
  'google/gemini-flash-1.5',
  'google/gemini-2.5-flash',
  'meta-llama/llama-3.3-70b-instruct',
  'qwen/qwen-2.5-72b-instruct',
  'qwen/qwen3-235b-a22b',
  'deepseek/deepseek-chat',
  'deepseek/deepseek-chat-v3-0324',
  'mistralai/mistral-small-3.1-24b-instruct',
  'amazon/nova-lite-v1',
];

async function main() {
  console.log('KEY present:', !!KEY, KEY ? `(len ${KEY.length})` : '');
  const { data } = await axios.get(`${BASE}/models`, {
    headers: { Authorization: `Bearer ${KEY}` },
    timeout: 30000,
  });
  const models = data.data || [];
  console.log('Total models in catalog:', models.length);

  const byId = new Map(models.map((m) => [m.id, m]));
  console.log('\n=== Candidate availability + pricing ($/1M tokens) ===');
  const rows = [];
  for (const id of CANDIDATES) {
    const m = byId.get(id);
    if (!m) {
      console.log(`MISSING  ${id}`);
      continue;
    }
    const inP = Number(m.pricing?.prompt) * 1_000_000;
    const outP = Number(m.pricing?.completion) * 1_000_000;
    const ctx = m.context_length;
    console.log(`OK       ${id.padEnd(42)} in=$${inP.toFixed(3)}  out=$${outP.toFixed(3)}  ctx=${ctx}`);
    rows.push({ id, inputPerM: inP, outputPerM: outP, contextLength: ctx, name: m.name });
  }

  // Also dump any minimax / gpt / gemini / claude / deepseek matches to discover valid slugs
  console.log('\n=== Catalog slugs matching key families ===');
  for (const fam of ['minimax', 'gpt-4', 'gemini-2', 'claude-3.5', 'claude-haiku', 'deepseek', 'llama-3.3', 'qwen']) {
    const matches = models.filter((m) => m.id.toLowerCase().includes(fam)).map((m) => m.id);
    console.log(`${fam}: ${matches.slice(0, 12).join(', ')}`);
  }

  fs.writeFileSync(
    path.join(__dirname, 'catalog-pricing.json'),
    JSON.stringify(rows, null, 2),
  );
  console.log('\nWrote catalog-pricing.json');
}
main().catch((e) => {
  console.error('ERROR', e.response?.status, e.response?.data || e.message);
  process.exit(1);
});
