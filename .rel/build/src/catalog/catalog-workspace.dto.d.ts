declare const SORTS: readonly ["relevance", "newest", "updated", "title_asc", "title_desc", "sku_asc", "price_asc", "price_desc"];
export type CatalogSort = (typeof SORTS)[number];
export declare class CatalogQueryDto {
    organizationId?: string;
    limit?: number;
    offset?: number;
    q?: string;
    brands?: string;
    categories?: string;
    conditions?: string;
    types?: string;
    sourceFiles?: string;
    formats?: string;
    locations?: string;
    mpns?: string;
    teamIds?: string;
    marketplaces?: string;
    minPrice?: number;
    maxPrice?: number;
    hasImage?: string;
    hasPrice?: string;
    stockLevel?: string;
    shippingProfiles?: string;
    catalogStatus?: string;
    validationStatuses?: string;
    importedFrom?: string;
    importedTo?: string;
    attributes?: string;
    sort?: CatalogSort;
}
export declare class CatalogSuggestQueryDto {
    q: string;
    limit?: number;
    organizationId?: string;
}
export declare class CatalogProductPatchDto {
    title?: string;
    description?: string;
    brand?: string;
    mpn?: string;
    conditionId?: string;
    conditionLabel?: string;
    price?: number;
    quantity?: number;
    imageUrls?: string[];
    categoryId?: string;
    categoryName?: string;
    verticalAttributes?: Record<string, unknown>;
}
export declare class CatalogBulkIdsDto {
    organizationId?: string;
    productIds: string[];
}
export declare class CatalogBulkTeamDto extends CatalogBulkIdsDto {
    teamId?: string | null;
}
export declare class CatalogBulkPoliciesDto extends CatalogBulkIdsDto {
    shippingProfile?: string | null;
    paymentProfile?: string | null;
    returnProfile?: string | null;
}
export declare class CatalogExportDto {
    query?: CatalogQueryDto;
    productIds?: string[];
}
export {};
