import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Store } from '../entities/store.entity.js';
import { ChannelConnection } from '../entities/channel-connection.entity.js';
import { TokenEncryptionService } from '../token-encryption.service.js';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
import { SellerpunditTokenSyncService } from '../../integrations/sellerpundit/sellerpundit-token-sync.service.js';
import type { EbayApiConfig } from './ebay-api.types.js';
export declare class EbayAuthService {
    private readonly configService;
    private readonly encryption;
    private readonly sellerpunditTokens;
    private readonly connectionRepo;
    private readonly storeRepo;
    private readonly connectedAccountRepo;
    private readonly logger;
    private readonly config;
    private readonly http;
    private readonly refreshBufferMs;
    constructor(configService: ConfigService, encryption: TokenEncryptionService, sellerpunditTokens: SellerpunditTokenSyncService, connectionRepo: Repository<ChannelConnection>, storeRepo: Repository<Store>, connectedAccountRepo: Repository<ConnectedEbayAccount>);
    getApiConfig(): EbayApiConfig;
    private getBasicAuth;
    private findLinkedAccount;
    getApiBaseUrlForStore(storeId: string): Promise<string>;
    getAccessToken(storeId: string, options?: {
        forceRefresh?: boolean;
    }): Promise<string>;
    private wrapTokenError;
    getApplicationToken(): Promise<string>;
    initiateOAuth(state: string): {
        authUrl: string;
        state: string;
    };
    handleOAuthCallback(code: string, state: string, userId: string): Promise<{
        connectionId: string;
        storeId: string;
    }>;
    refreshToken(storeId: string): Promise<void>;
    private refreshAndStore;
}
