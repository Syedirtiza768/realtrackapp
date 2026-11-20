import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ChannelStockSyncService } from './channel-stock-sync.service.js';
export declare class ChannelStockSyncProcessor extends WorkerHost {
    private readonly sync;
    private readonly logger;
    constructor(sync: ChannelStockSyncService);
    process(job: Job<{
        organizationId?: string;
    }>): Promise<unknown>;
}
