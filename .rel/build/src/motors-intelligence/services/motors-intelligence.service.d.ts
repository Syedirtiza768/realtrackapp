import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MotorsProduct } from '../entities';
import { MotorsPipelineResultDto } from '../dto';
import { VisionExtractionService } from './vision-extraction.service';
import { ProductIdentityService } from './product-identity.service';
import { FitmentResolverService } from './fitment-resolver.service';
import { ListingGeneratorService } from './listing-generator.service';
import { ComplianceEngineService } from './compliance-engine.service';
import { ReviewQueueService } from './review-queue.service';
import { MotorsPublisherService } from './motors-publisher.service';
import { FeatureFlagService } from '../../common/feature-flags/feature-flag.service';
export declare class MotorsIntelligenceService {
    private readonly motorsProductRepo;
    private readonly visionExtractionService;
    private readonly productIdentityService;
    private readonly fitmentResolverService;
    private readonly listingGeneratorService;
    private readonly complianceEngineService;
    private readonly reviewQueueService;
    private readonly motorsPublisherService;
    private readonly featureFlagService;
    private readonly configService;
    private readonly logger;
    constructor(motorsProductRepo: Repository<MotorsProduct>, visionExtractionService: VisionExtractionService, productIdentityService: ProductIdentityService, fitmentResolverService: FitmentResolverService, listingGeneratorService: ListingGeneratorService, complianceEngineService: ComplianceEngineService, reviewQueueService: ReviewQueueService, motorsPublisherService: MotorsPublisherService, featureFlagService: FeatureFlagService, configService: ConfigService);
    runPipeline(motorsProductId: string): Promise<MotorsPipelineResultDto>;
    getProduct(id: string): Promise<MotorsProduct>;
    getProducts(query: any): Promise<{
        products: MotorsProduct[];
        total: number;
    }>;
    listProducts(query: any): Promise<{
        items: MotorsProduct[];
        total: number;
    }>;
    batchCreateProducts(products: Partial<MotorsProduct>[], actorId?: string): Promise<MotorsProduct[]>;
    deleteProduct(id: string): Promise<void>;
    publish(motorsProductId: string, connectionId: string): Promise<{
        success: boolean;
        ebayListingId?: string;
        error?: string;
    }>;
    createProduct(data: Partial<MotorsProduct>, actorId?: string): Promise<MotorsProduct>;
    updateProduct(id: string, data: Partial<MotorsProduct>): Promise<MotorsProduct>;
    getStats(): Promise<Record<string, any>>;
    private meetsAutoPublishThresholds;
    private mapToReviewReason;
}
