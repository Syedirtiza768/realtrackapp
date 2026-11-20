import { ConfigService } from '@nestjs/config';
import type { ChannelAdapter, TokenSet, ExternalListingResult, InventorySyncItem, ChannelOrder, StoreContext } from '../../channel-adapter.interface.js';
export declare class EbayAdapter implements ChannelAdapter {
    private readonly config;
    readonly channelName = "ebay";
    private readonly logger;
    private readonly clientId;
    private readonly clientSecret;
    private readonly redirectUri;
    private readonly sandbox;
    private readonly baseUrl;
    private readonly authUrl;
    private readonly http;
    constructor(config: ConfigService);
    getAuthUrl(state: string): string;
    exchangeLegacyToken(legacyToken: string): TokenSet & {
        legacyToken: string;
    };
    exchangeCode(code: string): Promise<TokenSet>;
    refreshTokens(refreshToken: string): Promise<TokenSet>;
    publishListing(tokens: TokenSet, listingData: Record<string, unknown>, _storeContext?: StoreContext): Promise<ExternalListingResult>;
    updateListing(tokens: TokenSet, externalId: string, listingData: Record<string, unknown>, _storeContext?: StoreContext): Promise<ExternalListingResult>;
    endListing(tokens: TokenSet, externalId: string, _storeContext?: StoreContext): Promise<void>;
    syncInventory(tokens: TokenSet, items: InventorySyncItem[], _storeContext?: StoreContext): Promise<{
        succeeded: number;
        failed: number;
    }>;
    getRecentOrders(tokens: TokenSet, since: Date, _storeContext?: StoreContext): Promise<ChannelOrder[]>;
    verifyWebhookSignature(rawBody: Buffer, signature: string, secret: string): boolean;
}
