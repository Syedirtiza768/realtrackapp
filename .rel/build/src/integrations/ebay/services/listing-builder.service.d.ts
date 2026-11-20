import type { ProductVertical } from '../../../verticals/vertical.types.js';
import { VerticalsService } from '../../../verticals/verticals.service.js';
import { Repository } from 'typeorm';
import { ListingStoreOverride } from '../entities/listing-store-override.entity.js';
import { EbayAccountMarketplace } from '../entities/ebay-account-marketplace.entity.js';
import { EbayBusinessPolicy } from '../entities/ebay-business-policy.entity.js';
import type { PublishRequest } from '../../../channels/ebay/ebay-publish.service.js';
import { EbayMarketplaceConfigService } from './ebay-marketplace-config.service.js';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { CatalogPublishResolverService } from './catalog-publish-resolver.service.js';
import { EbayInventoryApiService } from '../../../channels/ebay/ebay-inventory-api.service.js';
export interface ListingBuilderResult {
    publishRequest: PublishRequest;
    warnings: string[];
    blockingErrors: string[];
}
export declare class ListingBuilderService {
    private readonly overrideRepo;
    private readonly mpRepo;
    private readonly policyRepo;
    private readonly accountRepo;
    private readonly marketplaceConfig;
    private readonly publishResolver;
    private readonly inventoryApi;
    private readonly verticals?;
    constructor(overrideRepo: Repository<ListingStoreOverride>, mpRepo: Repository<EbayAccountMarketplace>, policyRepo: Repository<EbayBusinessPolicy>, accountRepo: Repository<ConnectedEbayAccount>, marketplaceConfig: EbayMarketplaceConfigService, publishResolver: CatalogPublishResolverService, inventoryApi: EbayInventoryApiService, verticals?: VerticalsService | undefined);
    build(params: {
        catalogProductId: string;
        sourceListingId?: string;
        ebayAccountId: string;
        marketplaceId: string;
        listingRecordId: string;
        storeId: string;
        vertical?: ProductVertical;
        policyOverrides?: Record<string, unknown>;
        readOnly?: boolean;
    }): Promise<ListingBuilderResult>;
    private emptyResult;
}
