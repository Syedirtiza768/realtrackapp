import { Repository } from 'typeorm';
import type { Queue } from 'bullmq';
import { User } from '../../auth/entities/user.entity.js';
import { EbayPublishedListing } from '../entities/ebay-published-listing.entity.js';
import { EbayPublishedListingBulkJob } from '../entities/ebay-published-listing-bulk-job.entity.js';
import { EbayPublishedListingBulkJobItem } from '../entities/ebay-published-listing-bulk-job-item.entity.js';
import type { BulkPublishedListingsDto } from '../dto/published-listings.dto.js';
export interface PublishedListingsBulkJobPayload {
    bulkJobId: string;
    organizationId: string;
    userId: string;
}
export declare class PublishedListingsBulkService {
    private readonly listingRepo;
    private readonly jobRepo;
    private readonly itemRepo;
    private readonly bulkQueue;
    constructor(listingRepo: Repository<EbayPublishedListing>, jobRepo: Repository<EbayPublishedListingBulkJob>, itemRepo: Repository<EbayPublishedListingBulkJobItem>, bulkQueue: Queue<PublishedListingsBulkJobPayload>);
    createBulkJob(organizationId: string, user: User, dto: BulkPublishedListingsDto): Promise<EbayPublishedListingBulkJob>;
    getJob(jobId: string, organizationId: string): Promise<{
        job: EbayPublishedListingBulkJob;
        items: EbayPublishedListingBulkJobItem[];
    }>;
    private snapshot;
}
