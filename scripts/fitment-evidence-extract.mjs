#!/usr/bin/env node
import fs from 'node:fs';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '/app/.env' });

const INPUT = process.env.FITMENT_EVIDENCE_INPUT || '/app/output/ebay-pipeline/napa_exact_catalog_evidence.json';
const OUTPUT = process.env.FITMENT_EVIDENCE_OUTPUT || '/app/output/ebay-pipeline/napa_fitment_evidence_candidates.json';
const STATUS = `${OUTPUT}.status.json`;
const MODEL = 'openai/gpt-5.6-luna-20260709';
const BATCH_SIZE = 6;
const CONCURRENCY = 3;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readState(totalRows) {
  try { return JSON.parse(fs.readFileSync(OUTPUT, 'utf8')); }
  catch { return { model: MODEL, sourceFile: INPUT, totalRows, batches: [], items: {} }; }
}
function save(state) {
  const temp = `${OUTPUT}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(temp, OUTPUT);
  fs.writeFileSync(STATUS, `${JSON.stringify({
    model: MODEL,
    updatedAt: new Date().toISOString(),
    candidateRows: state.totalRows,
    completedRows: Object.keys(state.items).length,
    completedBatches: state.batches.length,
  }, null, 2)}\n`);
}
function extractJson(content) {
  if (typeof content !== 'string') return content || {};
  let text = content.trim();
  const fence = String.fromCharCode(96).repeat(3);
  if (text.startsWith(fence)) text = text.replace(new RegExp(`^${fence}(?:json)?`, 'i'), '').replace(new RegExp(`${fence}$`), '').trim();
  try { return JSON.parse(text); }
  catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch { /* empty response below */ }
    }
    return { items: [] };
  }
}
function evidenceText(item) {
  return (item.fitmentEvidence ?? []).slice(0, 3).map((evidence) => [
    `eBay item ${evidence.itemId}`,
    evidence.title,
    evidence.shortDescription,
    evidence.description,
  ].filter(Boolean).join('\n')).join('\n---\n').slice(0, 24_000);
}
async function call(batch) {
  const products = batch.map((item) => ({
    index: item.index,
    sku: item.sku,
    brand: item.brand,
    mpn: item.mpn,
    partType: item.partType,
    evidence: evidenceText(item),
    evidenceItemIds: (item.fitmentEvidence ?? []).map((evidence) => evidence.itemId),
  }));
  const prompt = [
    'Extract automotive vehicle fitment from exact-brand, exact-MPN eBay listing evidence.',
    'Return strict JSON only with this schema:',
    '{"items":[{"index":number,"fitments":[{"make":string,"model":string,"yearStart":number,"yearEnd":number,"generation":string,"position":string,"confidence":number,"basis":string,"evidenceItemId":string}]}]}',
    'Only return a fitment when the supplied evidence explicitly associates that make, model, and year or year range with the exact part. Do not infer platform siblings, engines, trims, generations, or positions that the evidence does not state. Convert abbreviated end years such as 1999-04 to 2004. Keep canonical US model names. If the evidence contains no explicit vehicle application, return an empty fitments array. Combine duplicate or overlapping ranges for the same make and model. Maximum 30 fitments per product.',
    `Products: ${JSON.stringify(products)}`,
  ].join('\n');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: MODEL,
        messages: [
          { role: 'system', content: 'You extract only explicitly stated automotive fitment and return strict JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      }, {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://app.omnicoreholding.com',
          'X-Title': 'Catalog evidence fitment extraction',
        },
        timeout: 180_000,
      });
      return extractJson(response.data.choices?.[0]?.message?.content || '{}');
    } catch (error) {
      const status = error?.response?.status;
      if (status === 429 || status >= 500) { await sleep(2500 * (attempt + 1)); continue; }
      console.error('[fitment-evidence-batch-error]', status, error?.response?.data?.error?.message || error.message);
      return { items: [] };
    }
  }
  return { items: [] };
}

async function main() {
  const evidence = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
  const candidates = Object.values(evidence.items ?? {})
    .filter((item) => item.status === 'exact_match' && item.fitmentEvidence?.some((entry) => entry.textEvidenceScore > 0))
    .sort((a, b) => a.index - b.index);
  const state = readState(candidates.length);
  state.model = MODEL;
  state.totalRows = candidates.length;
  const batches = [];
  for (let index = 0; index < candidates.length; index += BATCH_SIZE) {
    const batch = candidates.slice(index, index + BATCH_SIZE);
    if (batch.every((item) => state.items[String(item.index)] !== undefined)) continue;
    batches.push(batch);
  }
  let cursor = 0;
  let completed = Object.keys(state.items).length;
  async function worker() {
    while (true) {
      const batchIndex = cursor++;
      if (batchIndex >= batches.length) return;
      const batch = batches[batchIndex];
      const output = await call(batch);
      const byIndex = new Map((Array.isArray(output.items) ? output.items : []).map((item) => [Number(item.index), item]));
      for (const product of batch) {
        const extracted = byIndex.get(product.index);
        state.items[String(product.index)] = {
          index: product.index,
          sku: product.sku,
          brand: product.brand,
          mpn: product.mpn,
          partType: product.partType,
          fitments: Array.isArray(extracted?.fitments) ? extracted.fitments : [],
          evidenceItemIds: (product.fitmentEvidence ?? []).map((entry) => entry.itemId),
          imageUrls: product.imageUrls ?? [],
          imageEvidenceItemId: product.imageEvidenceItemId || '',
          imageEvidenceUrl: product.imageEvidenceUrl || '',
          model: MODEL,
          processedAt: new Date().toISOString(),
        };
        completed += 1;
      }
      state.batches.push({ indexes: batch.map((item) => item.index), processedAt: new Date().toISOString() });
      save(state);
      console.log(`[fitment-evidence] ${completed}/${candidates.length}`);
      await sleep(250);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  save(state);
  const items = Object.values(state.items);
  console.log(JSON.stringify({
    candidateRows: candidates.length,
    extractedRows: items.filter((item) => item.fitments?.length).length,
    extractedRanges: items.reduce((sum, item) => sum + (item.fitments?.length ?? 0), 0),
    model: MODEL,
    output: OUTPUT,
  }, null, 2));
}

main().catch((error) => { console.error(error?.stack || error); process.exitCode = 1; });
