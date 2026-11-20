import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EbaySyncService, type EbayInventorySyncJobPayload } from '../services/ebay-sync.service.js';
import { Repository } from 'typeorm';
import { EbayListingSyncLog } from '../entities/ebay-listing-sync-log.entity.js';
export declare class EbayInventorySyncProcessor extends WorkerHost {
    private readonly sync;
    private readonly syncLogRepo;
    private readonly logger;
    constructor(sync: EbaySyncService, syncLogRepo: Repository<EbayListingSyncLog>);
    process(job: Job<EbayInventorySyncJobPayload & {
        syncLogId?: string;
    }>): Promise<{
        processed: number;
        updated: number;
        failed: number;
    }>;
}
