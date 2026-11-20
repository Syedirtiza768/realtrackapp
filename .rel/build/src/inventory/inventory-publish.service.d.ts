import { Repository } from 'typeorm';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { Store } from '../channels/entities/store.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { ListingStoreOverride } from '../integrations/ebay/entities/listing-store-override.entity.js';
import { EbayMultiStoreListingService } from '../integrations/ebay/services/ebay-multi-store-listing.service.js';
export interface PublishTarget {
    storeId: string;
    marketplaceId: string;
    policyOverrides?: {
        fulfillmentPolicyId?: string;
        paymentPolicyId?: string;
        returnPolicyId?: string;
        merchantLocationKey?: string;
    };
}
export interface PublishResult {
    jobId: string;
    status: string;
    targets: Array<{
        storeId: string;
        marketplaceId: string;
        status: 'eligible' | 'skipped';
        errors?: string[];
    }>;
}
export declare class InventoryPublishService {
    private readonly listingRepo;
    private readonly productRepo;
    private readonly storeRepo;
    private readonly ebayAccountRepo;
    private readonly overrideRepo;
    private readonly multiStoreListing;
    private readonly logger;
    constructor(listingRepo: Repository<ListingRecord>, productRepo: Repository<CatalogProduct>, storeRepo: Repository<Store>, ebayAccountRepo: Repository<ConnectedEbayAccount>, overrideRepo: Repository<ListingStoreOverride>, multiStoreListing: EbayMultiStoreListingService);
    publish(listingId: string, userId: string, targets: PublishTarget[]): Promise<PublishResult>;
    private ensureCatalogProduct;
    private upsertPolicyOverrides;
    private parseImageUrls;
}
