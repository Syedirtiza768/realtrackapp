import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { TokenEncryptionService } from '../../channels/token-encryption.service.js';
import { OrganizationSellerpunditConfig } from './entities/organization-sellerpundit-config.entity.js';
import { SellerpunditHttpClient } from './sellerpundit-http.client.js';
export declare class SellerpunditAuthService {
    private readonly config;
    private readonly http;
    private readonly encryption;
    private readonly configRepo;
    private readonly logger;
    private readonly jwtByOrg;
    constructor(config: ConfigService, http: SellerpunditHttpClient, encryption: TokenEncryptionService, configRepo: Repository<OrganizationSellerpunditConfig>);
    getJwt(organizationId: string): Promise<string>;
    invalidateJwt(organizationId: string): void;
    private resolveCredentials;
    upsertConfig(organizationId: string, patch: Partial<{
        enabled: boolean;
        credentialsEncrypted: string | null;
        lastJwtRefreshAt: Date | null;
        lastSyncAt: Date | null;
        lastError: string | null;
    }>): Promise<OrganizationSellerpunditConfig>;
    getConfigView(organizationId: string): Promise<{
        enabled: boolean;
        configured: boolean;
        hasOrgCredentials: boolean;
        lastJwtRefreshAt: Date | null;
        lastSyncAt: Date | null;
        lastError: string | null;
    }>;
    saveOrgCredentials(organizationId: string, email: string, password: string): Promise<void>;
    private decodeJwtExpiry;
}
