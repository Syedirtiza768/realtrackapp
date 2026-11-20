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
export interface StoreContext {
    storeId: string;
    externalStoreId?: string;
    storeName?: string;
    config?: Record<string, unknown>;
}
export interface ChannelAdapter {
    readonly channelName: string;
    getAuthUrl(state: string): string;
    exchangeCode(code: string): Promise<TokenSet>;
    refreshTokens(refreshToken: string): Promise<TokenSet>;
    publishListing(tokens: TokenSet, listingData: Record<string, unknown>, storeContext?: StoreContext): Promise<ExternalListingResult>;
    updateListing(tokens: TokenSet, externalId: string, listingData: Record<string, unknown>, storeContext?: StoreContext): Promise<ExternalListingResult>;
    endListing(tokens: TokenSet, externalId: string, storeContext?: StoreContext): Promise<void>;
    syncInventory(tokens: TokenSet, items: InventorySyncItem[], storeContext?: StoreContext): Promise<{
        succeeded: number;
        failed: number;
    }>;
    getRecentOrders(tokens: TokenSet, since: Date, storeContext?: StoreContext): Promise<ChannelOrder[]>;
    verifyWebhookSignature(rawBody: Buffer, signature: string, secret: string): boolean;
}
