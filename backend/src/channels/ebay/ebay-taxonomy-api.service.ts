import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { EbayAuthService } from './ebay-auth.service.js';
import { EbayTaxonomyCacheService } from './ebay-taxonomy-cache.service.js';
import type {
  EbayCategoryTree,
  EbayCategorySubtree,
  EbayCategorySuggestion,
  EbayAspect,
  EbayCompatibilityProperty,
} from './ebay-api.types.js';

/**
 * Simple token bucket rate limiter.
 * Allows up to `maxTokens` requests per second, with tokens refilling over time.
 */
class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond

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

    // Calculate wait time for next token
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
 * EbayTaxonomyApiService — Typed client for the eBay Taxonomy API v1.
 *
 * Covers:
 *  - Category tree retrieval (default tree and specific nodes)
 *  - Category suggestions based on product keywords
 *  - Item aspects / category aspects for listing compliance
 *  - Compatibility properties for vehicle fitment (Parts & Accessories)
 *
 * Uses Application Token (client_credentials) since Taxonomy API
 * doesn't require user-level authorization.
 *
 * @see https://developer.ebay.com/api-docs/commerce/taxonomy/overview.html
 */
@Injectable()
export class EbayTaxonomyApiService {
  private readonly logger = new Logger(EbayTaxonomyApiService.name);
  private readonly http: AxiosInstance;
  private readonly rateLimiter: TokenBucketRateLimiter;

  /** eBay Motors Parts & Accessories category tree ID (US) */
  static readonly EBAY_US_TREE_ID = '0';
  /** eBay US marketplace ID for taxonomy calls */
  static readonly EBAY_US_MARKETPLACE = 'EBAY_US';

  constructor(
    private readonly auth: EbayAuthService,
    private readonly config: ConfigService,
    private readonly taxonomyCache: EbayTaxonomyCacheService,
  ) {
    const rps =
      Number(this.config.get('EBAY_TAXONOMY_RPS')) ||
      Number(this.config.get('PIPELINE_TAXONOMY_RPS')) ||
      2;
    this.rateLimiter = new TokenBucketRateLimiter(rps);
    const apiConfig = this.auth.getApiConfig();
    this.http = axios.create({
      baseURL: `${apiConfig.baseUrl}/commerce/taxonomy/v1`,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  // ──────────────────────────── helpers ────────────────────────────

  private async appHeaders(): Promise<AxiosRequestConfig> {
    const token = await this.auth.getApplicationToken();
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  /** Retry eBay taxonomy calls on 429 rate limits with exponential backoff. */
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
          `eBay Taxonomy ${label} rate-limited (429) — retry ${attempt + 1}/${maxAttempts - 1} in ${wait}ms`,
        );
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    throw lastErr;
  }

  // ──────────────────────────── Category Trees ────────────────────

  /**
   * Get the default category tree ID for a marketplace.
   */
  async getDefaultCategoryTreeId(
    marketplace = EbayTaxonomyApiService.EBAY_US_MARKETPLACE,
  ): Promise<string> {
    await this.rateLimiter.acquire();
    const cfg = await this.appHeaders();
    const { data } = await this.http.get(`/get_default_category_tree_id`, {
      ...cfg,
      params: { marketplace_id: marketplace },
    });
    return data.categoryTreeId;
  }

  /**
   * Get the full category tree.
   */
  async getCategoryTree(treeId?: string): Promise<EbayCategoryTree> {
    const id = treeId ?? EbayTaxonomyApiService.EBAY_US_TREE_ID;
    await this.rateLimiter.acquire();
    const cfg = await this.appHeaders();
    const { data } = await this.http.get<EbayCategoryTree>(
      `/category_tree/${id}`,
      cfg,
    );
    return data;
  }

  /**
   * Get a category subtree (a specific node and all its descendants).
   */
  async getCategorySubtree(
    categoryId: string,
    treeId?: string,
  ): Promise<EbayCategorySubtree> {
    const id = treeId ?? EbayTaxonomyApiService.EBAY_US_TREE_ID;
    await this.rateLimiter.acquire();
    const cfg = await this.appHeaders();
    const { data } = await this.http.get<EbayCategorySubtree>(
      `/category_tree/${id}/get_category_subtree`,
      { ...cfg, params: { category_id: categoryId } },
    );
    return data;
  }

  // ──────────────────────────── Category Suggestions ──────────────

  /**
   * Get category suggestions based on product keywords.
   * Returns ranked list of matching categories.
   */
  async getCategorySuggestions(
    query: string,
    treeId?: string,
  ): Promise<EbayCategorySuggestion[]> {
    const id = treeId ?? EbayTaxonomyApiService.EBAY_US_TREE_ID;
    const trimmed = query.trim();
    if (!trimmed) return [];

    const cached = this.taxonomyCache.getSuggestion(id, trimmed);
    if (cached !== undefined) {
      if (!cached?.categoryId) return [];
      return [
        {
          category: {
            categoryId: cached.categoryId,
            categoryName: cached.categoryName,
          },
          categoryTreeNodeLevel: 0,
          relevancy: 'RELEVANT',
          categoryTreeNodeAncestors: [],
        } as EbayCategorySuggestion,
      ];
    }

    if (!this.taxonomyCache.hasDailyQuota()) {
      this.logger.warn(
        `Taxonomy daily quota exhausted (${this.taxonomyCache.getDailyUsage()}) — skipping suggest for "${trimmed.slice(0, 40)}"`,
      );
      return [];
    }

    await this.rateLimiter.acquire();
    const suggestions = await this.withRateLimitRetry(
      `getCategorySuggestions(tree=${id}, q="${trimmed.slice(0, 40)}")`,
      async () => {
        const cfg = await this.appHeaders();
        const { data } = await this.http.get(
          `/category_tree/${id}/get_category_suggestions`,
          { ...cfg, params: { q: trimmed } },
        );
        return (data.categorySuggestions ?? []) as EbayCategorySuggestion[];
      },
    );

    this.taxonomyCache.incrementDailyUsage();

    const best = suggestions[0];
    if (best?.category?.categoryId) {
      this.taxonomyCache.setSuggestion(id, trimmed, {
        categoryId: best.category.categoryId,
        categoryName: best.category.categoryName,
      });
    } else {
      this.taxonomyCache.setSuggestion(id, trimmed, null);
    }

    return suggestions;
  }

  // ──────────────────────────── Item Aspects ──────────────────────

  /**
   * Get the item aspects for a specific category.
   * These define the required/recommended item specifics for listings.
   */
  async getItemAspectsForCategory(
    categoryId: string,
    treeId?: string,
  ): Promise<EbayAspect[]> {
    const id = treeId ?? EbayTaxonomyApiService.EBAY_US_TREE_ID;
    await this.rateLimiter.acquire();
    const cfg = await this.appHeaders();
    const { data } = await this.http.get(
      `/category_tree/${id}/get_item_aspects_for_category`,
      { ...cfg, params: { category_id: categoryId } },
    );
    return data.aspects ?? [];
  }

  // ──────────────────────────── Compatibility Properties ──────────

  /**
   * Get the compatibility properties for a given category.
   * Used for vehicle fitment — returns properties like Make, Model, Year, Trim, Engine.
   */
  async getCompatibilityProperties(
    categoryTreeId: string,
    categoryId: string,
  ): Promise<EbayCompatibilityProperty[]> {
    return this.withRateLimitRetry(
      `getCompatibilityProperties(${categoryId})`,
      async () => {
        await this.rateLimiter.acquire();
        const cfg = await this.appHeaders();
        const { data } = await this.http.get(
          `/category_tree/${categoryTreeId}/get_compatibility_properties`,
          { ...cfg, params: { category_id: categoryId } },
        );
        return data.compatibilityProperties ?? [];
      },
    );
  }

  /**
   * Get the compatibility property values for a given property.
   * e.g. given "Make" property, returns "Toyota", "Ford", etc.
   *
   * Supports optional filter to narrow results (e.g. pass Make=Toyota to filter Models).
   */
  async getCompatibilityPropertyValues(
    categoryTreeId: string,
    categoryId: string,
    compatibilityPropertyName: string,
    filter?: Record<string, string>,
  ): Promise<
    { value: string; applicableProperties?: Record<string, string> }[]
  > {
    return this.withRateLimitRetry(
      `getCompatibilityPropertyValues(${categoryId}/${compatibilityPropertyName})`,
      async () => {
        await this.rateLimiter.acquire();
        const cfg = await this.appHeaders();
        const params: Record<string, string> = {
          category_id: categoryId,
          compatibility_property: compatibilityPropertyName,
        };

        // Build filter string: {"propertyName":"value","propertyName2":"value2"}
        if (filter && Object.keys(filter).length > 0) {
          params.filter = Object.entries(filter)
            .map(([k, v]) => `${k}:${v}`)
            .join(',');
        }

        const { data } = await this.http.get(
          `/category_tree/${categoryTreeId}/get_compatibility_property_values`,
          { ...cfg, params },
        );
        return data.compatibilityPropertyValues ?? [];
      },
    );
  }

  // ──────────────────────────── Convenience Methods ───────────────

  /**
   * Get vehicle compatibility chain for Parts & Accessories:
   * Year → Make → Model → Trim → Engine
   *
   * Returns all available values for the given level, optionally
   * filtered by parent selections.
   */
  async getVehicleValues(
    level: 'Year' | 'Make' | 'Model' | 'Trim' | 'Engine',
    categoryId: string,
    parentSelections?: Record<string, string>,
    treeId?: string,
  ): Promise<string[]> {
    const id = treeId ?? EbayTaxonomyApiService.EBAY_US_TREE_ID;
    const values = await this.getCompatibilityPropertyValues(
      id,
      categoryId,
      level,
      parentSelections,
    );
    return values.map((v) => v.value).sort();
  }
}
