import { Repository } from 'typeorm';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayAccountMarketplace } from '../entities/ebay-account-marketplace.entity.js';
import { EbayMarketplaceConfigService } from './ebay-marketplace-config.service.js';
import { EbayAccountTokenService } from './ebay-account-token.service.js';
import { SellerpunditPolicySyncService } from '../../sellerpundit/sellerpundit-policy-sync.service.js';
import { SellerpunditTokenSyncService } from '../../sellerpundit/sellerpundit-token-sync.service.js';
import { EbayInventoryApiService } from '../../../channels/ebay/ebay-inventory-api.service.js';
import { CatalogPublishResolverService } from './catalog-publish-resolver.service.js';
import { VerticalsService } from '../../../verticals/verticals.service.js';
export type ValidationStatus = 'ready' | 'warnings' | 'blocked';
export interface ListingValidationResult {
    status: ValidationStatus;
    errors: string[];
    warnings: string[];
    requiredActions: string[];
}
export declare class EbayListingValidationService {
    private readonly marketplaceConfig;
    private readonly tokens;
    private readonly sellerpunditPolicies;
    private readonly sellerpunditTokens;
    private readonly inventoryApi;
    private readonly publishResolver;
    private readonly verticals;
    private readonly accountRepo;
    private readonly mpRepo;
    private readonly logger;
    constructor(marketplaceConfig: EbayMarketplaceConfigService, tokens: EbayAccountTokenService, sellerpunditPolicies: SellerpunditPolicySyncService, sellerpunditTokens: SellerpunditTokenSyncService, inventoryApi: EbayInventoryApiService, publishResolver: CatalogPublishResolverService, verticals: VerticalsService, accountRepo: Repository<ConnectedEbayAccount>, mpRepo: Repository<EbayAccountMarketplace>);
    validatePublish(params: {
        organizationId: string;
        catalogProductId: string;
        ebayAccountId: string;
        marketplaceId: string;
        policyOverrides?: Record<string, unknown>;
    }): Promise<ListingValidationResult>;
}
