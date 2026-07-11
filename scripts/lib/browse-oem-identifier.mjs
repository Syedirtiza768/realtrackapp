/**
 * eBay Browse OEM part identifier for the enrichment pipeline.
 *
 * Anchors a row's part identity to eBay's live catalog: searches the OEM/MPN
 * part number on the Browse API and derives the authoritative part Type and leaf
 * category by AGREEMENT across live listings — instead of trusting the noisy
 * supplier description. This is the identity truth-gate, analogous to how the
 * MVL store gates fitment.
 *
 * - Application-token auth (same client_credentials token as the Taxonomy client)
 * - Token-bucket rate limiting + 429 retry with backoff
 * - Persistent disk cache keyed by normalized part number (survives runs)
 * - Per-run daily-call cap so Browse + Taxonomy share Tier-1 headroom
 *
 * identify(partNumber) resolves { type, categoryId, categoryName, confidence,
 * matchCount } where confidence is 'high' only when >= minAgreement live
 * listings share the same leaf category. Returns { confidence: 'none' } when the
 * number cannot be confidently anchored (caller then keeps the existing path).
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';

const DEFAULT_RPS = 2;
const DEFAULT_DAILY_CAP = 4000;
const DEFAULT_SEARCH_LIMIT = 15;
const DEFAULT_ITEM_FETCH = 3;
const DEFAULT_MIN_AGREEMENT = 2;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RETRY_DELAYS_MS = [1500, 4000, 10_000];
const MAX_RETRIES = 3;

/** Aspect names live listings use for the component identity. */
const TYPE_ASPECT_NAMES = ['type', 'part type', 'parts type', 'item type', 'product type'];

class TokenBucket {
  constructor(maxPerSecond) {
    this.maxTokens = maxPerSecond;
    this.tokens = maxPerSecond;
    this.refillRate = maxPerSecond / 1000;
    this.lastRefill = Date.now();
  }
  async acquire() {
    this.#refill();
    if (this.tokens >= 1) { this.tokens -= 1; return; }
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await sleep(waitMs);
    this.#refill();
    this.tokens -= 1;
  }
  #refill() {
    const now = Date.now();
    this.tokens = Math.min(this.maxTokens, this.tokens + (now - this.lastRefill) * this.refillRate);
    this.lastRefill = now;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Normalize a part number for cache keys / comparison (case + separators). */
function normPn(pn) {
  return String(pn || '').toUpperCase().replace(/[\s\-_.\/\\]+/g, '');
}

function parseRetryAfterMs(err) {
  const header = err?.response?.headers?.['retry-after'];
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  }
  return null;
}

/**
 * @param {object} options
 * @param {string} options.rootDir
 * @param {() => Promise<string|null>} options.getToken
 * @param {string} options.baseUrl                  eBay API base (prod or sandbox)
 * @param {string} [options.marketplaceId]          X-EBAY-C-MARKETPLACE-ID (default EBAY_US)
 * @param {number} [options.requestsPerSecond]
 * @param {number} [options.dailyCap]               max Browse calls per run
 * @param {number} [options.searchLimit]
 * @param {number} [options.itemFetch]              max item detail fetches per number
 * @param {number} [options.minAgreement]           listings that must share a leaf to trust it
 * @param {string} [options.cachePath]              relative to rootDir
 * @param {(level: string, msg: string) => void} [options.log]
 */
export function createOemIdentifier(options) {
  const {
    rootDir,
    getToken,
    baseUrl,
    marketplaceId = 'EBAY_US',
    requestsPerSecond = DEFAULT_RPS,
    dailyCap = DEFAULT_DAILY_CAP,
    searchLimit = DEFAULT_SEARCH_LIMIT,
    itemFetch = DEFAULT_ITEM_FETCH,
    minAgreement = DEFAULT_MIN_AGREEMENT,
    cachePath = 'config/.ebay-oem-identity-cache.json',
    log = () => {},
  } = options;

  const bucket = new TokenBucket(requestsPerSecond);
  const cacheFile = path.resolve(rootDir, cachePath);
  const http = axios.create({ baseURL: `${baseUrl}/buy/browse/v1`, timeout: 20_000 });
  let cache = {};
  const stats = { calls: 0, cacheHits: 0, identified: 0, lowConfidence: 0, errors: 0, capped: false };

  try {
    if (fs.existsSync(cacheFile)) cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  } catch { cache = {}; }

  function persist() {
    try {
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(cache));
    } catch { /* non-fatal */ }
  }

  async function request(pathname, params) {
    const token = await getToken();
    if (!token) throw new Error('No eBay application token');
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await bucket.acquire();
      try {
        stats.calls++;
        const { data } = await http.get(pathname, {
          params,
          headers: {
            Authorization: `Bearer ${token}`,
            'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
            Accept: 'application/json',
          },
        });
        return data;
      } catch (err) {
        const status = err?.response?.status;
        if (status === 429 && attempt < MAX_RETRIES) {
          const wait = parseRetryAfterMs(err) ?? RETRY_DELAYS_MS[attempt] ?? 10_000;
          log('warn', `Browse 429 — retrying in ${wait}ms`);
          await sleep(wait);
          continue;
        }
        throw err;
      }
    }
    throw new Error('Browse request exhausted retries');
  }

  /** Majority-vote a leaf category across item summaries. */
  function topCategory(summaries) {
    const tally = new Map();
    for (const s of summaries) {
      const cat = Array.isArray(s.categories) ? s.categories[0] : null;
      const id = cat?.categoryId ? String(cat.categoryId) : null;
      if (!id) continue;
      const entry = tally.get(id) ?? { count: 0, name: cat.categoryName || '' };
      entry.count++;
      if (!entry.name && cat.categoryName) entry.name = cat.categoryName;
      tally.set(id, entry);
    }
    let best = null;
    for (const [id, entry] of tally) {
      if (!best || entry.count > best.count) best = { categoryId: id, categoryName: entry.name, count: entry.count };
    }
    return best;
  }

  /** Top Type value from the Browse ASPECT_REFINEMENTS histogram (gated by minCount). */
  function topTypeFromRefinements(aspectDist, minCount) {
    if (!Array.isArray(aspectDist)) return null;
    const typeAspect = aspectDist.find((a) =>
      TYPE_ASPECT_NAMES.includes(String(a?.localizedAspectName || '').toLowerCase()),
    );
    const values =
      typeAspect && Array.isArray(typeAspect.aspectValueDistributions)
        ? typeAspect.aspectValueDistributions
        : [];
    let best = null;
    for (const v of values) {
      const value = v?.localizedAspectValue ? String(v.localizedAspectValue).trim() : '';
      if (!value || value.length > 60) continue;
      const count = Number(v?.matchCount) || 0;
      if (!best || count > best.count) best = { value, count };
    }
    if (!best || best.count < minCount) return null;
    return best.value;
  }

  return {
    /**
     * @param {string} partNumber
     * @returns {Promise<{ type: string|null, categoryId: string|null, categoryName: string|null, confidence: 'high'|'none', matchCount: number } | null>}
     */
    async identify(partNumber) {
      const key = normPn(partNumber);
      // Too short / non-specific to be a real OEM number — skip.
      if (key.length < 5) return null;

      if (Object.prototype.hasOwnProperty.call(cache, key)) {
        const hit = cache[key];
        if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) {
          stats.cacheHits++;
          return hit.result;
        }
      }

      if (stats.calls >= dailyCap) {
        if (!stats.capped) {
          stats.capped = true;
          log('warn', `Browse OEM identify hit per-run cap (${dailyCap}) — remaining numbers use existing path`);
        }
        return null;
      }

      try {
        // Single call: ASPECT_REFINEMENTS returns the Type histogram over ALL
        // matching listings — no per-item detail fetches, stronger than sampling
        // the top few items.
        const search = await request('/item_summary/search', {
          q: String(partNumber).trim(),
          limit: searchLimit,
          // MATCHING_ITEMS keeps the item summaries (for the leaf category);
          // ASPECT_REFINEMENTS adds the Type histogram. fieldgroups replaces the
          // default, so MATCHING_ITEMS must be listed explicitly.
          fieldgroups: 'MATCHING_ITEMS,ASPECT_REFINEMENTS',
        });
        const summaries = Array.isArray(search?.itemSummaries) ? search.itemSummaries : [];
        const refinement = search?.refinement ?? {};
        const matchCount =
          typeof search?.total === 'number' ? search.total : summaries.length;

        // Leaf category = majority of the item summaries' own leaf category.
        // The refinement categoryDistributions histogram only returns broad tree
        // levels ("eBay Motors" root, id 6000) — not the publishable leaf.
        const best = topCategory(summaries);

        if (!best || best.count < minAgreement) {
          const result = { type: null, categoryId: null, categoryName: null, confidence: 'none', matchCount };
          cache[key] = { result, cachedAt: Date.now() };
          persist();
          stats.lowConfidence++;
          return result;
        }

        // Confidence is gated on category agreement above; the Type is then just
        // the most common value in the histogram (top by matchCount, count >= 1).
        const type = topTypeFromRefinements(refinement.aspectDistributions, 1);
        const result = {
          type,
          categoryId: best.categoryId,
          categoryName: best.categoryName || null,
          confidence: 'high',
          matchCount,
        };
        cache[key] = { result, cachedAt: Date.now() };
        persist();
        stats.identified++;
        return result;
      } catch (err) {
        stats.errors++;
        log('warn', `Browse OEM identify failed for "${partNumber}": ${err instanceof Error ? err.message : err}`);
        return null;
      }
    },

    getStats() {
      return { ...stats, cacheEntries: Object.keys(cache).length };
    },
  };
}
