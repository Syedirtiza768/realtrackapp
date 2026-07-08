import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import {
  buildDefaultInventoryLocationPayload,
  resolvePreferredMerchantLocationKey,
} from './ebay-inventory-location.util.js';
import { Store } from '../entities/store.entity.js';
import { EbayMarketplaceConfigService } from '../../integrations/ebay/services/ebay-marketplace-config.service.js';
import { EbayAuthService } from './ebay-auth.service.js';
import {
  marketplaceRequestHeaders,
  resolveMarketplaceId,
  toEbayInventoryApiMarketplaceId,
} from './ebay-marketplace-headers.util.js';
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

  constructor(
    private readonly auth: EbayAuthService,
    private readonly marketplaceConfig: EbayMarketplaceConfigService,
    private readonly configService: ConfigService,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
  ) {
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
    const baseUrl = await this.auth.getApiBaseUrlForStore(storeId);
    const store = await this.storeRepo.findOneBy({ id: storeId });
    const marketplaceId = store
      ? resolveMarketplaceId(store)
      : 'EBAY_MOTORS_US';
    const mpHeaders = marketplaceRequestHeaders(
      marketplaceId,
      this.marketplaceConfig.get(marketplaceId),
    );
    return {
      baseURL: `${baseUrl}/sell/inventory/v1`,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...mpHeaders,
      },
    };
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
    await this.http.put(
      `/inventory_item/${encodeURIComponent(sku)}`,
      item,
      cfg,
    );
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
   * Withdraw an offer (remove from eBay marketplace).
   */
  async withdrawOffer(storeId: string, offerId: string): Promise<void> {
    const cfg = await this.authHeaders(storeId);
    await this.http.post(`/offer/${offerId}/withdraw`, {}, cfg);
    this.logger.log(`Withdrew offer ${offerId} for store ${storeId}`);
  }

  /**
   * Delete an offer by ID.
   */
  async deleteOffer(storeId: string, offerId: string): Promise<void> {
    const cfg = await this.authHeaders(storeId);
    await this.http.delete(`/offer/${offerId}`, cfg);
    this.logger.log(`Deleted offer ${offerId} for store ${storeId}`);
  }

  /**
   * Delete an inventory item by SKU.
   */
  async deleteItem(storeId: string, sku: string): Promise<void> {
    const cfg = await this.authHeaders(storeId);
    await this.http.delete(`/inventory_item/${encodeURIComponent(sku)}`, cfg);
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
    const payload = {
      ...offer,
      marketplaceId: toEbayInventoryApiMarketplaceId(offer.marketplaceId),
    };
    const { data } = await this.http.post<EbayOfferResponse>(
      `/offer`,
      payload,
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
    const payload =
      offer.marketplaceId != null
        ? {
            ...offer,
            marketplaceId: toEbayInventoryApiMarketplaceId(offer.marketplaceId),
          }
        : offer;
    await this.http.put(`/offer/${offerId}`, payload, cfg);
    this.logger.debug(`Updated offer ${offerId} for store ${storeId}`);
  }

  /**
   * Get a single offer by ID.
   */
  async getOffer(storeId: string, offerId: string): Promise<EbayOffer> {
    const cfg = await this.authHeaders(storeId);
    const { data } = await this.http.get<EbayOffer>(`/offer/${offerId}`, cfg);
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
    return this.getOffers(storeId, { sku, limit, offset });
  }

  /**
   * Paginated offers list (optionally filtered by SKU or marketplace).
   */
  async getOffers(
    storeId: string,
    params: {
      sku?: string;
      marketplaceId?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ offers: EbayOffer[]; total: number }> {
    const cfg = await this.authHeaders(storeId);
    try {
      const { data } = await this.http.get(`/offer`, {
        ...cfg,
        params: {
          limit: params.limit ?? 25,
          offset: params.offset ?? 0,
          ...(params.sku ? { sku: params.sku } : {}),
          ...(params.marketplaceId
            ? {
                marketplace_id: toEbayInventoryApiMarketplaceId(
                  params.marketplaceId,
                ),
              }
            : {}),
        },
      });
      return { offers: data.offers ?? [], total: data.total ?? 0 };
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        return { offers: [], total: 0 };
      }
      throw err;
    }
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
    this.logger.log(`Withdrew offer ${offerId} for store ${storeId}`);
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
    location: Omit<EbayLocation, 'merchantLocationKey'>,
  ): Promise<void> {
    const cfg = await this.authHeaders(storeId);
    await this.http.post(
      `/location/${encodeURIComponent(merchantLocationKey)}`,
      location,
      cfg,
    );
    this.logger.log(
      `Created inventory location ${merchantLocationKey} for store ${storeId}`,
    );
  }

  /**
   * Get a single inventory location by key.
   */
  async getLocation(
    storeId: string,
    merchantLocationKey: string,
  ): Promise<EbayLocation | null> {
    const cfg = await this.authHeaders(storeId);
    try {
      const { data } = await this.http.get<EbayLocation>(
        `/location/${encodeURIComponent(merchantLocationKey)}`,
        cfg,
      );
      return data?.merchantLocationKey ? data : null;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        return null;
      }
      throw err;
    }
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

  /**
   * Resolve merchantLocationKey for offers: list existing locations, probe preferred key,
   * or create a default warehouse location when the seller has none configured.
   */
  async ensureMerchantLocation(
    storeId: string,
    preferredKey?: string | null,
  ): Promise<string | null> {
    const store = await this.storeRepo.findOneBy({ id: storeId });
    const keyHint = resolvePreferredMerchantLocationKey(
      this.configService,
      store,
      preferredKey,
    );

    try {
      const preferred = await this.getLocation(storeId, keyHint);
      if (preferred?.merchantLocationKey) {
        return preferred.merchantLocationKey;
      }

      const { locations } = await this.getLocations(storeId);
      if (locations.length) {
        const match = locations.find((l) => l.merchantLocationKey === keyHint);
        return (match ?? locations[0]).merchantLocationKey;
      }

      const payload = buildDefaultInventoryLocationPayload(
        this.configService,
        store,
      );
      await this.createLocation(storeId, keyHint, payload);

      if (store && !store.locationKey) {
        store.locationKey = keyHint;
        await this.storeRepo.save(store);
      }

      this.logger.log(
        `Provisioned default inventory location "${keyHint}" for store ${store?.storeName ?? storeId}`,
      );
      return keyHint;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Could not ensure inventory location for store ${storeId}: ${message}`,
      );
      return null;
    }
  }
}
