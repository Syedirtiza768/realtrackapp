export declare const STOCK_LEVELS: readonly ["in_stock", "low_stock", "out_of_stock"];
export declare const INVENTORY_SORT_COLUMNS: readonly ["image", "sku", "brand", "location", "team", "fitments", "validation", "price", "status", "enrichment", "catalog"];
export declare const INVENTORY_SORT_MODES: ("price_asc" | "price_desc" | "sku_asc" | "sku_desc" | "team_asc" | "team_desc" | "status_asc" | "status_desc" | "image_asc" | "image_desc" | "catalog_asc" | "location_asc" | "brand_asc" | "validation_asc" | "fitments_asc" | "enrichment_asc" | "catalog_desc" | "location_desc" | "brand_desc" | "validation_desc" | "fitments_desc" | "enrichment_desc")[];
export type InventorySortMode = (typeof INVENTORY_SORT_MODES)[number];
export declare class InventoryListingsQueryDto {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    missingImages?: boolean;
    dateAddedFrom?: string;
    dateAddedTo?: string;
    brand?: string;
    make?: string;
    model?: string;
    category?: string;
    brands?: string;
    conditions?: string;
    teamIds?: string;
    locations?: string;
    marketplaces?: string;
    stockLevel?: string;
    minPrice?: number;
    maxPrice?: number;
    minWeight?: number;
    maxWeight?: number;
    hasPrice?: string;
    sort?: InventorySortMode;
}
export declare class InventoryPartLookupDto {
    listingId: string;
}
export declare class InventoryBulkPartLookupDto {
    listingIds: string[];
}
export declare class InventoryEnrichDto {
    listingIds: string[];
}
export declare class UpdateListingImagesDto {
    imageUrls: string[];
    uploadedAssetIds?: string[];
}
export declare class ReorderImagesDto {
    imageUrls: string[];
}
export declare class UpdateDonorVehicleDto {
    donorVin?: string;
    donorYear?: string;
    donorMake?: string;
    donorModel?: string;
}
export declare class InventoryInlineEnrichDto {
    listingId: string;
    force?: boolean;
}
export declare class InventorySendToCatalogDto {
    listingIds: string[];
}
