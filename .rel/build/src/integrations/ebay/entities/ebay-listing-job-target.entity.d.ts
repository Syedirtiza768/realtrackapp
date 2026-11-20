import type { ProductVertical } from '../../../verticals/vertical.types.js';
import { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';
import { EbayListingJob } from './ebay-listing-job.entity.js';
export type EbayListingJobTargetStatus = 'pending' | 'processing' | 'success' | 'failed' | 'skipped';
export declare class EbayListingJobTarget {
    id: string;
    listingJobId: string;
    listingJob: EbayListingJob;
    catalogProductId: string | null;
    catalogProduct: CatalogProduct | null;
    ebayAccountId: string | null;
    ebayAccount: ConnectedEbayAccount | null;
    marketplaceId: string;
    vertical: ProductVertical | null;
    status: EbayListingJobTargetStatus;
    resultPayload: Record<string, unknown> | null;
    errorPayload: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
}
