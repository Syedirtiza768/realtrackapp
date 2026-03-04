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
 * Walmart Marketplace API Adapter — Phase 2.
 *
 * Gated by the `walmart_integration` feature flag (disabled by default).
 * Uses:
 *  - Walmart Marketplace API v3 for items, inventory, and orders
 *  - Client credentials (Client ID + Client Secret) for token generation
 *
 * Environment variables:
 *  WALMART_CLIENT_ID     – API client ID
 *  WALMART_CLIENT_SECRET – API client secret
 *  WALMART_SANDBOX       – 'true' for sandbox mode
 */
@Injectable()
export class WalmartAdapter implements ChannelAdapter {
  readonly channelName = 'walmart';
  private readonly logger = new Logger(WalmartAdapter.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly sandbox: boolean;
  private readonly baseUrl: string;
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('WALMART_CLIENT_ID', '');
    this.clientSecret = this.config.get<string>('WALMART_CLIENT_SECRET', '');
    this.sandbox = this.config.get<string>('WALMART_SANDBOX', 'true') === 'true';

    this.baseUrl = this.sandbox
      ? 'https://sandbox.walmartapis.com'
      : 'https://marketplace.walmartapis.com';

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'WM_SVC.NAME': 'MergeKart',
        'WM_QOS.CORRELATION_ID': '', // Set per-request
      },
    });
  }

  /* ─── OAuth (Walmart uses Client-Credentials flow) ─── */

  getAuthUrl(state: string): string {
    // Walmart uses API keys, not browser OAuth — this URL is for documentation/setup
    return `https://developer.walmart.com/account/generateKey?state=${state}`;
  }

  async exchangeCode(code: string): Promise<TokenSet> {
    // Walmart: code is the initial client secret confirmation
    // Get a token using client credentials
    return this.getClientCredentialsToken();
  }

  async refreshTokens(_refreshToken: string): Promise<TokenSet> {
    // Walmart tokens are short-lived; just get a new one
    return this.getClientCredentialsToken();
  }

  private async getClientCredentialsToken(): Promise<TokenSet> {
    const { data } = await axios.post(
      `${this.baseUrl}/v3/token`,
      new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'WM_SVC.NAME': 'MergeKart',
          'WM_QOS.CORRELATION_ID': crypto.randomUUID(),
        },
        auth: {
          username: this.clientId,
          password: this.clientSecret,
        },
      },
    );

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 900) * 1000),
      tokenType: data.token_type ?? 'Bearer',
    };
  }

  /* ─── Items (Walmart MP Items API v3) ─── */

  async publishListing(
    tokens: TokenSet,
    listingData: Record<string, unknown>,
    _storeContext?: StoreContext,
  ): Promise<ExternalListingResult> {
    try {
      const sku = (listingData['sku'] as string) || `MRGK-${Date.now()}`;

      // Walmart uses a feed-based approach: Items > Bulk Upload
      // For single-item, use the MP Items API
      const body = {
        sku,
        productIdentifiers: {
          productIdType: 'UPC',
          productId: (listingData['upc'] as string) || '',
        },
        productName: listingData['title'] ?? '',
        brand: listingData['brand'] ?? '',
        shortDescription: ((listingData['description'] as string) ?? '').substring(0, 1000),
        mainImageUrl: (listingData['imageUrls'] as string[])?.[0] ?? '',
        price: {
          currency: 'USD',
          amount: Number(listingData['price'] ?? 0),
        },
        shippingWeight: {
          value: Number(listingData['shippingWeight'] ?? 1),
          unit: 'LB',
        },
        category: this.mapCategory(listingData['categoryId'] as string),
        condition: this.mapCondition(listingData['condition'] as string),
        additionalAttributes: {
          mpn: listingData['mpn'] ?? '',
          partType: listingData['partType'] ?? '',
        },
      };

      const { data } = await this.http.post(
        '/v3/items',
        { items: [body] },
        {
          headers: {
            ...this.authHeaders(tokens),
            'WM_QOS.CORRELATION_ID': crypto.randomUUID(),
          },
        },
      );

      const feedId = data.feedId ?? '';

      return {
        externalId: sku,
        externalUrl: `https://www.walmart.com/ip/${sku}`,
        status: feedId ? 'active' : 'draft',
      };
    } catch (error: any) {
      this.logger.error(`Walmart publish failed: ${error.message}`);
      return {
        externalId: '',
        status: 'error',
        error: error?.response?.data?.errors?.[0]?.description ?? error.message,
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
      const updatePayload: Record<string, unknown> = { sku: externalId };

      if (listingData['title']) updatePayload['productName'] = listingData['title'];
      if (listingData['description']) updatePayload['shortDescription'] = (listingData['description'] as string).substring(0, 1000);
      if (listingData['price']) {
        updatePayload['price'] = { currency: 'USD', amount: Number(listingData['price']) };
      }

      const { data } = await this.http.put(
        `/v3/items/${encodeURIComponent(externalId)}`,
        updatePayload,
        {
          headers: {
            ...this.authHeaders(tokens),
            'WM_QOS.CORRELATION_ID': crypto.randomUUID(),
          },
        },
      );

      return {
        externalId,
        status: data.errors ? 'error' : 'active',
        error: data.errors?.[0]?.description,
      };
    } catch (error: any) {
      this.logger.error(`Walmart update failed: ${error.message}`);
      return {
        externalId,
        status: 'error',
        error: error?.response?.data?.errors?.[0]?.description ?? error.message,
      };
    }
  }

  async endListing(tokens: TokenSet, externalId: string, _storeContext?: StoreContext): Promise<void> {
    try {
      // Retire the item
      await this.http.delete(
        `/v3/items/${encodeURIComponent(externalId)}`,
        {
          headers: {
            ...this.authHeaders(tokens),
            'WM_QOS.CORRELATION_ID': crypto.randomUUID(),
          },
        },
      );
    } catch (error: any) {
      this.logger.error(`Walmart end listing failed (${externalId}): ${error.message}`);
      throw error;
    }
  }

  /* ─── Inventory (Walmart Inventory API) ─── */

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
          '/v3/inventory',
          {
            sku: item.externalId,
            quantity: {
              unit: 'EACH',
              amount: item.quantity,
            },
          },
          {
            params: { sku: item.externalId },
            headers: {
              ...this.authHeaders(tokens),
              'WM_QOS.CORRELATION_ID': crypto.randomUUID(),
            },
          },
        );
        succeeded++;
      } catch (error: any) {
        this.logger.warn(`Walmart inventory sync failed for ${item.externalId}: ${error.message}`);
        failed++;
      }
    }

    return { succeeded, failed };
  }

  /* ─── Orders (Walmart Orders API) ─── */

  async getRecentOrders(
    tokens: TokenSet,
    since: Date,
    _storeContext?: StoreContext,
  ): Promise<ChannelOrder[]> {
    try {
      const { data } = await this.http.get('/v3/orders', {
        params: {
          createdStartDate: since.toISOString(),
          status: 'Created',
          limit: 50,
        },
        headers: {
          ...this.authHeaders(tokens),
          'WM_QOS.CORRELATION_ID': crypto.randomUUID(),
        },
      });

      const orders: any[] = data.list?.elements?.order ?? [];
      return orders.map((o: any) => {
        const orderLine = o.orderLines?.orderLine?.[0];
        return {
          externalOrderId: o.purchaseOrderId,
          externalListingId: orderLine?.item?.sku ?? '',
          buyerUsername: o.shippingInfo?.postalAddress?.name ?? '',
          quantity: orderLine?.orderLineQuantity?.amount ?? 1,
          totalPrice: parseFloat(orderLine?.charges?.charge?.[0]?.chargeAmount?.amount ?? '0'),
          currency: orderLine?.charges?.charge?.[0]?.chargeAmount?.currency ?? 'USD',
          shippingAddress: o.shippingInfo?.postalAddress ?? {},
          orderedAt: new Date(o.orderDate),
          rawPayload: o,
        };
      });
    } catch (error: any) {
      this.logger.error(`Walmart fetch orders failed: ${error.message}`);
      return [];
    }
  }

  /* ─── Webhook ─── */

  verifyWebhookSignature(
    rawBody: Buffer,
    signature: string,
    secret: string,
  ): boolean {
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

  private authHeaders(tokens: TokenSet): Record<string, string> {
    return {
      'WM_SEC.ACCESS_TOKEN': tokens.accessToken,
    };
  }

  private mapCondition(condition?: string): string {
    const map: Record<string, string> = {
      new: 'New',
      'like new': 'New other',
      excellent: 'Remanufactured',
      'very good': 'Used - Good',
      good: 'Used - Fair',
      refurbished: 'Refurbished',
    };
    return map[(condition ?? 'New').toLowerCase()] ?? 'New';
  }

  private mapCategory(categoryId?: string): string {
    // Walmart uses pre-defined product types; default to Auto Parts
    return categoryId ?? 'Vehicle Parts & Accessories';
  }
}
