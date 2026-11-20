import { Repository } from 'typeorm';
import { ConnectedEbayAccount } from '../ebay/entities/connected-ebay-account.entity.js';
import { EbayAccountMarketplace } from '../ebay/entities/ebay-account-marketplace.entity.js';
import { EbayBusinessPolicy } from '../ebay/entities/ebay-business-policy.entity.js';
import type { ListingBuilderResult } from '../ebay/services/listing-builder.service.js';
import { SellerpunditAuthService } from './sellerpundit-auth.service.js';
import { SellerpunditHttpClient } from './sellerpundit-http.client.js';
import { SellerpunditMarketplaceRegistry } from './sellerpundit-marketplace.registry.js';
import { SellerpunditTokenSyncService } from './sellerpundit-token-sync.service.js';
import type { SellerpunditPublishResult } from './sellerpundit.types.js';
export declare class SellerpunditListingAdapter {
    private readonly auth;
    private readonly http;
    private readonly registry;
    private readonly tokenSync;
    private readonly mpRepo;
    private readonly policyRepo;
    constructor(auth: SellerpunditAuthService, http: SellerpunditHttpClient, registry: SellerpunditMarketplaceRegistry, tokenSync: SellerpunditTokenSyncService, mpRepo: Repository<EbayAccountMarketplace>, policyRepo: Repository<EbayBusinessPolicy>);
    publish(built: ListingBuilderResult, account: ConnectedEbayAccount, marketplaceId: string): Promise<SellerpunditPublishResult>;
    private asRecord;
    private parseBulkCreateResponse;
    private collectErrors;
    private resolveCompliantReturnPolicyId;
    private missingPolicyHint;
    private conditionIdFromEnum;
}
