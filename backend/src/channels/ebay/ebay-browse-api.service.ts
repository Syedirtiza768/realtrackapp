import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { EbayAuthService } from './ebay-auth.service.js';
import type {
  EbaySearchResult,
  EbayItemSummary,
  EbayItem,
  EbayCatalogLookupResult,
} from './ebay-api.types.js';

/**
 * Simple token bucket rate limiter (same as EbayTaxonomyApiService).
 */
class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(maxPerSecond: number) {
    this.maxTokens = maxPerSecond;
    this.tokens = maxPerSecond;
    this.refillRate = maxPerSecond / 1000;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await new Promise((r) => setTimeout(r, waitMs));
    this.refill();
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillRate,
    );
    this.lastRefill = now;
  }
}

/**
 * EbayBrowseApiService — Typed client for the eBay Browse API v1.
 *
 * Covers:
 *  - Search items (keyword, category, aspect filter)
 *  - Get item by ID / legacy ID
 *  - Competitive pricing research
 *
 * Uses Application Token (client_credentials) for public search queries.
 * No user-level auth required for read-only browse operations.
 *
 * @see https://developer.ebay.com/api-docs/buy/browse/overview.html
 */
@Injectable()
export class EbayBrowseApiService {
  private readonly logger = new Logger(EbayBrowseApiService.name);
  private readonly http: AxiosInstance;
  private readonly rateLimiter: TokenBucketRateLimiter;

  constructor(private readonly auth: EbayAuthService) {
    const config = this.auth.getApiConfig();
    this.http = axios.create({
      baseURL: `${config.baseUrl}/buy/browse/v1`,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    // Default 2 RPS — same as Taxonomy API
    this.rateLimiter = new TokenBucketRateLimiter(2);
  }

  /** Retry Browse API calls on 429 rate limits with exponential backoff. */
  private async withRateLimitRetry<T>(
    label: string,
    fn: () => Promise<T>,
    maxAttempts = 5,
  ): Promise<T> {
    const delaysMs = [2000, 5000, 12_000, 30_000, 60_000];
    let lastErr: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastErr = err;
        const response = (
          err as {
            response?: { status?: number; headers?: Record<string, string> };
          }
        )?.response;
        const status = response?.status;
        if (status !== 429 || attempt >= maxAttempts - 1) throw err;

        const retryAfterHeader = response?.headers?.['retry-after'];
        let wait = delaysMs[attempt] ?? 25_000;
        if (retryAfterHeader) {
          const seconds = Number(retryAfterHeader);
          if (Number.isFinite(seconds) && seconds > 0) {
            wait = seconds * 1000;
          } else {
            const date = Date.parse(retryAfterHeader);
            if (Number.isFinite(date)) wait = Math.max(0, date - Date.now());
          }
        }

        this.logger.warn(
          `eBay Browse ${label} rate-limited (429) — retry ${attempt + 1}/${maxAttempts - 1} in ${wait}ms`,
        );
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    throw lastErr;
  }

  // ──────────────────────────── helpers ────────────────────────────

  private async appHeaders(): Promise<AxiosRequestConfig> {
    const token = await this.auth.getApplicationToken();
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    };
  }

  // ──────────────────────────── Search ─────────────────────────────

  /**
   * Search for items on eBay.
   */
  async search(options: {
    q?: string;
    categoryIds?: string;
    filter?: string;
    sort?: string;
    limit?: number;
    offset?: number;
    aspectFilter?: string;
  }): Promise<EbaySearchResult> {
    const cfg = await this.appHeaders();
    const params: Record<string, string | number> = {};

    if (options.q) params.q = options.q;
    if (options.categoryIds) params.category_ids = options.categoryIds;
    if (options.filter) params.filter = options.filter;
    if (options.sort) params.sort = options.sort;
    if (options.limit) params.limit = options.limit;
    if (options.offset) params.offset = options.offset;
    if (options.aspectFilter) params.aspect_filter = options.aspectFilter;

    const { data } = await this.withRateLimitRetry(
      `search(${options.q || options.categoryIds || ''})`,
      async () => {
        await this.rateLimiter.acquire();
        return this.http.get<EbaySearchResult>(
          '/item_summary/search',
          { ...cfg, params },
        );
      },
    );
    return data;
  }

  /**
   * Get a single item by its eBay item ID (v1|itemId|0 format).
   */
  async getItem(itemId: string): Promise<EbayItem> {
    const cfg = await this.appHeaders();
    const { data } = await this.withRateLimitRetry(
      `getItem(${itemId})`,
      async () => {
        await this.rateLimiter.acquire();
        return this.http.get<EbayItem>(`/item/${itemId}`, cfg);
      },
    );
    return data;
  }

  /**
   * Get a single item by its legacy item ID.
   */
  async getItemByLegacyId(legacyItemId: string): Promise<EbayItem> {
    const cfg = await this.appHeaders();
    const { data } = await this.withRateLimitRetry(
      `getItemByLegacyId(${legacyItemId})`,
      async () => {
        await this.rateLimiter.acquire();
        return this.http.get<EbayItem>(
          `/item/get_item_by_legacy_id`,
          { ...cfg, params: { legacy_item_id: legacyItemId } },
        );
      },
    );
    return data;
  }

  // ──────────────────────────── Competitive Research ───────────────

  /**
   * Search for competing listings of a given part.
   * Returns a simplified pricing summary.
   */
  async getCompetitorPricing(
    partNumber: string,
    condition?: 'NEW' | 'USED',
    limit = 25,
  ): Promise<{
    items: EbayItemSummary[];
    total: number;
    avgPrice: number | null;
    medianPrice: number | null;
    minPrice: number | null;
    maxPrice: number | null;
  }> {
    const filter = condition
      ? `conditionIds:{${condition === 'NEW' ? '1000' : '3000'}}`
      : undefined;

    const result = await this.search({
      q: partNumber,
      filter,
      sort: 'price',
      limit,
    });

    const items = result.itemSummaries ?? [];
    const prices = items
      .map((i) => parseFloat(i.price?.value ?? '0'))
      .filter((p) => p > 0)
      .sort((a, b) => a - b);

    const avgPrice =
      prices.length > 0
        ? Math.round(
            (prices.reduce((a, b) => a + b, 0) / prices.length) * 100,
          ) / 100
        : null;
    const medianPrice =
      prices.length > 0 ? prices[Math.floor(prices.length / 2)] : null;
    const minPrice = prices.length > 0 ? prices[0] : null;
    const maxPrice = prices.length > 0 ? prices[prices.length - 1] : null;

    return {
      items,
      total: result.total ?? 0,
      avgPrice,
      medianPrice,
      minPrice,
      maxPrice,
    };
  }

  // ──────────────────────────── Catalog Lookup by MPN ─────────────

  /**
   * Search eBay for existing listings of a part by brand + MPN.
   * Returns catalog information including EPID, category, item specifics,
   * and any Year/Make/Model fitment hints from the listings.
   *
   * Used by FitmentDiscoveryService to resolve category and fitment for
   * parts that have no catalog fitment data (e.g. ECUs where the vision
   * model can identify the part number but not the vehicle).
   */
  async searchByMpn(
    brand: string,
    mpn: string,
    options?: { categoryIds?: string; limit?: number },
  ): Promise<EbayCatalogLookupResult> {
    if (!mpn?.trim()) {
      return { found: false, items: [] };
    }

    const query = [brand?.trim(), mpn.trim()].filter(Boolean).join(' ');
    const limit = options?.limit ?? 10;

    try {
      const cfg = await this.appHeaders();
      const params: Record<string, string | number> = {
        q: query,
        limit,
      };
      if (options?.categoryIds) {
        params.category_ids = options.categoryIds;
      }

      const { data } = await this.http.get<EbaySearchResult>(
        '/item_summary/search',
        { ...cfg, params },
      );

      const summaries = data.itemSummaries ?? [];
      if (summaries.length === 0) {
        this.logger.debug(`eBay catalog lookup: no results for "${query}"`);
        return { found: false, items: [] };
      }

      // Fetch full item details for the top results to get EPID + aspects
      const detailResults = await Promise.allSettled(
        summaries
          .slice(0, Math.min(3, summaries.length))
          .map((s) => this.getItem(s.itemId).catch(() => null)),
      );

      const items: EbayCatalogLookupResult['items'] = [];

      for (const settled of detailResults) {
        const item = settled.status === 'fulfilled' ? settled.value : null;
        if (!item) continue;

        const aspects: Record<string, string[]> = {};
        if (Array.isArray(item.localizedAspects)) {
          for (const a of item.localizedAspects) {
            aspects[a.name] = [a.value];
          }
        }

        // Extract Year/Make/Model from item aspects
        const fitmentHints = this.extractFitmentFromAspects(aspects);

        items.push({
          itemId: item.itemId,
          title: item.title,
          brand: item.brand ?? null,
          mpn: item.mpn ?? null,
          epid: item.epid ?? null,
          categoryId: item.categories?.[0]?.categoryId ?? null,
          categoryName: item.categories?.[0]?.categoryName ?? null,
          aspects,
          fitmentHints,
        });
      }

      // Also extract from summaries that didn't get full detail
      for (const s of summaries.slice(items.length)) {
        items.push({
          itemId: s.itemId,
          title: s.title,
          brand: null,
          mpn: null,
          epid: null,
          categoryId: s.categories?.[0]?.categoryId ?? null,
          categoryName: s.categories?.[0]?.categoryName ?? null,
          aspects: {},
          fitmentHints: [],
        });
      }

      this.logger.log(
        `eBay catalog lookup: found ${items.length} items for "${query}" — ` +
          `EPIDs: ${
            items
              .filter((i) => i.epid)
              .map((i) => i.epid)
              .join(', ') || 'none'
          }`,
      );

      return { found: items.length > 0, items };
    } catch (err) {
      this.logger.warn(
        `eBay catalog lookup failed for "${query}": ${err instanceof Error ? err.message : err}`,
      );
      return { found: false, items: [] };
    }
  }

  /**
   * Extract Year/Make/Model fitment hints from eBay item aspects.
   * Sellers include vehicle compatibility as item specifics like
   * "Compatible Vehicles", "Manufacturer Part Number", "Year", "Make", "Model".
   */
  private extractFitmentFromAspects(
    aspects: Record<string, string[]>,
  ): Array<{ year?: string; make?: string; model?: string }> {
    const hints: Array<{ year?: string; make?: string; model?: string }> = [];

    // Direct aspect keys that eBay sellers use
    const yearValues = aspects['Year'] ?? aspects['Model Year'] ?? [];
    const makeValues = aspects['Make'] ?? aspects['Manufacturer'] ?? [];
    const modelValues = aspects['Model'] ?? aspects['Vehicle Model'] ?? [];

    if (
      yearValues.length > 0 ||
      makeValues.length > 0 ||
      modelValues.length > 0
    ) {
      // Pair up Year/Make/Model values
      const maxLen = Math.max(
        yearValues.length,
        makeValues.length,
        modelValues.length,
      );
      for (let i = 0; i < maxLen; i++) {
        const hint: { year?: string; make?: string; model?: string } = {};
        if (yearValues[i]) hint.year = yearValues[i];
        if (makeValues[i]) hint.make = makeValues[i];
        if (modelValues[i]) hint.model = modelValues[i];
        if (hint.year || hint.make || hint.model) hints.push(hint);
      }
    }

    // Also check "Compatible Vehicles" or "Vehicle Type" aspects
    const compatVehicles =
      aspects['Compatible Vehicles'] ?? aspects['Vehicle Type'] ?? [];
    for (const cv of compatVehicles) {
      // Try to parse "2018 Toyota Camry" or "Toyota Camry 2018" format
      const parsed = this.parseVehicleString(cv);
      if (parsed) hints.push(parsed);
    }

    return hints;
  }

  /** Parse a vehicle string like "2018 Toyota Camry" into year/make/model */
  private parseVehicleString(
    text: string,
  ): { year?: string; make?: string; model?: string } | null {
    if (!text?.trim()) return null;
    const trimmed = text.trim();

    // Try "YEAR MAKE MODEL" format
    const yearFirst = trimmed.match(/^(\d{4})\s+([A-Za-z-]+)\s+(.+)$/);
    if (yearFirst) {
      return {
        year: yearFirst[1],
        make: yearFirst[2],
        model: yearFirst[3].trim(),
      };
    }

    // Try "MAKE MODEL YEAR" format
    const yearLast = trimmed.match(/^([A-Za-z-]+)\s+(.+)\s+(\d{4})$/);
    if (yearLast) {
      return {
        year: yearLast[3],
        make: yearLast[1],
        model: yearLast[2].trim(),
      };
    }

    // Try "MAKE MODEL" format (no year)
    const noYear = trimmed.match(/^([A-Za-z-]+)\s+(.+)$/);
    if (noYear) {
      return { make: noYear[1], model: noYear[2].trim() };
    }

    return null;
  }
}
