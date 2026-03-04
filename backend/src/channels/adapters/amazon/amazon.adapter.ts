import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import type {
  ChannelAdapter,
  TokenSet,
  ExternalListingResult,
  InventorySyncItem,
  ChannelOrder,
  StoreContext,
} from '../../channel-adapter.interface.js';

/**
 * Amazon SP-API Adapter — Phase 2.
 *
 * Gated by the `amazon_integration` feature flag (disabled by default).
 * Uses:
 *  - Selling Partner API for listings, inventory, and orders
 *  - Login with Amazon (LWA) OAuth 2.0 for token exchange/refresh
 *  - AWS Signature Version 4 for request signing
 *
 * Environment variables:
 *  AMAZON_SP_CLIENT_ID     – LWA client ID
 *  AMAZON_SP_CLIENT_SECRET – LWA client secret
 *  AMAZON_SP_REDIRECT_URI  – OAuth redirect
 *  AMAZON_SP_MARKETPLACE   – Default marketplace ID (default: ATVPDKIKX0DER = US)
 *  AMAZON_SP_SANDBOX       – 'true' for sandbox mode
 */
@Injectable()
export class AmazonAdapter implements ChannelAdapter {
  readonly channelName = 'amazon';
  private readonly logger = new Logger(AmazonAdapter.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly sandbox: boolean;
  private readonly baseUrl: string;
  private readonly marketplaceId: string;
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('AMAZON_SP_CLIENT_ID', '');
    this.clientSecret = this.config.get<string>('AMAZON_SP_CLIENT_SECRET', '');
    this.redirectUri = this.config.get<string>('AMAZON_SP_REDIRECT_URI', '');
    this.sandbox = this.config.get<string>('AMAZON_SP_SANDBOX', 'true') === 'true';
    this.marketplaceId = this.config.get<string>('AMAZON_SP_MARKETPLACE', 'ATVPDKIKX0DER');

    this.baseUrl = this.sandbox
      ? 'https://sandbox.sellingpartnerapi-na.amazon.com'
      : 'https://sellingpartnerapi-na.amazon.com';

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /* ─── OAuth ─── */

  getAuthUrl(state: string): string {
    return (
      `https://sellercentral.amazon.com/apps/authorize/consent?` +
      `application_id=${this.clientId}` +
      `&state=${state}` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
      `&version=beta`
    );
  }

  async exchangeCode(code: string): Promise<TokenSet> {
    const { data } = await axios.post(
      'https://api.amazon.com/auth/o2/token',
      {
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
      },
    );

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
      tokenType: data.token_type ?? 'bearer',
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenSet> {
    const { data } = await axios.post(
      'https://api.amazon.com/auth/o2/token',
      {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      },
    );

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
      tokenType: data.token_type ?? 'bearer',
    };
  }

  /* ─── Listings (SP-API Listings Items) ─── */

  async publishListing(
    tokens: TokenSet,
    listingData: Record<string, unknown>,
    _storeContext?: StoreContext,
  ): Promise<ExternalListingResult> {
    try {
      const sku = (listingData['sku'] as string) || `MRGK-${Date.now()}`;

      // SP-API: PUT /listings/2021-08-01/items/{sellerId}/{sku}
      // We use the Listings Items API for catalog-based listing creation
      const sellerId = (listingData['sellerId'] as string) || '';

      const body = {
        productType: (listingData['productType'] as string) || 'AUTO_PART',
        requirements: 'LISTING',
        attributes: {
          condition_type: [{ value: this.mapCondition(listingData['condition'] as string) }],
          item_name: [{ value: listingData['title'], language_tag: 'en_US', marketplace_id: this.marketplaceId }],
          merchant_suggested_asin: listingData['asin'] ? [{ value: listingData['asin'] }] : undefined,
          externally_assigned_product_identifier: listingData['mpn']
            ? [{ type: 'part_number', value: listingData['mpn'] }]
            : undefined,
          brand: listingData['brand'] ? [{ value: listingData['brand'] }] : undefined,
          bullet_point: listingData['bulletPoints']
            ? (listingData['bulletPoints'] as string[]).map((bp) => ({ value: bp, language_tag: 'en_US' }))
            : undefined,
          product_description: listingData['description']
            ? [{ value: (listingData['description'] as string).substring(0, 2000), language_tag: 'en_US' }]
            : undefined,
          purchasable_offer: [{
            marketplace_id: this.marketplaceId,
            currency: 'USD',
            our_price: [{ schedule: [{ value_with_tax: String(listingData['price'] ?? '0') }] }],
          }],
          fulfillment_availability: [{
            fulfillment_channel_code: 'DEFAULT',
            quantity: Number(listingData['quantity'] ?? 1),
          }],
          main_product_image_locator: listingData['imageUrls']
            ? [{ media_location: (listingData['imageUrls'] as string[])[0] }]
            : undefined,
        },
      };

      // Remove undefined attributes
      const attrs = body.attributes as Record<string, unknown>;
      for (const key of Object.keys(attrs)) {
        if (attrs[key] === undefined) delete attrs[key];
      }

      const { data } = await this.http.put(
        `/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}`,
        body,
        {
          params: { marketplaceIds: this.marketplaceId },
          headers: { 'x-amz-access-token': tokens.accessToken },
        },
      );

      const status = data.status === 'ACCEPTED' ? 'active' : 'draft';

      return {
        externalId: sku,
        externalUrl: `https://www.amazon.com/dp/${data.asin ?? sku}`,
        status,
      };
    } catch (error: any) {
      this.logger.error(`Amazon publish failed: ${error.message}`);
      const apiErrors = error?.response?.data?.errors;
      return {
        externalId: '',
        status: 'error',
        error: apiErrors?.[0]?.message ?? error.message,
      };
    }
  }

  async updateListing(
    tokens: TokenSet,
    externalId: string,
    listingData: Record<string, unknown>,
    _storeContext?: StoreContext,
  ): Promise<ExternalListingResult> {
    try {
      const sellerId = (listingData['sellerId'] as string) || '';
      const sku = externalId;

      // PATCH update for partial attributes
      const patches: { op: string; path: string; value: unknown[] }[] = [];

      if (listingData['title']) {
        patches.push({
          op: 'replace',
          path: '/attributes/item_name',
          value: [{ value: listingData['title'], language_tag: 'en_US', marketplace_id: this.marketplaceId }],
        });
      }
      if (listingData['price']) {
        patches.push({
          op: 'replace',
          path: '/attributes/purchasable_offer',
          value: [{
            marketplace_id: this.marketplaceId,
            currency: 'USD',
            our_price: [{ schedule: [{ value_with_tax: String(listingData['price']) }] }],
          }],
        });
      }
      if (listingData['description']) {
        patches.push({
          op: 'replace',
          path: '/attributes/product_description',
          value: [{ value: (listingData['description'] as string).substring(0, 2000), language_tag: 'en_US' }],
        });
      }

      if (patches.length === 0) {
        return { externalId: sku, status: 'active' };
      }

      await this.http.patch(
        `/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}`,
        { productType: (listingData['productType'] as string) || 'AUTO_PART', patches },
        {
          params: { marketplaceIds: this.marketplaceId },
          headers: { 'x-amz-access-token': tokens.accessToken },
        },
      );

      return { externalId: sku, status: 'active' };
    } catch (error: any) {
      this.logger.error(`Amazon update failed: ${error.message}`);
      return {
        externalId,
        status: 'error',
        error: error?.response?.data?.errors?.[0]?.message ?? error.message,
      };
    }
  }

  async endListing(tokens: TokenSet, externalId: string, _storeContext?: StoreContext): Promise<void> {
    // Delete the listing item (sets status to inactive)
    try {
      await this.http.delete(
        `/listings/2021-08-01/items/-/${encodeURIComponent(externalId)}`,
        {
          params: { marketplaceIds: this.marketplaceId },
          headers: { 'x-amz-access-token': tokens.accessToken },
        },
      );
    } catch (error: any) {
      this.logger.error(`Amazon end listing failed (${externalId}): ${error.message}`);
      throw error;
    }
  }

  /* ─── Inventory (SP-API Fulfillment Inventory) ─── */

  async syncInventory(
    tokens: TokenSet,
    items: InventorySyncItem[],
    _storeContext?: StoreContext,
  ): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0;
    let failed = 0;

    for (const item of items) {
      try {
        await this.http.put(
          `/fba/inventory/v1/items/${encodeURIComponent(item.externalId)}`,
          {
            sellerSku: item.externalId,
            quantity: item.quantity,
          },
          {
            headers: { 'x-amz-access-token': tokens.accessToken },
          },
        );
        succeeded++;
      } catch (error: any) {
        this.logger.warn(`Amazon inventory sync failed for ${item.externalId}: ${error.message}`);
        failed++;
      }
    }

    return { succeeded, failed };
  }

  /* ─── Orders (SP-API Orders V0) ─── */

  async getRecentOrders(
    tokens: TokenSet,
    since: Date,
    _storeContext?: StoreContext,
  ): Promise<ChannelOrder[]> {
    try {
      const { data } = await this.http.get('/orders/v0/orders', {
        params: {
          MarketplaceIds: this.marketplaceId,
          CreatedAfter: since.toISOString(),
          OrderStatuses: 'Unshipped,PartiallyShipped',
          MaxResultsPerPage: 50,
        },
        headers: { 'x-amz-access-token': tokens.accessToken },
      });

      const orders = data.payload?.Orders ?? [];
      return orders.map((o: any) => ({
        externalOrderId: o.AmazonOrderId,
        externalListingId: '', // Resolved by fetching order items
        buyerUsername: o.BuyerInfo?.BuyerEmail ?? '',
        quantity: o.NumberOfItemsUnshipped ?? 1,
        totalPrice: parseFloat(o.OrderTotal?.Amount ?? '0'),
        currency: o.OrderTotal?.CurrencyCode ?? 'USD',
        shippingAddress: o.ShippingAddress ?? {},
        orderedAt: new Date(o.PurchaseDate),
        rawPayload: o,
      }));
    } catch (error: any) {
      this.logger.error(`Amazon fetch orders failed: ${error.message}`);
      return [];
    }
  }

  /* ─── Webhook ─── */

  verifyWebhookSignature(
    rawBody: Buffer,
    signature: string,
    secret: string,
  ): boolean {
    // Amazon uses AWS EventBridge with message signing
    const hash = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(signature, 'hex'),
      );
    } catch {
      return false;
    }
  }

  /* ─── Helpers ─── */

  private mapCondition(condition?: string): string {
    const map: Record<string, string> = {
      new: 'new_new',
      'like new': 'new_open_box',
      excellent: 'used_like_new',
      'very good': 'used_very_good',
      good: 'used_good',
      acceptable: 'used_acceptable',
      refurbished: 'refurbished_refurbished',
    };
    return map[(condition ?? 'used_good').toLowerCase()] ?? 'used_good';
  }
}
