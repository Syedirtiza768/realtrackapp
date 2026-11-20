import type { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { PipelineJob } from '../ingestion/entities/pipeline-job.entity.js';
import { EnterpriseListingIntelligenceService } from '../ingestion/enterprise-listing-intelligence.service.js';
import { FitmentDiscoveryService } from './fitment-discovery.service.js';
import type { JobOptimizationStatus, ProductOptimizationSummary } from './listing-optimization.types.js';
export declare class ListingOptimizationService {
    private readonly productRepo;
    private readonly listingRepo;
    private readonly jobRepo;
    private readonly fitmentDiscovery;
    private readonly enterprise;
    private readonly logger;
    private readonly pipelineDonorModelCache;
    constructor(productRepo: Repository<CatalogProduct>, listingRepo: Repository<ListingRecord>, jobRepo: Repository<PipelineJob>, fitmentDiscovery: FitmentDiscoveryService, enterprise: EnterpriseListingIntelligenceService);
    enqueueJobOptimization(jobId: string, marketplace?: 'US' | 'DE' | 'AU', bullJob?: Job, options?: {
        force?: boolean;
    }): Promise<void>;
    private mapWithConcurrency;
    optimizeProduct(productId: string, marketplace?: 'US' | 'DE' | 'AU', options?: {
        force?: boolean;
    }): Promise<CatalogProduct>;
    optimizeProductsBatch(productIds: string[], marketplace?: 'US' | 'DE' | 'AU', options?: {
        force?: boolean;
        sourceFilename?: string;
    }): Promise<void>;
    markProductOptimizationFailed(productId: string, message: string): Promise<void>;
    private prepareProductForOptimization;
    private resolvePipelineDonorModel;
    private finalizeProductOptimization;
    getJobOptimizationStatus(jobId: string, marketplace?: string): Promise<JobOptimizationStatus>;
    getProductOptimization(productId: string): Promise<ProductOptimizationSummary & {
        fitmentRows: unknown;
        fitmentData: unknown;
        optimizationPayload: unknown;
    }>;
    markManualReview(productId: string, enabled?: boolean): Promise<CatalogProduct>;
    bypassJobOptimization(jobId: string): Promise<{
        updatedCount: number;
    }>;
    canPublish(product: CatalogProduct): boolean;
    private toProductSummary;
    private refreshJobOptimizationCounts;
    private mergeOptimizationByMarketplace;
    markJobOptimizationFailed(jobId: string, marketplace: string): Promise<void>;
    private refreshJobOptimizationAggregate;
}
