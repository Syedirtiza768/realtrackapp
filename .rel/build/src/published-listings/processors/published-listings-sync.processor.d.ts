import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PublishedListingsSyncService, type PublishedListingsSyncJobPayload } from '../services/published-listings-sync.service.js';
export declare class PublishedListingsSyncProcessor extends WorkerHost {
    private readonly sync;
    private readonly logger;
    constructor(sync: PublishedListingsSyncService);
    process(job: Job<PublishedListingsSyncJobPayload>): Promise<{
        processed: number;
        created: number;
        updated: number;
        failed: number;
    }>;
}
