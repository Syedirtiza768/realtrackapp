import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EbaySyncService, type EbayOrderSyncJobPayload } from '../services/ebay-sync.service.js';
export declare class EbayOrderSyncProcessor extends WorkerHost {
    private readonly sync;
    private readonly logger;
    constructor(sync: EbaySyncService);
    process(job: Job<EbayOrderSyncJobPayload>): Promise<{
        storeId: string;
        imported: number;
        errors: number;
    }>;
}
