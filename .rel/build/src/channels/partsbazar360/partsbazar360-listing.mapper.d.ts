import type { ListingRecord } from '../../listings/listing-record.entity.js';
import type { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import type { PartsBazarPushItem } from './partsbazar360.types.js';
export type PartsBazarListingSource = Pick<ListingRecord, 'id' | 'title' | 'customLabelSku' | 'categoryName' | 'startPrice' | 'startPriceNum' | 'quantity' | 'quantityNum' | 'itemPhotoUrl' | 'conditionId' | 'conditionLabel' | 'description' | 'cBrand' | 'cType' | 'cManufacturerPartNumber' | 'cOeOemPartNumber' | 'cMaterial' | 'cPlacement' | 'countryOfOrigin' | 'manufacturerName' | 'pUpc' | 'status' | 'ebayListingId'>;
export type PartsBazarCatalogSource = Pick<CatalogProduct, 'sku' | 'title' | 'description' | 'optimizedTitle' | 'optimizedDescription' | 'brand' | 'mpn' | 'oemPartNumber' | 'partType' | 'placement' | 'material' | 'countryOfOrigin' | 'price' | 'quantity' | 'conditionId' | 'conditionLabel' | 'categoryName' | 'imageUrls' | 'fitmentData' | 'fitmentRows' | 'ebayItemId'>;
export interface PartsBazarMapContext {
    marketplaceId: string;
    currency: string;
    overrides?: {
        price?: number;
        title?: string;
        quantity?: number;
    };
    imageUrls?: string[];
}
export type PartsBazarMapResult = {
    ok: true;
    item: PartsBazarPushItem;
    warnings: string[];
} | {
    ok: false;
    reason: string;
    warnings: string[];
};
export declare const PARTSBAZAR_MAX_PAYLOAD_BYTES = 90000;
export declare function storedImageUrls(listing: PartsBazarListingSource, catalog: PartsBazarCatalogSource | null): string[];
export declare function buildPartsBazarPushItem(listing: PartsBazarListingSource, catalog: PartsBazarCatalogSource | null, context: PartsBazarMapContext): PartsBazarMapResult;
