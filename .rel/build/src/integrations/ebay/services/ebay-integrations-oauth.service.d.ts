import { DataSource, Repository } from 'typeorm';
import { ChannelConnection } from '../../../channels/entities/channel-connection.entity.js';
import { Store } from '../../../channels/entities/store.entity.js';
import { TokenEncryptionService } from '../../../channels/token-encryption.service.js';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayOAuthToken } from '../entities/ebay-oauth-token.entity.js';
import { EbayAccountMarketplace } from '../entities/ebay-account-marketplace.entity.js';
import { EbayBusinessPolicy } from '../entities/ebay-business-policy.entity.js';
import { EbayOAuthStateStore } from './ebay-oauth-state.store.js';
import { EbayAccountTokenService } from './ebay-account-token.service.js';
import { EbayMarketplaceConfigService } from './ebay-marketplace-config.service.js';
import { EbayPolicySyncService } from './ebay-policy-sync.service.js';
import { ListingActionLogWriterService } from './listing-action-log-writer.service.js';
import type { ProductVertical } from '../../../verticals/vertical.types.js';
export declare function isPlaceholderEbayUserId(value: string | null | undefined): boolean;
export declare function identityMatchesAccount(account: Pick<ConnectedEbayAccount, 'ebayUserId' | 'ebayUsername'>, identity: {
    userId: string | null;
    username: string | null;
}): boolean;
export declare class EbayOAuthCallbackFailure extends Error {
    readonly reason: 'conflict' | 'oauth_failed';
    readonly redirectPath: string;
    readonly userMessage: string | null;
    constructor(message: string, reason: 'conflict' | 'oauth_failed', redirectPath: string, userMessage: string | null);
}
export declare class EbayIntegrationsOAuthService {
    private readonly stateStore;
    private readonly tokenService;
    private readonly encryption;
    private readonly mpConfig;
    private readonly dataSource;
    private readonly logWriter;
    private readonly policySync;
    private readonly connectionRepo;
    private readonly storeRepo;
    private readonly accountRepo;
    private readonly oauthRepo;
    private readonly mpRepo;
    private readonly policyRepo;
    private readonly logger;
    constructor(stateStore: EbayOAuthStateStore, tokenService: EbayAccountTokenService, encryption: TokenEncryptionService, mpConfig: EbayMarketplaceConfigService, dataSource: DataSource, logWriter: ListingActionLogWriterService, policySync: EbayPolicySyncService, connectionRepo: Repository<ChannelConnection>, storeRepo: Repository<Store>, accountRepo: Repository<ConnectedEbayAccount>, oauthRepo: Repository<EbayOAuthToken>, mpRepo: Repository<EbayAccountMarketplace>, policyRepo: Repository<EbayBusinessPolicy>);
    startOAuth(input: {
        userId: string;
        organizationId: string;
        internalStoreId: string | null;
        marketplaceId: string;
        environment: 'sandbox' | 'production';
        accountDisplayName: string;
        vertical?: ProductVertical;
        reconnectAccountId?: string | null;
    }): Promise<{
        authUrl: string;
        state: string;
    }>;
    handleCallback(params: {
        code: string;
        state: string;
        ipAddress?: string | null;
        userAgent?: string | null;
    }): Promise<{
        connectedEbayAccountId: string;
        redirectUrl?: string;
    }>;
    private handlePendingCallback;
    private reconnectExistingAccount;
    private findExistingSellerAccount;
    private reauthorizeInPlace;
    private tokenSeesCachedPolicies;
    private accountsOwningTokenPolicies;
    private fetchSellerIdentity;
    private queuePolicySync;
}
