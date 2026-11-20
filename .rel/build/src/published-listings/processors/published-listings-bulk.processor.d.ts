import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { type PublishedListingsBulkJobPayload } from '../services/published-listings-bulk.service.js';
import { PublishedListingsActionService } from '../services/published-listings-action.service.js';
import { PublishedListingsSyncService } from '../services/published-listings-sync.service.js';
import { PublishedListingsHealthService } from '../services/published-listings-health.service.js';
import { PublishedListingsPricingService } from '../services/published-listings-pricing.service.js';
import { EbayPublishedListingBulkJob } from '../entities/ebay-published-listing-bulk-job.entity.js';
import { EbayPublishedListingBulkJobItem } from '../entities/ebay-published-listing-bulk-job-item.entity.js';
import { EbayPublishedListing } from '../entities/ebay-published-listing.entity.js';
import { User } from '../../auth/entities/user.entity.js';
export declare class PublishedListingsBulkProcessor extends WorkerHost {
    private readonly jobRepo;
    private readonly itemRepo;
    private readonly listingRepo;
    private readonly userRepo;
    private readonly actions;
    private readonly sync;
    private readonly health;
    private readonly pricing;
    private readonly logger;
    constructor(jobRepo: Repository<EbayPublishedListingBulkJob>, itemRepo: Repository<EbayPublishedListingBulkJobItem>, listingRepo: Repository<EbayPublishedListing>, userRepo: Repository<User>, actions: PublishedListingsActionService, sync: PublishedListingsSyncService, health: PublishedListingsHealthService, pricing: PublishedListingsPricingService);
    process(job: Job<PublishedListingsBulkJobPayload>): Promise<void>;
    private processItem;
}
