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
} from '../../channel-adapter.interface.js';

@Injectable()
export class EbayAdapter implements ChannelAdapter {
  readonly channelName = 'ebay';
  private readonly logger = new Logger(EbayAdapter.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly sandbox: boolean;
  private readonly baseUrl: string;
  private readonly authUrl: string;
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('EBAY_CLIENT_ID', '');
    this.clientSecret = this.config.get<string>('EBAY_CLIENT_SECRET', '');
    this.redirectUri = this.config.get<string>('EBAY_REDIRECT_URI', '');
    this.sandbox = this.config.get<string>('EBAY_SANDBOX', 'true') === 'true';

    this.baseUrl = this.sandbox
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';
    this.authUrl = this.sandbox
      ? 'https://auth.sandbox.ebay.com'
      : 'https://auth.ebay.com';

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  getAuthUrl(state: string): string {
    const scopes = [
      'https://api.ebay.com/oauth/api_scope',
      'https://api.ebay.com/oauth/api_scope/sell.inventory',
      'https://api.ebay.com/oauth/api_scope/sell.account',
      'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
    ].join('%20');

    return (
      `${this.authUrl}/oauth2/authorize?` +
      `client_id=${this.clientId}` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
      `&response_type=code` +
      `&scope=${scopes}` +
      `&state=${state}`
    );
  }

  async exchangeCode(code: string): Promise<TokenSet> {
    const basicAuth = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    const { data } = await this.http.post(
      '/identity/v1/oauth2/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
      }).toString(),
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
      tokenType: data.token_type,
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenSet> {
    const basicAuth = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    const { data } = await this.http.post(
      '/identity/v1/oauth2/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory',
      }).toString(),
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
      tokenType: data.token_type,
    };
  }

  async publishListing(
    tokens: TokenSet,
    listingData: Record<string, unknown>,
  ): Promise<ExternalListingResult> {
    try {
      // Step 1: Create inventory item
      const sku = (listingData['sku'] as string) || `SKU-${Date.now()}`;
      await this.http.put(
        `/sell/inventory/v1/inventory_item/${sku}`,
        {
          availability: {
            shipToLocationAvailability: {
              quantity: listingData['quantity'] ?? 1,
            },
          },
          condition: listingData['condition'] ?? 'USED_EXCELLENT',
          product: {
            title: listingData['title'],
            description: listingData['description'],
            imageUrls: listingData['imageUrls'] ?? [],
            aspects: listingData['aspects'] ?? {},
          },
        },
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
      );

      // Step 2: Create offer
      const { data: offerData } = await this.http.post(
        '/sell/inventory/v1/offer',
        {
          sku,
          marketplaceId: 'EBAY_MOTORS_US',
          format: 'FIXED_PRICE',
          listingDescription: listingData['description'],
          pricingSummary: {
            price: {
              value: String(listingData['price']),
              currency: 'USD',
            },
          },
          categoryId: listingData['categoryId'],
          merchantLocationKey: listingData['locationKey'] ?? 'default',
        },
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
      );

      // Step 3: Publish offer
      const { data: publishData } = await this.http.post(
        `/sell/inventory/v1/offer/${offerData.offerId}/publish`,
        {},
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
      );

      return {
        externalId: publishData.listingId,
        externalUrl: `https://www.ebay.com/itm/${publishData.listingId}`,
        status: 'active',
      };
    } catch (error: any) {
      this.logger.error(`eBay publish failed: ${error.message}`);
      return {
        externalId: '',
        status: 'error',
        error: error?.response?.data?.errors?.[0]?.message ?? error.message,
      };
    }
  }

  async updateListing(
    tokens: TokenSet,
    externalId: string,
    listingData: Record<string, unknown>,
  ): Promise<ExternalListingResult> {
    try {
      const sku = (listingData['sku'] as string) || externalId;
      await this.http.put(
        `/sell/inventory/v1/inventory_item/${sku}`,
        {
          product: {
            title: listingData['title'],
            description: listingData['description'],
            imageUrls: listingData['imageUrls'] ?? [],
          },
        },
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
      );

      return { externalId, status: 'active' };
    } catch (error: any) {
      return {
        externalId,
        status: 'error',
        error: error?.response?.data?.errors?.[0]?.message ?? error.message,
      };
    }
  }

  async endListing(tokens: TokenSet, externalId: string): Promise<void> {
    await this.http.post(
      `/sell/inventory/v1/offer/${externalId}/withdraw`,
      {},
      { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
    );
  }

  async syncInventory(
    tokens: TokenSet,
    items: InventorySyncItem[],
  ): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0;
    let failed = 0;

    for (const item of items) {
      try {
        await this.http.put(
          `/sell/inventory/v1/inventory_item/${item.externalId}`,
          {
            availability: {
              shipToLocationAvailability: { quantity: item.quantity },
            },
          },
          { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
        );
        succeeded++;
      } catch {
        failed++;
      }
    }

    return { succeeded, failed };
  }

  async getRecentOrders(
    tokens: TokenSet,
    since: Date,
  ): Promise<ChannelOrder[]> {
    const { data } = await this.http.get('/sell/fulfillment/v1/order', {
      params: {
        filter: `creationdate:[${since.toISOString()}..${new Date().toISOString()}]`,
        limit: 50,
      },
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    return (data.orders ?? []).map((o: any) => ({
      externalOrderId: o.orderId,
      externalListingId: o.lineItems?.[0]?.legacyItemId ?? '',
      buyerUsername: o.buyer?.username ?? '',
      quantity: o.lineItems?.reduce((sum: number, li: any) => sum + li.quantity, 0) ?? 1,
      totalPrice: parseFloat(o.pricingSummary?.total?.value ?? '0'),
      currency: o.pricingSummary?.total?.currency ?? 'USD',
      shippingAddress: o.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo ?? {},
      orderedAt: new Date(o.creationDate),
      rawPayload: o,
    }));
  }

  verifyWebhookSignature(
    rawBody: Buffer,
    signature: string,
    secret: string,
  ): boolean {
    const hash = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');
    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(signature),
    );
  }
}
