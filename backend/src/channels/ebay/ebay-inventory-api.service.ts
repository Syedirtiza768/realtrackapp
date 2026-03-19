import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { EbayAuthService } from './ebay-auth.service.js';
import type {
  EbayInventoryItem,
  EbayInventoryItemPage,
  EbayOffer,
  EbayOfferResponse,
  EbayPublishResponse,
  EbayBulkResponse,
  EbayPriceQuantityUpdate,
  EbayLocation,
  EbayCompatibilityPayload,
} from './ebay-api.types.js';

/**
 * EbayInventoryApiService — Typed client for the eBay Inventory API v1.
 *
 * Covers:
 *  - Inventory Items (CRUD, bulk operations)
 *  - Offers (create, update, publish, withdraw)
 *  - Bulk price/quantity updates
 *  - Inventory Locations
 *  - Product Compatibility
 *
 * Each method accepts a storeId and uses EbayAuthService to obtain a valid
 * User Access Token for that specific store.
 *
 * @see https://developer.ebay.com/api-docs/sell/inventory/overview.html
 */
@Injectable()
export class EbayInventoryApiService {
  private readonly logger = new Logger(EbayInventoryApiService.name);
  private readonly http: AxiosInstance;

  constructor(private readonly auth: EbayAuthService) {
    const config = this.auth.getApiConfig();
    this.http = axios.create({
      baseURL: `${config.baseUrl}/sell/inventory/v1`,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  // ──────────────────────────── helpers ────────────────────────────

  private async authHeaders(storeId: string): Promise<AxiosRequestConfig> {
    const token = await this.auth.getAccessToken(storeId);
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  // ──────────────────────────── Inventory Items ────────────────────

  /**
   * Create or replace an inventory item (PUT /inventory_item/{sku}).
   */
  async createOrReplaceItem(
    storeId: string,
    sku: string,
    item: EbayInventoryItem,
  ): Promise<void> {
    const cfg = await this.authHeaders(storeId);
    await this.http.put(`/inventory_item/${encodeURIComponent(sku)}`, item, cfg);
    this.logger.debug(`Upserted inventory item ${sku} for store ${storeId}`);
  }

  /**
   * Get a single inventory item by SKU.
   */
  async getItem(storeId: string, sku: string): Promise<EbayInventoryItem> {
    const cfg = await this.authHeaders(storeId);
    const { data } = await this.http.get<EbayInventoryItem>(
      `/inventory_item/${encodeURIComponent(sku)}`,
      cfg,
    );
    return data;
  }

  /**
   * Get paginated list of inventory items.
   */
  async getItems(
    storeId: string,
    limit = 25,
    offset = 0,
  ): Promise<EbayInventoryItemPage> {
    const cfg = await this.authHeaders(storeId);
    const { data } = await this.http.get<EbayInventoryItemPage>(
      `/inventory_item`,
      { ...cfg, params: { limit, offset } },
    );
    return data;
  }

  /**
   * Delete an inventory item by SKU.
   */
  async deleteItem(storeId: string, sku: string): Promise<void> {
    const cfg = await this.authHeaders(storeId);
    await this.http.delete(
      `/inventory_item/${encodeURIComponent(sku)}`,
      cfg,
    );
    this.logger.log(`Deleted inventory item ${sku} for store ${storeId}`);
  }

  // ──────────────────────────── Bulk Operations ────────────────────

  /**
   * Bulk update price and quantity for up to 25 offers per call.
   */
  async bulkUpdatePriceQuantity(
    storeId: string,
    updates: EbayPriceQuantityUpdate[],
  ): Promise<EbayBulkResponse> {
    const cfg = await this.authHeaders(storeId);
    const { data } = await this.http.post<EbayBulkResponse>(
      `/bulk_update_price_quantity`,
      { requests: updates },
      cfg,
    );
    this.logger.log(
      `Bulk updated ${updates.length} items for store ${storeId}`,
    );
    return data;
  }

  // ──────────────────────────── Offers ─────────────────────────────

  /**
   * Create an offer for an inventory item.
   */
  async createOffer(
    storeId: string,
    offer: EbayOffer,
  ): Promise<EbayOfferResponse> {
    const cfg = await this.authHeaders(storeId);
    const { data } = await this.http.post<EbayOfferResponse>(
      `/offer`,
      offer,
      cfg,
    );
    this.logger.debug(
      `Created offer ${data.offerId} for SKU ${offer.sku} on store ${storeId}`,
    );
    return data;
  }

  /**
   * Update an existing offer.
   */
  async updateOffer(
    storeId: string,
    offerId: string,
    offer: Partial<EbayOffer>,
  ): Promise<void> {
    const cfg = await this.authHeaders(storeId);
    await this.http.put(`/offer/${offerId}`, offer, cfg);
    this.logger.debug(
      `Updated offer ${offerId} for store ${storeId}`,
    );
  }

  /**
   * Get a single offer by ID.
   */
  async getOffer(storeId: string, offerId: string): Promise<EbayOffer> {
    const cfg = await this.authHeaders(storeId);
    const { data } = await this.http.get<EbayOffer>(
      `/offer/${offerId}`,
      cfg,
    );
    return data;
  }

  /**
   * Get all offers for a given SKU.
   */
  async getOffersBySku(
    storeId: string,
    sku: string,
    limit = 25,
    offset = 0,
  ): Promise<{ offers: EbayOffer[]; total: number }> {
    const cfg = await this.authHeaders(storeId);
    const { data } = await this.http.get(`/offer`, {
      ...cfg,
      params: { sku, limit, offset },
    });
    return { offers: data.offers ?? [], total: data.total ?? 0 };
  }

  /**
   * Publish an offer (make it live on eBay).
   */
  async publishOffer(
    storeId: string,
    offerId: string,
  ): Promise<EbayPublishResponse> {
    const cfg = await this.authHeaders(storeId);
    const { data } = await this.http.post<EbayPublishResponse>(
      `/offer/${offerId}/publish`,
      {},
      cfg,
    );
    this.logger.log(
      `Published offer ${offerId} → listingId=${data.listingId} for store ${storeId}`,
    );
    return data;
  }

  /**
   * Withdraw an offer (remove from eBay marketplace).
   */
  async withdrawOffer(storeId: string, offerId: string): Promise<void> {
    const cfg = await this.authHeaders(storeId);
    await this.http.post(`/offer/${offerId}/withdraw`, {}, cfg);
    this.logger.log(
      `Withdrew offer ${offerId} for store ${storeId}`,
    );
  }

  // ──────────────────────────── Product Compatibility ──────────────

  /**
   * Create or replace compatibility (fitment) data for an inventory item.
   */
  async setCompatibility(
    storeId: string,
    sku: string,
    payload: EbayCompatibilityPayload,
  ): Promise<void> {
    const cfg = await this.authHeaders(storeId);
    await this.http.put(
      `/inventory_item/${encodeURIComponent(sku)}/product_compatibility`,
      payload,
      cfg,
    );
    this.logger.debug(
      `Set compatibility for ${sku} with ${payload.compatibleProducts.length} vehicles`,
    );
  }

  /**
   * Get compatibility data for an inventory item.
   */
  async getCompatibility(
    storeId: string,
    sku: string,
  ): Promise<EbayCompatibilityPayload> {
    const cfg = await this.authHeaders(storeId);
    const { data } = await this.http.get<EbayCompatibilityPayload>(
      `/inventory_item/${encodeURIComponent(sku)}/product_compatibility`,
      cfg,
    );
    return data;
  }

  /**
   * Delete compatibility data for an inventory item.
   */
  async deleteCompatibility(storeId: string, sku: string): Promise<void> {
    const cfg = await this.authHeaders(storeId);
    await this.http.delete(
      `/inventory_item/${encodeURIComponent(sku)}/product_compatibility`,
      cfg,
    );
    this.logger.debug(`Deleted compatibility for ${sku}`);
  }

  // ──────────────────────────── Locations ──────────────────────────

  /**
   * Create an inventory location.
   */
  async createLocation(
    storeId: string,
    merchantLocationKey: string,
    location: EbayLocation,
  ): Promise<void> {
    const cfg = await this.authHeaders(storeId);
    await this.http.post(
      `/location/${encodeURIComponent(merchantLocationKey)}`,
      location,
      cfg,
    );
    this.logger.log(`Created location ${merchantLocationKey}`);
  }

  /**
   * Get inventory locations (paginated).
   */
  async getLocations(
    storeId: string,
    limit = 25,
    offset = 0,
  ): Promise<{ locations: EbayLocation[]; total: number }> {
    const cfg = await this.authHeaders(storeId);
    const { data } = await this.http.get(`/location`, {
      ...cfg,
      params: { limit, offset },
    });
    return { locations: data.locations ?? [], total: data.total ?? 0 };
  }
}
