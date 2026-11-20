import type { EbayPublishedListing } from './entities/ebay-published-listing.entity.js';
import type { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { preferLargeEbayImageUrl } from '../channels/ebay/ebay-listing-images.util.js';
export { preferLargeEbayImageUrl };
export interface PublishedListingImageMeta {
    url: string;
    source: 'ebay' | 'gridx' | 'other';
    sortOrder: number;
    isPrimary: boolean;
}
export interface SalvageDetails {
    donorYear?: string | null;
    donorMake?: string | null;
    donorModel?: string | null;
    donorTrim?: string | null;
    mileage?: string | null;
    mileageUnit?: string | null;
    stockNumber?: string | null;
    yard?: string | null;
    bin?: string | null;
    vin?: string | null;
    conditionGrade?: string | null;
    testedStatus?: string | null;
}
export interface PublishedListingCatalogData {
    source: 'RealTrackApp.catalog_products';
    identifiers: {
        sku: string | null;
        mpn: string | null;
        mpnNormalized: string | null;
        upc: string | null;
        ean: string | null;
        epid: string | null;
        oemPartNumber: string | null;
    };
    product: {
        title: string;
        brand: string | null;
        partType: string | null;
        placement: string | null;
        material: string | null;
        features: string | null;
        countryOfOrigin: string | null;
    };
    attributes: {
        weight: number | string | null;
        verticalAttributes: Record<string, unknown>;
    };
    category: {
        id: string | null;
        name: string | null;
        source: 'RealTrackApp.catalog_products';
    };
    fitment: {
        validation: 'mvl_validated' | 'none';
        validatedRows: Record<string, unknown>[];
    };
}
export interface PublishedListingApiResponse extends Omit<EbayPublishedListing, 'description'> {
    description: string | null;
    descriptionHtml: string | null;
    descriptionText: string | null;
    storeSlug: string | null;
    images: PublishedListingImageMeta[];
    brand: string | null;
    mpn: string | null;
    oeNumbers: string[];
    salvageDetails: SalvageDetails | null;
    catalogData?: PublishedListingCatalogData | null;
}
export declare function orderImageUrlsForConsumer(urls: string[]): string[];
export declare function extractSalvageDetails(specifics: Record<string, string[]>): SalvageDetails | null;
export declare function toPublishedListingCatalogData(product: CatalogProduct): PublishedListingCatalogData;
export declare function toPublishedListingApiResponse(listing: EbayPublishedListing, options?: {
    storeSlug?: string | null;
    includeCatalogData?: boolean;
    catalogData?: PublishedListingCatalogData | null;
}): PublishedListingApiResponse;
