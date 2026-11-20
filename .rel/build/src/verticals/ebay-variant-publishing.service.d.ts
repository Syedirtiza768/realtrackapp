import { Repository } from 'typeorm';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';
import { EbayInventoryApiService } from '../channels/ebay/ebay-inventory-api.service.js';
import type { EbayInventoryItemGroup } from '../channels/ebay/ebay-api.types.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { ProductFamily } from './entities/product-family.entity.js';
import { ProductVariant } from './entities/product-variant.entity.js';
import { VariantMarketplaceMapping } from './entities/variant-marketplace-mapping.entity.js';
export type VariantFamilyPublishInput = {
    organizationId: string;
    familyId: string;
    storeId: string;
    ebayAccountId: string;
    marketplaceId: string;
    categoryId: string;
    merchantLocationKey: string;
    fulfillmentPolicyId: string;
    paymentPolicyId: string;
    returnPolicyId: string;
    currency?: string;
};
export declare class EbayVariantPublishingService {
    private readonly featureFlags;
    private readonly inventoryApi;
    private readonly familyRepo;
    private readonly variantRepo;
    private readonly mappingRepo;
    private readonly productRepo;
    private readonly accountRepo;
    constructor(featureFlags: FeatureFlagService, inventoryApi: EbayInventoryApiService, familyRepo: Repository<ProductFamily>, variantRepo: Repository<ProductVariant>, mappingRepo: Repository<VariantMarketplaceMapping>, productRepo: Repository<CatalogProduct>, accountRepo: Repository<ConnectedEbayAccount>);
    buildGroupPayload(family: ProductFamily, variants: ProductVariant[]): Promise<EbayInventoryItemGroup>;
    publishFamily(input: VariantFamilyPublishInput): Promise<{
        groupKey: string;
        listingId: string;
        variantCount: number;
    }>;
    private variantLabel;
    private mapCondition;
    private rejectInventoryApiVariationPublishing;
}
