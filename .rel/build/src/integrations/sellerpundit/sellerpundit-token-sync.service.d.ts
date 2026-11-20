import { Repository } from 'typeorm';
import { TokenEncryptionService } from '../../channels/token-encryption.service.js';
import { ChannelConnection } from '../../channels/entities/channel-connection.entity.js';
import { Store } from '../../channels/entities/store.entity.js';
import { ConnectedEbayAccount } from '../ebay/entities/connected-ebay-account.entity.js';
import { EbayOAuthToken } from '../ebay/entities/ebay-oauth-token.entity.js';
import { SellerpunditAuthService } from './sellerpundit-auth.service.js';
import { SellerpunditHttpClient } from './sellerpundit-http.client.js';
import { SellerpunditMarketplaceRegistry } from './sellerpundit-marketplace.registry.js';
import type { SellerpunditTokenRow } from './sellerpundit.types.js';
export declare class SellerpunditTokenSyncService {
    private readonly auth;
    private readonly http;
    private readonly encryption;
    private readonly registry;
    private readonly accountRepo;
    private readonly tokenRepo;
    private readonly connectionRepo;
    private readonly storeRepo;
    private readonly logger;
    constructor(auth: SellerpunditAuthService, http: SellerpunditHttpClient, encryption: TokenEncryptionService, registry: SellerpunditMarketplaceRegistry, accountRepo: Repository<ConnectedEbayAccount>, tokenRepo: Repository<EbayOAuthToken>, connectionRepo: Repository<ChannelConnection>, storeRepo: Repository<Store>);
    ensureFreshAccessToken(ebayAccountId: string, options?: {
        force?: boolean;
    }): Promise<string>;
    refreshTokenFromSellerpundit(account: ConnectedEbayAccount): Promise<void>;
    persistTokenRow(account: ConnectedEbayAccount, row: SellerpunditTokenRow): Promise<void>;
    validateAccountEbayToken(ebayAccountId: string, marketplaceId: string): Promise<boolean>;
    private resolveProbeMarketplaceId;
    private probeEbayAccessToken;
    unwrapTokenList(raw: unknown): SellerpunditTokenRow[];
}
