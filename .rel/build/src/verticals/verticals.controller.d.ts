import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { VerticalsService } from './verticals.service.js';
import { CreateFamilyDto, CreateVariantDto, CreateVariantMappingDto, PublishVariantFamilyDto, UpdateStoreVerticalConfigDto } from './verticals.dto.js';
import { EbayVariantPublishingService } from './ebay-variant-publishing.service.js';
export declare class VerticalsController {
    private readonly verticals;
    private readonly userOrganizations;
    private readonly variantPublishing;
    constructor(verticals: VerticalsService, userOrganizations: UserOrganizationService, variantPublishing: EbayVariantPublishingService);
    getProfiles(): import("./vertical.types.js").VerticalProfile[];
    getStores(user: User, organizationId?: string): Promise<(import("../channels/entities/store.entity.js").Store & {
        verticalConfig: import("./vertical.types.js").VerticalConfig;
    })[]>;
    getStoreConfig(user: User, storeId: string, organizationId?: string): Promise<import("./vertical.types.js").VerticalConfig>;
    updateStoreConfig(user: User, storeId: string, dto: UpdateStoreVerticalConfigDto, organizationId?: string): Promise<import("./vertical.types.js").VerticalConfig>;
    getCategoryMetadata(productId: string, storeId: string, marketplaceId: string, categoryId: string): Promise<import("./vertical.types.js").VerticalCategoryMetadata>;
    createFamily(user: User, dto: CreateFamilyDto, organizationId?: string): Promise<import("./entities/product-family.entity.js").ProductFamily>;
    listVariants(user: User, familyId: string, organizationId?: string): Promise<import("./entities/product-variant.entity.js").ProductVariant[]>;
    createVariant(user: User, familyId: string, dto: CreateVariantDto, organizationId?: string): Promise<import("./entities/product-variant.entity.js").ProductVariant>;
    createVariantMapping(user: User, dto: CreateVariantMappingDto, organizationId?: string): Promise<import("./entities/variant-marketplace-mapping.entity.js").VariantMarketplaceMapping>;
    publishFamily(user: User, familyId: string, dto: PublishVariantFamilyDto, organizationId?: string): Promise<{
        groupKey: string;
        listingId: string;
        variantCount: number;
    }>;
}
