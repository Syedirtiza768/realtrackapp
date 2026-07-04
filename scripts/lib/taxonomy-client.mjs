/**
 * eBay Taxonomy API client for the enrichment pipeline.
 *
 * - Persistent disk cache for category suggestions (survives runs / deploys)
 * - Token-bucket rate limiting (default 2 req/s — eBay Tier-1 daily cap is 5,000)
 * - Per-request 429 retry with Retry-After / exponential backoff
 * - Daily quota budget so inventory + pipeline share headroom
 * - Known Motors tree ID — no extra API call to resolve the tree
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';

/** EBAY_MOTORS_US shares the US Motors P&A tree (verified live). */
export const MOTORS_CATEGORY_TREE_ID = '0';

const DEFAULT_RPS = 2;
const DEFAULT_DAILY_QUOTA = 4800;
const SUGGESTION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const RETRY_DELAYS_MS = [2000, 5000, 12_000, 30_000, 60_000];
const MAX_RETRIES = 5;

class TokenBucket {
  constructor(maxPerSecond) {
    this.maxTokens = maxPerSecond;
    this.tokens = maxPerSecond;
    this.refillRate = maxPerSecond / 1000;
    this.lastRefill = Date.now();
  }

  async acquire() {
    this.#refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await sleep(waitMs);
    this.#refill();
    this.tokens -= 1;
  }

  #refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normQuery(q) {
  return String(q || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseRetryAfterMs(err) {
  const header = err?.response?.headers?.['retry-after'];
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return null;
}

/**
 * @param {object} options
 * @param {string} options.rootDir
 * @param {string} options.cachePath - relative to rootDir
 * @param {string} options.scopeKey - marketplace + environment
 * @param {() => Promise<string|null>} options.getToken
 * @param {string} options.baseUrl
 * @param {number} [options.requestsPerSecond]
 * @param {number} [options.dailyQuota]
 * @param {(level: string, msg: string) => void} [options.log]
 */
export function createTaxonomyClient(options) {
  const {
    rootDir,
    cachePath = 'config/.ebay-taxonomy-suggestions-cache.json',
    scopeKey,
    getToken,
    baseUrl,
    requestsPerSecond = DEFAULT_RPS,
    dailyQuota = DEFAULT_DAILY_QUOTA,
    log = () => {},
  } = options;

  const fullCachePath = path.resolve(rootDir, cachePath);
  const rateLimiter = new TokenBucket(requestsPerSecond);
  const memoryCache = new Map();

  const stats = {
    suggestionCacheHits: 0,
    suggestionApiCalls: 0,
    suggestionApiErrors: 0,
    dailyQuotaSkipped: 0,
    aspectCacheHits: 0,
    aspectApiCalls: 0,
    rateLimitHalted: false,
  };

  let disk = loadDisk();

  function loadDisk() {
    try {
      if (fs.existsSync(fullCachePath)) {
        const parsed = JSON.parse(fs.readFileSync(fullCachePath, 'utf8'));
        if (parsed?.version === 2) return parsed;
      }
    } catch {
      // ignore
    }
    return { version: 2, scopes: {} };
  }

  function persistDisk() {
    try {
      fs.mkdirSync(path.dirname(fullCachePath), { recursive: true });
      fs.writeFileSync(fullCachePath, JSON.stringify(disk, null, 2));
    } catch {
      // non-fatal
    }
  }

  function scope() {
    if (!disk.scopes[scopeKey]) {
      disk.scopes[scopeKey] = {
        suggestions: {},
        aspects: {},
        dailyUsage: {},
      };
    }
    return disk.scopes[scopeKey];
  }

  function getDailyUsage() {
    const s = scope();
    const day = todayKey();
    return s.dailyUsage[day] ?? 0;
  }

  function incrementDailyUsage() {
    const s = scope();
    const day = todayKey();
    s.dailyUsage[day] = (s.dailyUsage[day] ?? 0) + 1;
    // Prune old days
    for (const k of Object.keys(s.dailyUsage)) {
      if (k < day) delete s.dailyUsage[k];
    }
    persistDisk();
  }

  function getCachedSuggestion(query) {
    const key = `${MOTORS_CATEGORY_TREE_ID}::${normQuery(query)}`;
    if (!normQuery(query)) return undefined;

    if (memoryCache.has(key)) return memoryCache.get(key);

    const entry = scope().suggestions[key];
    if (!entry) return undefined;
    if (Date.now() - entry.cachedAt > SUGGESTION_TTL_MS) {
      delete scope().suggestions[key];
      return undefined;
    }
    memoryCache.set(key, entry.result);
    return entry.result;
  }

  function setCachedSuggestion(query, result) {
    const key = `${MOTORS_CATEGORY_TREE_ID}::${normQuery(query)}`;
    if (!normQuery(query)) return;
    memoryCache.set(key, result);
    scope().suggestions[key] = { result, cachedAt: Date.now() };
    persistDisk();
  }

  function getCachedAspects(categoryId) {
    const entry = scope().aspects[categoryId];
    if (!entry) return undefined;
    if (Date.now() - entry.cachedAt > SUGGESTION_TTL_MS) {
      delete scope().aspects[categoryId];
      return undefined;
    }
    return entry.aspects;
  }

  function setCachedAspects(categoryId, aspects) {
    scope().aspects[categoryId] = { aspects, cachedAt: Date.now() };
    persistDisk();
  }

  async function withRetry(label, fn) {
    let lastErr;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await rateLimiter.acquire();
        return await fn();
      } catch (err) {
        lastErr = err;
        const status = err?.response?.status;
        if (status !== 429 || attempt >= MAX_RETRIES - 1) {
          if (status === 429) stats.rateLimitHalted = true;
          throw err;
        }
        const retryAfter = parseRetryAfterMs(err);
        const wait = retryAfter ?? RETRY_DELAYS_MS[attempt] ?? 25_000;
        log('warn', `eBay Taxonomy ${label} rate-limited — retry ${attempt + 1}/${MAX_RETRIES - 1} in ${wait}ms`);
        await sleep(wait);
      }
    }
    throw lastErr;
  }

  async function suggestCategory(keywords) {
    if (stats.rateLimitHalted) return null;

    const cached = getCachedSuggestion(keywords);
    if (cached !== undefined) {
      stats.suggestionCacheHits++;
      return cached;
    }

    if (getDailyUsage() >= dailyQuota) {
      stats.dailyQuotaSkipped++;
      return null;
    }

    const token = await getToken();
    if (!token) return null;

    try {
      const { data } = await withRetry(`suggest("${keywords.slice(0, 40)}")`, () =>
        axios.get(
          `${baseUrl}/commerce/taxonomy/v1/category_tree/${MOTORS_CATEGORY_TREE_ID}/get_category_suggestions`,
          {
            params: { q: keywords },
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15_000,
          },
        ),
      );

      incrementDailyUsage();
      stats.suggestionApiCalls++;

      const suggestions = data.categorySuggestions || [];
      if (suggestions.length > 0) {
        const best = suggestions[0];
        const result = {
          categoryId: best.category?.categoryId,
          categoryName: best.category?.categoryName,
          categoryPath:
            best.categoryTreeNodeAncestors?.map((a) => a.categoryName).join(' > ') || '',
        };
        setCachedSuggestion(keywords, result);
        return result;
      }

      setCachedSuggestion(keywords, null);
      return null;
    } catch (err) {
      stats.suggestionApiErrors++;
      throw err;
    }
  }

  async function getCategoryAspects(categoryId) {
    const cached = getCachedAspects(categoryId);
    if (cached !== undefined) {
      stats.aspectCacheHits++;
      return cached;
    }

    if (getDailyUsage() >= dailyQuota) return null;

    const token = await getToken();
    if (!token) return null;

    try {
      const { data } = await withRetry(`aspects(${categoryId})`, () =>
        axios.get(
          `${baseUrl}/commerce/taxonomy/v1/category_tree/${MOTORS_CATEGORY_TREE_ID}/get_item_aspects_for_category`,
          {
            params: { category_id: categoryId },
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15_000,
          },
        ),
      );

      incrementDailyUsage();
      stats.aspectApiCalls++;

      const aspects = (data.aspects || []).map((a) => ({
        name: a.localizedAspectName,
        required: a.aspectConstraint?.aspectRequired || false,
        mode: a.aspectConstraint?.aspectMode || 'FREE_TEXT',
        values: (a.aspectValues || []).map((v) => v.localizedValue),
        usage: a.aspectConstraint?.aspectUsage || 'RECOMMENDED',
      }));

      setCachedAspects(categoryId, aspects);
      return aspects;
    } catch {
      setCachedAspects(categoryId, null);
      return null;
    }
  }

  return {
    MOTORS_CATEGORY_TREE_ID,
    suggestCategory,
    getCategoryAspects,
    getDailyUsage,
    isRateLimited: () => stats.rateLimitHalted || getDailyUsage() >= dailyQuota,
    getStats: () => ({ ...stats, dailyUsage: getDailyUsage(), dailyQuota }),
    cachePath: fullCachePath,
  };
}
