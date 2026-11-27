// Haiku 5.5 + web search enhancement of missing item specifics and descriptions (2026-11-27).
// Read-only against the database: writes proposals to a JSONL file only.
// Run inside a one-off backend container (the key is read from /app/.env, never printed):
//   node /work/enhance.cjs            (env: ENH_CONCURRENCY, ENH_LIMIT, ENH_OUT)
'use strict';
const fs = require('fs');
const path = require('path');
const { Client } = require('/app/node_modules/pg');
const sdk = require('/work/sdk/node_modules/@anthropic-ai/sdk');
const Anthropic = sdk.default || sdk;

const WORK = '/work';
const MODEL = 'claude-haiku-5-5';
const EFFORT = 'medium';
const CONCURRENCY = Number(process.env.ENH_CONCURRENCY || 6);
const LIMIT = Number(process.env.ENH_LIMIT || 0);
const OUT = path.join(WORK, process.env.ENH_OUT || 'enh_results.jsonl');

const SYSTEM = [
  'You prepare eBay listing data for a seller of pre-owned fashion. You receive one item as JSON: its SKU, catalogue title, the eBay title it is listed under (may be absent), brand, category, condition label, the attributes already recorded, and the current description.',
  'Method: run one web_search for the brand and the garment named in the title. Run a second search only if the first confirms neither the brand nor the garment type. Use the search results to confirm the brand and item type when the title does not state them.',
  'Rules:',
  "- Every fact must come from the titles, the recorded attributes, the condition label, or a search result you cite in sources. Never add a model name, product line, collection name, fabric, feature, measurement or claim that none of these supports.",
  '- Keep the recorded attributes; never contradict them.',
  '- Condition: use the condition label exactly as supplied. Do not call the item new, brand new, NWT or unworn unless the condition label says New.',
  '- sizeType: only a value the title or recorded attributes state; otherwise null.',
  "- department: only from the title or recorded attributes, or an explicit gender or age word in the title (men's, women's, boys, girls, kids); otherwise null.",
  '- color, style, material, fit: only if the title, recorded attributes or a search result state them; otherwise null.',
  'Return ONLY one JSON object with exactly these keys: brand, department, itemType, size, sizeType, color, style, material, fit, description, confidence, sources, notes.',
  '- brand: null unless the title or a search result confirms it.',
  '- department: one of "Men", "Women", "Boys", "Girls", "Unisex Adults", "Unisex Kids", "Baby", or null.',
  '- itemType: the garment type in plain words, such as "Jeans", "Polo Shirt", "Dress Pants", "T-Shirt", "Hoodie", "Trousers", or null.',
  '- size: the label size as printed in the title (e.g. "34", "XL", "10"), or null.',
  '- sizeType: "Regular", "Slim", "Tall", "Petite", "Plus", "Big & Tall", or null.',
  '- description: plain text, 2 to 4 sentences, 250 to 600 characters, written as natural seller copy. Name the brand, department, item type, colour and size where known, and the fit or style if the title or a source states it. Never mention the listing, the title, the recorded attributes, the records or the sources, and never write a condition sentence (it is added separately). No measurements, fabric claims, care instructions, defects, filler or marketing puffery. No HTML, lists or emojis. Do not use the words "authentic", "genuine" or "guaranteed".',
  '- confidence: "high" when the title names the brand and garment and everything in the output is supported; otherwise "medium" or "low".',
  '- sources: URLs from the search results you relied on (empty array if none).',
  '- notes: a short reason when confidence is not "high", otherwise "".',
  'Output the JSON object and nothing else.',
].join('\n');

function readApiKey() {
  const env = fs.readFileSync('/app/.env', 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.*)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('ANTHROPIC_API_KEY is not set in /app/.env');
}

function parseJsonObject(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch (e) { return null; }
}

function inputFor(row, ebayTitle) {
  const va = row.vertical_attributes || {};
  const existing = {};
  for (const [k, v] of Object.entries(va)) {
    if (k.startsWith('_')) continue;
    const s = Array.isArray(v) ? v.join(' | ') : (v == null ? '' : String(v));
    if (s.trim()) existing[k] = s.trim();
  }
  return {
    sku: row.sku,
    title: row.title,
    listing_title_on_ebay: ebayTitle || null,
    brand: row.brand || null,
    category: row.category_name || null,
    condition: row.condition_label || null,
    existing_attributes: existing,
    existing_description: (row.description || '').trim() || null,
  };
}

async function enhanceOne(client, input) {
  const messages = [{ role: 'user', content: JSON.stringify(input) }];
  const usage = { input: 0, output: 0, searches: 0 };
  for (let turn = 0; turn < 4; turn++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      output_config: { effort: EFFORT },
      system: SYSTEM,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
      messages,
    });
    usage.input += res.usage.input_tokens || 0;
    usage.output += res.usage.output_tokens || 0;
    usage.searches += (res.usage.server_tool_use && res.usage.server_tool_use.web_search_requests) || 0;
    if (res.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: res.content });
      continue;
    }
    if (res.stop_reason === 'refusal') return { ok: false, error: 'refusal', usage };
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    const json = parseJsonObject(text);
    return json
      ? { ok: true, json, usage, stop: res.stop_reason }
      : { ok: false, error: 'unparseable output', text: text.slice(0, 400), usage, stop: res.stop_reason };
  }
  return { ok: false, error: 'too many pause_turn continuations', usage };
}

async function main() {
  const client = new Anthropic({ apiKey: readApiKey(), maxRetries: 4, timeout: 180000 });
  const skus = fs.readFileSync(path.join(WORK, 'enh_skus.txt'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const done = new Set();
  if (fs.existsSync(OUT)) {
    for (const line of fs.readFileSync(OUT, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { const r = JSON.parse(line); if (r.ok) done.add(r.sku); } catch (e) { /* skip torn line */ }
    }
  }
  const db = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  await db.connect();
  const { rows } = await db.query(
    'SELECT id, sku, title, brand, category_id, category_name, condition_label, vertical_attributes, description FROM catalog_products WHERE sku = ANY($1)',
    [skus],
  );
  await db.end();
  const bySku = new Map(rows.map((r) => [r.sku, r]));
  const ebayTitles = JSON.parse(fs.readFileSync(path.join(WORK, 'ebay_titles.json'), 'utf8'));
  let todo = skus.filter((s) => bySku.has(s) && !done.has(s));
  if (LIMIT) todo = todo.slice(0, LIMIT);
  console.log(`scope ${skus.length}, in catalog ${bySku.size}, already done ${done.size}, to run ${todo.length}, concurrency ${CONCURRENCY}, model ${MODEL} effort ${EFFORT}`);

  const total = { input: 0, output: 0, searches: 0, ok: 0, failed: 0 };
  let idx = 0;
  async function worker() {
    while (idx < todo.length) {
      const sku = todo[idx++];
      const row = bySku.get(sku);
      let rec;
      try {
        const r = await enhanceOne(client, inputFor(row, ebayTitles[sku]));
        rec = { sku, id: row.id, ok: r.ok, result: r.json || null, text: r.text || null, error: r.error || null, usage: r.usage, at: new Date().toISOString() };
      } catch (e) {
        rec = { sku, id: row.id, ok: false, result: null, error: String((e && e.message) || e).slice(0, 300), usage: null, at: new Date().toISOString() };
      }
      fs.appendFileSync(OUT, JSON.stringify(rec) + '\n');
      if (rec.usage) { total.input += rec.usage.input; total.output += rec.usage.output; total.searches += rec.usage.searches; }
      if (rec.ok) total.ok++; else total.failed++;
      const n = total.ok + total.failed;
      if (n % 25 === 0 || n === todo.length) console.log(`progress ${n}/${todo.length} ok ${total.ok} failed ${total.failed} tokens in ${total.input} out ${total.output} searches ${total.searches}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log('finished', JSON.stringify(total));
}

main().catch((e) => { console.error('fatal:', e && e.message); process.exit(1); });
