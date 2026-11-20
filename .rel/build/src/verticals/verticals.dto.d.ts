import { type ProductVertical } from './vertical.types.js';
export declare class UpdateStoreVerticalConfigDto {
    enabledVerticals?: ProductVertical[];
    defaultVertical?: ProductVertical;
    workflows?: Record<string, Record<string, unknown>>;
}
export declare class CreateFamilyDto {
    catalogProductId: string;
    name: string;
    slug: string;
    vertical: ProductVertical;
}
export declare class CreateVariantDto {
    sku: string;
    quantity?: number;
    price?: number;
    attributes?: Record<string, unknown>;
    imageUrls?: string[];
    conditionId?: string;
}
export declare class CreateVariantMappingDto {
    variantId: string;
    ebayAccountId: string;
    marketplaceId: string;
    inventorySku?: string;
}
export declare class PublishVariantFamilyDto {
    storeId: string;
    ebayAccountId: string;
    marketplaceId: string;
    categoryId: string;
    merchantLocationKey: string;
    fulfillmentPolicyId: string;
    paymentPolicyId: string;
    returnPolicyId: string;
    currency?: string;
}
