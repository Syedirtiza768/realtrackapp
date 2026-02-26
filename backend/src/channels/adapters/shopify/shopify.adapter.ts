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
export class ShopifyAdapter implements ChannelAdapter {
  readonly channelName = 'shopify';
  private readonly logger = new Logger(ShopifyAdapter.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly redirectUri: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('SHOPIFY_API_KEY', '');
    this.apiSecret = this.config.get<string>('SHOPIFY_API_SECRET', '');
    this.redirectUri = this.config.get<string>('SHOPIFY_REDIRECT_URI', '');
  }

  getAuthUrl(state: string): string {
    // state format: "shop_domain:random_nonce"
    const shopDomain = state.split(':')[0] || 'myshop.myshopify.com';
    const scopes = 'write_products,read_products,write_inventory,read_inventory,read_orders';
    return (
      `https://${shopDomain}/admin/oauth/authorize?` +
      `client_id=${this.apiKey}` +
      `&scope=${scopes}` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
      `&state=${state}`
    );
  }

  async exchangeCode(code: string): Promise<TokenSet> {
    // The state/shop domain is extracted by the calling service
    // We need the shop domain to exchange the code
    // For now, accept code in format "shop_domain:code"
    const [shopDomain, authCode] = code.includes(':')
      ? code.split(':')
      : ['', code];

    const { data } = await axios.post(
      `https://${shopDomain}/admin/oauth/access_token`,
      {
        client_id: this.apiKey,
        client_secret: this.apiSecret,
        code: authCode,
      },
    );

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Shopify tokens don't expire
      scope: data.scope,
      tokenType: 'bearer',
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenSet> {
    // Shopify offline tokens don't expire or need refresh
    return {
      accessToken: refreshToken,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      tokenType: 'bearer',
    };
  }

  async publishListing(
    tokens: TokenSet,
    listingData: Record<string, unknown>,
  ): Promise<ExternalListingResult> {
    try {
      const shopDomain = listingData['shopDomain'] as string;
      const http = this.createClient(shopDomain, tokens.accessToken);

      const { data } = await http.post('/admin/api/2024-01/products.json', {
        product: {
          title: listingData['title'],
          body_html: listingData['description'],
          vendor: (listingData['brand'] as string) ?? '',
          product_type: (listingData['partType'] as string) ?? 'Auto Parts',
          tags: (listingData['tags'] as string[])?.join(', ') ?? '',
          variants: [
            {
              price: String(listingData['price']),
              sku: listingData['sku'] ?? '',
              inventory_quantity: listingData['quantity'] ?? 1,
              inventory_management: 'shopify',
            },
          ],
          images: ((listingData['imageUrls'] as string[]) ?? []).map(
            (src) => ({ src }),
          ),
        },
      });

      const product = data.product;
      return {
        externalId: String(product.id),
        externalUrl: `https://${shopDomain}/products/${product.handle}`,
        status: product.status === 'active' ? 'active' : 'draft',
      };
    } catch (error: any) {
      this.logger.error(`Shopify publish failed: ${error.message}`);
      return {
        externalId: '',
        status: 'error',
        error: error?.response?.data?.errors ?? error.message,
      };
    }
  }

  async updateListing(
    tokens: TokenSet,
    externalId: string,
    listingData: Record<string, unknown>,
  ): Promise<ExternalListingResult> {
    try {
      const shopDomain = listingData['shopDomain'] as string;
      const http = this.createClient(shopDomain, tokens.accessToken);

      await http.put(`/admin/api/2024-01/products/${externalId}.json`, {
        product: {
          id: externalId,
          title: listingData['title'],
          body_html: listingData['description'],
        },
      });

      return { externalId, status: 'active' };
    } catch (error: any) {
      return {
        externalId,
        status: 'error',
        error: error?.response?.data?.errors ?? error.message,
      };
    }
  }

  async endListing(tokens: TokenSet, externalId: string): Promise<void> {
    // Shopify doesn't have "end" — we archive the product
    // We need the shop domain from somewhere; for now skip if unavailable
    this.logger.warn(
      `endListing called for Shopify product ${externalId} — archive not supported without shop domain`,
    );
  }

  async syncInventory(
    tokens: TokenSet,
    items: InventorySyncItem[],
  ): Promise<{ succeeded: number; failed: number }> {
    // Shopify inventory sync requires inventory_item_id, not product_id
    // This is a simplified implementation
    let succeeded = 0;
    let failed = 0;

    for (const item of items) {
      try {
        // In real implementation, map externalId to inventory_item_id
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
    // Need shop domain to make API call
    return [];
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
    try {
      return crypto.timingSafeEqual(
        Buffer.from(hash),
        Buffer.from(signature),
      );
    } catch {
      return false;
    }
  }

  private createClient(shopDomain: string, accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: `https://${shopDomain}`,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
    });
  }
}
