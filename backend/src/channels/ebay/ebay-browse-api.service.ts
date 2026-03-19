import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { EbayAuthService } from './ebay-auth.service.js';
import type {
  EbaySearchResult,
  EbayItemSummary,
  EbayItem,
} from './ebay-api.types.js';

/**
 * EbayBrowseApiService — Typed client for the eBay Browse API v1.
 *
 * Phase 5 service (stubbed now with core search/item operations).
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

    const { data } = await this.http.get<EbaySearchResult>(
      '/item_summary/search',
      { ...cfg, params },
    );
    return data;
  }

  /**
   * Get a single item by its eBay item ID (v1|itemId|0 format).
   */
  async getItem(itemId: string): Promise<EbayItem> {
    const cfg = await this.appHeaders();
    const { data } = await this.http.get<EbayItem>(
      `/item/${itemId}`,
      cfg,
    );
    return data;
  }

  /**
   * Get a single item by its legacy item ID.
   */
  async getItemByLegacyId(legacyItemId: string): Promise<EbayItem> {
    const cfg = await this.appHeaders();
    const { data } = await this.http.get<EbayItem>(
      `/item/get_item_by_legacy_id`,
      { ...cfg, params: { legacy_item_id: legacyItemId } },
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
        ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100
        : null;
    const medianPrice =
      prices.length > 0
        ? prices[Math.floor(prices.length / 2)]
        : null;
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
}
