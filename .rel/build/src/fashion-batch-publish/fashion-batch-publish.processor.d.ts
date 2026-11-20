import { WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { FashionBatchPublishService, type FashionBatchJob } from './fashion-batch-publish.service.js';
export declare class FashionBatchPublishProcessor extends WorkerHost {
    private readonly batches;
    constructor(batches: FashionBatchPublishService);
    process(job: Job<FashionBatchJob>): Promise<void>;
}
