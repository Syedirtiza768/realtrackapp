/**
 * AI category classifier — OpenRouter batch fallback when eBay Taxonomy is unavailable.
 * Resolves model output to real eBay category IDs via motors-category-catalog.
 */

import fs from 'fs';
import path from 'path';
import { isRateLimitError } from './concurrency-pool.mjs';
import {
  getCategoryNamesForPrompt,
  resolveCategoryByName,
} from './motors-category-catalog.mjs';

const DEFAULT_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 12;
const DEFAULT_MIN_CONFIDENCE = 0.55;
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildSystemPrompt() {
  return `You are an expert in eBay Motors Parts & Accessories taxonomy for US listings.
Given automotive parts, pick the single best leaf category for each part.
Use ONLY category names from this exact list (copy spelling precisely):

${getCategoryNamesForPrompt()}

Rules:
- Prefer the most specific leaf category, not generic "Car & Truck Parts & Accessories".
- Interior door trim → Interior Door Panels & Parts; exterior door skin → Exterior Door Panels & Frames.
- Seat components → Seats; dashboard → Dashboards & Dashboard Parts.
- Return valid JSON only.`;
}

function buildUserPrompt(batch) {
  const items = batch.map((row, index) => ({
    index,
    make: row.make || '',
    partName: row.partName || '',
    note: row.note || '',
  }));
  return `Classify each part. Return JSON:
{
  "items": [
    { "index": 0, "categoryName": "exact name from list", "confidence": 0.0-1.0 }
  ]
}

Parts:
${JSON.stringify(items)}`;
}

function parseJson(content) {
  const trimmed = String(content || '').trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1].trim() : trimmed;
  const direct = JSON.parse(raw);
  const items = Array.isArray(direct) ? direct : (direct.items || direct.results || []);
  return items;
}

/**
 * @param {object} options
 * @param {string} options.rootDir
 * @param {() => import('openai').default | null} options.getOpenAI
 * @param {string} [options.model]
 * @param {number} [options.batchSize]
 * @param {number} [options.minConfidence]
 * @param {(level: string, msg: string) => void} [options.log]
 * @param {(tokens: number, model: string) => void} [options.onTokens]
 */
export function createAiCategoryClassifier(options) {
  const {
    rootDir,
    getOpenAI,
    model = DEFAULT_MODEL,
    batchSize = DEFAULT_BATCH_SIZE,
    minConfidence = DEFAULT_MIN_CONFIDENCE,
    log = () => {},
    onTokens = () => {},
  } = options;

  const cachePath = path.resolve(rootDir, 'config/.ai-category-cache.json');
  let disk = loadDisk();
  const memory = new Map();

  const stats = {
    cacheHits: 0,
    apiCalls: 0,
    apiMapped: 0,
    apiLowConfidence: 0,
    apiErrors: 0,
    tokensUsed: 0,
    model,
  };

  function loadDisk() {
    try {
      if (fs.existsSync(cachePath)) {
        const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        if (parsed?.version === 1) return parsed;
      }
    } catch {
      // ignore
    }
    return { version: 1, entries: {} };
  }

  function persistDisk() {
    try {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(disk, null, 2));
    } catch {
      // non-fatal
    }
  }

  function cacheKey(partKey, modelId) {
    return `${modelId}::${partKey}`;
  }

  function getCached(partKey) {
    const key = cacheKey(partKey, model);
    if (memory.has(key)) return memory.get(key);
    const entry = disk.entries[key];
    if (!entry) return undefined;
    if (Date.now() - entry.cachedAt > DEFAULT_TTL_MS) {
      delete disk.entries[key];
      return undefined;
    }
    memory.set(key, entry.result);
    return entry.result;
  }

  function setCached(partKey, result) {
    const key = cacheKey(partKey, model);
    memory.set(key, result);
    disk.entries[key] = { result, cachedAt: Date.now(), model };
    persistDisk();
  }

  async function classifyBatch(batch, maxRetries = 3) {
    const client = getOpenAI();
    if (!client) return null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: buildUserPrompt(batch) },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });

        stats.apiCalls++;
        const usage = response.usage?.total_tokens ?? 0;
        stats.tokensUsed += usage;
        onTokens(usage, model);

        const content = response.choices?.[0]?.message?.content;
        if (!content) throw new Error('Empty AI category response');
        try {
          return parseJson(content);
        } catch {
          throw new Error('AI category response was not valid JSON');
        }
      } catch (err) {
        stats.apiErrors++;
        if (attempt >= maxRetries) {
          log('warn', `AI category batch failed: ${err.message}`);
          return null;
        }
        const delay = isRateLimitError(err) ? attempt * 4000 : attempt * 1500;
        await sleep(delay);
      }
    }
    return null;
  }

  /**
   * Classify unique lookups: { partKey, keywords, parts: [{ partName, note, ... }] }
   * @param {Array} lookups
   * @param {(part) => { make?: string }} getVehicle
   */
  async function classifyLookups(lookups, getVehicle) {
    const results = new Map();
    const pending = [];

    for (const lookup of lookups) {
      const cached = getCached(lookup.partKey);
      if (cached !== undefined) {
        stats.cacheHits++;
        if (cached) results.set(lookup.partKey, cached);
        continue;
      }
      pending.push(lookup);
    }

    if (!pending.length) return results;

    log('info', `AI category mapping: ${pending.length} lookups (${stats.cacheHits} cache hits) model=${model}`);

    for (let i = 0; i < pending.length; i += batchSize) {
      const group = pending.slice(i, i + batchSize);
      const batch = group.map((lookup) => {
        const part = lookup.parts[0];
        const vehicle = getVehicle(part) || {};
        return {
          partKey: lookup.partKey,
          partName: part.partName,
          note: part.note,
          make: vehicle.make || part.brand || '',
        };
      });

      const items = await classifyBatch(batch);
      if (!items) {
        for (const row of group) setCached(row.partKey, null);
        continue;
      }

      for (const row of group) {
        const idx = batch.findIndex((b) => b.partKey === row.partKey);
        const aiItem = items.find((it) => it.index === idx) ?? items[idx];
        const aiName = aiItem?.categoryName;
        const aiConf = Number(aiItem?.confidence ?? 0.7);

        if (!aiName || aiConf < minConfidence) {
          stats.apiLowConfidence++;
          setCached(row.partKey, null);
          continue;
        }

        const resolved = resolveCategoryByName(aiName, minConfidence);
        if (!resolved) {
          stats.apiLowConfidence++;
          setCached(row.partKey, null);
          continue;
        }

        const category = {
          categoryId: resolved.categoryId,
          categoryName: resolved.categoryName,
          categoryPath: '',
          source: 'ai',
          aiConfidence: Math.min(aiConf, resolved.confidence),
          aiModel: model,
        };
        stats.apiMapped++;
        setCached(row.partKey, category);
        results.set(row.partKey, category);
      }
    }

    return results;
  }

  return {
    classifyLookups,
    getStats: () => ({ ...stats }),
    cachePath,
    defaultModel: DEFAULT_MODEL,
  };
}

export { DEFAULT_MODEL as AI_CATEGORY_DEFAULT_MODEL };
