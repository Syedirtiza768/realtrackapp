import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import type Redis from 'ioredis';
import { TokenEncryptionService } from '../../../channels/token-encryption.service.js';
import { ChannelConnection } from '../../../channels/entities/channel-connection.entity.js';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayOAuthToken } from '../entities/ebay-oauth-token.entity.js';
import { SellerpunditTokenSyncService } from '../../sellerpundit/sellerpundit-token-sync.service.js';
interface TokenBlob {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    scope?: string;
    tokenType?: string;
}
export declare class EbayAccountTokenService {
    private readonly config;
    private readonly encryption;
    private readonly redis;
    private readonly tokenRepo;
    private readonly accountRepo;
    private readonly connectionRepo;
    private readonly sellerpunditTokens;
    private readonly logger;
    private readonly refreshBufferMs;
    constructor(config: ConfigService, encryption: TokenEncryptionService, redis: Redis, tokenRepo: Repository<EbayOAuthToken>, accountRepo: Repository<ConnectedEbayAccount>, connectionRepo: Repository<ChannelConnection>, sellerpunditTokens: SellerpunditTokenSyncService);
    private getOAuthBase;
    private getAuthHost;
    private getRedirectUri;
    private basicAuthHeader;
    getValidAccessToken(ebayAccountId: string): Promise<string>;
    private refreshLocked;
    getDefaultScopes(): string[];
    buildAuthorizeUrl(params: {
        state: string;
        environment: 'sandbox' | 'production';
    }): string;
    exchangeCode(params: {
        code: string;
        environment: 'sandbox' | 'production';
    }): Promise<{
        tokens: TokenBlob;
    }>;
}
export {};
