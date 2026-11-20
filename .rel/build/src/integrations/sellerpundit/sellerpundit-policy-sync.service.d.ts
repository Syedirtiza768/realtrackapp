import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { ConnectedEbayAccount } from '../ebay/entities/connected-ebay-account.entity.js';
import { EbayBusinessPolicy } from '../ebay/entities/ebay-business-policy.entity.js';
import { EbayAccountMarketplace } from '../ebay/entities/ebay-account-marketplace.entity.js';
import { ListingActionLogWriterService } from '../ebay/services/listing-action-log-writer.service.js';
import { SellerpunditAuthService } from './sellerpundit-auth.service.js';
import { SellerpunditHttpClient } from './sellerpundit-http.client.js';
export declare class SellerpunditPolicySyncService {
    private readonly config;
    private readonly auth;
    private readonly http;
    private readonly accountRepo;
    private readonly policyRepo;
    private readonly mpRepo;
    private readonly logWriter;
    private readonly logger;
    constructor(config: ConfigService, auth: SellerpunditAuthService, http: SellerpunditHttpClient, accountRepo: Repository<ConnectedEbayAccount>, policyRepo: Repository<EbayBusinessPolicy>, mpRepo: Repository<EbayAccountMarketplace>, logWriter: ListingActionLogWriterService);
    policyMaxAgeMs(): number;
    ensurePoliciesFresh(ebayAccountId: string, organizationId: string, marketplaceId: string): Promise<{
        ok: boolean;
        synced: number;
        message: string;
    }>;
    syncPolicies(ebayAccountId: string, organizationId: string, userId?: string | null, onlyMarketplaceId?: string): Promise<{
        ok: boolean;
        synced: number;
        message: string;
    }>;
    private fetchPolicies;
    private parsePolicies;
    private unwrapArray;
}
