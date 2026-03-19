import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { EbayAuthService } from './ebay-auth.service.js';
import type {
  EbayOrderPage,
  EbayOrder,
  EbayShippingFulfillmentRequest,
  EbayFulfillment,
} from './ebay-api.types.js';

/**
 * EbayFulfillmentApiService — Typed client for the eBay Fulfillment API v1.
 *
 * Phase 4 service (stubbed now with core read operations).
 *
 * Covers:
 *  - Orders (search, get by ID)
 *  - Shipping fulfillments (create, get)
 *  - Order filters by date, status, buyer
 *
 * @see https://developer.ebay.com/api-docs/sell/fulfillment/overview.html
 */
@Injectable()
export class EbayFulfillmentApiService {
  private readonly logger = new Logger(EbayFulfillmentApiService.name);
  private readonly http: AxiosInstance;

  constructor(private readonly auth: EbayAuthService) {
    const config = this.auth.getApiConfig();
    this.http = axios.create({
      baseURL: `${config.baseUrl}/sell/fulfillment/v1`,
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

  // ──────────────────────────── Orders ─────────────────────────────

  /**
   * Get orders with optional filters (paginated).
   */
  async getOrders(
    storeId: string,
    options: {
      filter?: string;
      limit?: number;
      offset?: number;
      orderIds?: string[];
    } = {},
  ): Promise<EbayOrderPage> {
    const cfg = await this.authHeaders(storeId);
    const params: Record<string, string | number> = {};

    if (options.filter) params.filter = options.filter;
    if (options.limit) params.limit = options.limit;
    if (options.offset) params.offset = options.offset;
    if (options.orderIds?.length) {
      params.orderIds = options.orderIds.join(',');
    }

    const { data } = await this.http.get<EbayOrderPage>('/order', {
      ...cfg,
      params,
    });
    return data;
  }

  /**
   * Get recent orders created since a given date.
   */
  async getRecentOrders(
    storeId: string,
    sinceDate: Date,
    limit = 50,
  ): Promise<EbayOrder[]> {
    const iso = sinceDate.toISOString();
    const filter = `creationdate:[${iso}..] `;
    const page = await this.getOrders(storeId, { filter, limit });
    return page.orders ?? [];
  }

  /**
   * Get a single order by its orderId.
   */
  async getOrder(storeId: string, orderId: string): Promise<EbayOrder> {
    const cfg = await this.authHeaders(storeId);
    const { data } = await this.http.get<EbayOrder>(
      `/order/${orderId}`,
      cfg,
    );
    return data;
  }

  // ──────────────────────────── Shipping Fulfillments ──────────────

  /**
   * Create a shipping fulfillment for an order.
   */
  async createShippingFulfillment(
    storeId: string,
    orderId: string,
    fulfillment: EbayShippingFulfillmentRequest,
  ): Promise<{ fulfillmentId: string }> {
    const cfg = await this.authHeaders(storeId);
    const { data } = await this.http.post(
      `/order/${orderId}/shipping_fulfillment`,
      fulfillment,
      cfg,
    );
    this.logger.log(
      `Created shipping fulfillment for order ${orderId} on store ${storeId}`,
    );
    return data;
  }

  /**
   * Get shipping fulfillments for an order.
   */
  async getShippingFulfillments(
    storeId: string,
    orderId: string,
  ): Promise<EbayFulfillment[]> {
    const cfg = await this.authHeaders(storeId);
    const { data } = await this.http.get(
      `/order/${orderId}/shipping_fulfillment`,
      cfg,
    );
    return data.fulfillments ?? [];
  }

  // ──────────────────────────── Convenience ────────────────────────

  /**
   * Get count of awaiting-shipment orders for a store.
   */
  async getAwaitingShipmentCount(storeId: string): Promise<number> {
    const filter = `orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}`;
    const page = await this.getOrders(storeId, { filter, limit: 1, offset: 0 });
    return page.total ?? 0;
  }
}
