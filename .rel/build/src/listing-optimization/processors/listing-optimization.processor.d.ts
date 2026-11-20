import { WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ListingOptimizationService } from '../listing-optimization.service.js';
import { EbayFitmentPublishService } from '../ebay-fitment-publish.service.js';
export interface ListingOptimizationJobData {
    jobId?: string;
    productId?: string;
    marketplace?: 'US' | 'DE' | 'AU';
    force?: boolean;
    publishAfterOptimization?: boolean;
}
export declare class ListingOptimizationProcessor extends WorkerHost {
    private readonly optimization;
    private readonly ebayFitmentPublish;
    private readonly logger;
    constructor(optimization: ListingOptimizationService, ebayFitmentPublish: EbayFitmentPublishService);
    process(job: Job<ListingOptimizationJobData>): Promise<void>;
    onFailed(job: Job<ListingOptimizationJobData> | undefined): Promise<void>;
}
