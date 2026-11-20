import { EbayPublishedListing } from './ebay-published-listing.entity.js';
import { EbayPublishedListingBulkJob } from './ebay-published-listing-bulk-job.entity.js';
export type BulkJobItemStatus = 'pending' | 'success' | 'failed' | 'skipped';
export declare class EbayPublishedListingBulkJobItem {
    id: string;
    bulkJobId: string;
    bulkJob: EbayPublishedListingBulkJob;
    publishedListingId: string;
    publishedListing: EbayPublishedListing;
    status: BulkJobItemStatus;
    beforeSnapshot: Record<string, unknown> | null;
    afterSnapshot: Record<string, unknown> | null;
    errorMessage: string | null;
    createdAt: Date;
    processedAt: Date | null;
}
