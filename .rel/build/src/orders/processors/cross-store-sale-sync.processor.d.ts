import { WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { CrossStoreSaleSyncService } from '../cross-store-sale-sync.service.js';
export declare class CrossStoreSaleSyncProcessor extends WorkerHost {
    private readonly sync;
    private readonly logger;
    constructor(sync: CrossStoreSaleSyncService);
    process(job: Job<{
        orderId: string;
    }>): Promise<{
        results: number;
    }>;
}
