/**
 * Channel Adapter Interface — Module 4.
 * Each marketplace (eBay, Shopify, etc.) implements this contract.
 */

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope?: string;
  tokenType?: string;
}

export interface ExternalListingResult {
  externalId: string;
  externalUrl?: string;
  status: 'active' | 'ended' | 'draft' | 'error';
  error?: string;
}

export interface InventorySyncItem {
  externalId: string;
  quantity: number;
  price?: number;
}

export interface ChannelOrder {
  externalOrderId: string;
  externalListingId: string;
  buyerUsername?: string;
  quantity: number;
  totalPrice: number;
  currency: string;
  shippingAddress?: Record<string, unknown>;
  orderedAt: Date;
  rawPayload: Record<string, unknown>;
}

export interface ChannelAdapter {
  readonly channelName: string;

  /** Build the OAuth authorization URL for the user to visit */
  getAuthUrl(state: string): string;

  /** Exchange the OAuth callback code for tokens */
  exchangeCode(code: string): Promise<TokenSet>;

  /** Refresh an expired access token */
  refreshTokens(refreshToken: string): Promise<TokenSet>;

  /** Publish a listing to the marketplace */
  publishListing(
    tokens: TokenSet,
    listingData: Record<string, unknown>,
  ): Promise<ExternalListingResult>;

  /** Update an existing listing on the marketplace */
  updateListing(
    tokens: TokenSet,
    externalId: string,
    listingData: Record<string, unknown>,
  ): Promise<ExternalListingResult>;

  /** End / deactivate a listing */
  endListing(tokens: TokenSet, externalId: string): Promise<void>;

  /** Sync inventory quantities in bulk */
  syncInventory(
    tokens: TokenSet,
    items: InventorySyncItem[],
  ): Promise<{ succeeded: number; failed: number }>;

  /** Pull recent orders for fulfillment */
  getRecentOrders(
    tokens: TokenSet,
    since: Date,
  ): Promise<ChannelOrder[]>;

  /** Verify the webhook signature (returns true if valid) */
  verifyWebhookSignature(
    rawBody: Buffer,
    signature: string,
    secret: string,
  ): boolean;
}
