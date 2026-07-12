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
/** Once a 429 exhausts retries, stop hitting Taxonomy for this cooldown window
 * instead of halting for the rest of the run — mirrors the backend circuit
 * breaker in EbayTaxonomyApiService (same fix, same root problem: this
 * script used to trip `rateLimitHalted` permanently on one exhausted 429,
 * which is why categoryConcurrency was pinned to 2 — a long-lived batch
 * would otherwise silently fall back to AI/keyword classification for every
 * remaining part the moment eBay throttled once, even after the throttle
 * cleared). */
const RATE_LIMIT_COOLDOWN_MS = 60_000;
/** A cached or freshly-suggested category can go stale if eBay restructures
 * its tree after the suggestion was cached (90-day TTL) — same class of bug
 * as the hardcoded "Exterior Mirrors" category (33726) that silently became
 * "Transmission & Drivetrain" and broke publish for two listings. Verified
 * per categoryId for the life of the process before trusting any result. */
const LEAF_CHECK_TTL_MS = 24 * 60 * 60 * 1000;

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
  const leafCache = new Map(); // categoryId -> { isLeaf, checkedAt }

  const stats = {
    suggestionCacheHits: 0,
    suggestionApiCalls: 0,
    suggestionApiErrors: 0,
    dailyQuotaSkipped: 0,
    aspectCacheHits: 0,
    aspectApiCalls: 0,
    rateLimitHaltUntil: 0,
    staleCategoryDrops: 0,
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

  function getCachedSuggestion(query, treeId = MOTORS_CATEGORY_TREE_ID) {
    const key = `${treeId}::${normQuery(query)}`;
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

  function setCachedSuggestion(query, result, treeId = MOTORS_CATEGORY_TREE_ID) {
    const key = `${treeId}::${normQuery(query)}`;
    if (!normQuery(query)) return;
    memoryCache.set(key, result);
    scope().suggestions[key] = { result, cachedAt: Date.now() };
    persistDisk();
  }

  function getCachedAspects(categoryId, treeId = MOTORS_CATEGORY_TREE_ID) {
    const key = `${treeId}::${categoryId}`;
    const entry = scope().aspects[key];
    if (!entry) return undefined;
    if (Date.now() - entry.cachedAt > SUGGESTION_TTL_MS) {
      delete scope().aspects[key];
      return undefined;
    }
    return entry.aspects;
  }

  function setCachedAspects(categoryId, aspects, treeId = MOTORS_CATEGORY_TREE_ID) {
    const key = `${treeId}::${categoryId}`;
    scope().aspects[key] = { aspects, cachedAt: Date.now() };
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
          if (status === 429) {
            stats.rateLimitHaltUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
            log(
              'warn',
              `eBay Taxonomy circuit opened for ${RATE_LIMIT_COOLDOWN_MS}ms after exhausting retries on ${label}`,
            );
          }
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

  /** Verify a category is still a real, currently-publishable leaf on eBay's
   * live tree before trusting it (fresh suggestion or from the 90-day disk
   * cache) — categories can be restructured by eBay after being cached. A
   * lookup failure doesn't block on an unrelated hiccup; it assumes leaf. */
  async function isCurrentLeafCategory(categoryId, treeId) {
    if (!categoryId) return false;
    const cached = leafCache.get(categoryId);
    if (cached && Date.now() - cached.checkedAt < LEAF_CHECK_TTL_MS) {
      return cached.isLeaf;
    }
    try {
      const token = await getToken();
      if (!token) return true;
      const { data } = await withRetry(`leaf-check(${categoryId})`, () =>
        axios.get(
          `${baseUrl}/commerce/taxonomy/v1/category_tree/${treeId}/get_category_subtree`,
          {
            params: { category_id: categoryId },
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15_000,
          },
        ),
      );
      const isLeaf = Boolean(data?.categorySubtreeNode?.leafCategoryTreeNode);
      leafCache.set(categoryId, { isLeaf, checkedAt: Date.now() });
      return isLeaf;
    } catch {
      return true;
    }
  }

  async function suggestCategory(keywords, treeId = MOTORS_CATEGORY_TREE_ID) {
    if (Date.now() < stats.rateLimitHaltUntil) return null;

    const cached = getCachedSuggestion(keywords, treeId);
    if (cached !== undefined) {
      if (cached === null || (await isCurrentLeafCategory(cached.categoryId, treeId))) {
        stats.suggestionCacheHits++;
        return cached;
      }
      // Cached result has drifted off leaf status since it was saved (eBay
      // restructured the tree) — drop it and re-resolve fresh below instead
      // of trusting a suggestion that will fail publish with "not a leaf
      // category".
      stats.staleCategoryDrops++;
      log(
        'warn',
        `Cached category ${cached.categoryId} for "${keywords.slice(0, 40)}" is no longer a leaf — re-resolving`,
      );
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
          `${baseUrl}/commerce/taxonomy/v1/category_tree/${treeId}/get_category_suggestions`,
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
        setCachedSuggestion(keywords, result, treeId);
        return result;
      }

      setCachedSuggestion(keywords, null, treeId);
      return null;
    } catch (err) {
      stats.suggestionApiErrors++;
      throw err;
    }
  }

  async function getCategoryAspects(categoryId, treeId = MOTORS_CATEGORY_TREE_ID) {
    const cached = getCachedAspects(categoryId, treeId);
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
          `${baseUrl}/commerce/taxonomy/v1/category_tree/${treeId}/get_item_aspects_for_category`,
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

      setCachedAspects(categoryId, aspects, treeId);
      return aspects;
    } catch {
      setCachedAspects(categoryId, null, treeId);
      return null;
    }
  }

  return {
    MOTORS_CATEGORY_TREE_ID,
    suggestCategory,
    getCategoryAspects,
    getDailyUsage,
    isRateLimited: () =>
      Date.now() < stats.rateLimitHaltUntil || getDailyUsage() >= dailyQuota,
    getStats: () => ({ ...stats, dailyUsage: getDailyUsage(), dailyQuota }),
    cachePath: fullCachePath,
  };
}
