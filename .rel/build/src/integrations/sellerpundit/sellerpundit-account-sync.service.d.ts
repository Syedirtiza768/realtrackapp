import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { ChannelConnection } from '../../channels/entities/channel-connection.entity.js';
import { Store } from '../../channels/entities/store.entity.js';
import { TokenEncryptionService } from '../../channels/token-encryption.service.js';
import { ConnectedEbayAccount } from '../ebay/entities/connected-ebay-account.entity.js';
import { EbayOAuthToken } from '../ebay/entities/ebay-oauth-token.entity.js';
import { EbayAccountMarketplace } from '../ebay/entities/ebay-account-marketplace.entity.js';
import { EbayMarketplaceConfigService } from '../ebay/services/ebay-marketplace-config.service.js';
import { ListingActionLogWriterService } from '../ebay/services/listing-action-log-writer.service.js';
import { SellerpunditAuthService } from './sellerpundit-auth.service.js';
import { SellerpunditHttpClient } from './sellerpundit-http.client.js';
import { SellerpunditMarketplaceRegistry } from './sellerpundit-marketplace.registry.js';
import { SellerpunditTokenSyncService } from './sellerpundit-token-sync.service.js';
export declare class SellerpunditAccountSyncService {
    private readonly config;
    private readonly auth;
    private readonly http;
    private readonly tokenSync;
    private readonly encryption;
    private readonly mpConfig;
    private readonly registry;
    private readonly dataSource;
    private readonly logWriter;
    private readonly accountRepo;
    private readonly connectionRepo;
    private readonly storeRepo;
    private readonly oauthRepo;
    private readonly mpRepo;
    private readonly logger;
    constructor(config: ConfigService, auth: SellerpunditAuthService, http: SellerpunditHttpClient, tokenSync: SellerpunditTokenSyncService, encryption: TokenEncryptionService, mpConfig: EbayMarketplaceConfigService, registry: SellerpunditMarketplaceRegistry, dataSource: DataSource, logWriter: ListingActionLogWriterService, accountRepo: Repository<ConnectedEbayAccount>, connectionRepo: Repository<ChannelConnection>, storeRepo: Repository<Store>, oauthRepo: Repository<EbayOAuthToken>, mpRepo: Repository<EbayAccountMarketplace>);
    syncStores(organizationId: string, userId: string | null): Promise<{
        imported: number;
        updated: number;
        skipped: number;
        accounts: string[];
    }>;
    private createAccountFromToken;
    private alignAccountMarketplace;
    testConnection(organizationId: string): Promise<{
        ok: boolean;
        storeCount: number;
    }>;
}
