import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MotorsProduct, EbayCategoryMapping, EbayAspectRequirement } from '../entities';
export interface EnrichmentResult {
    categoryId: string | null;
    categoryName: string | null;
    aspects: EbayAspectRequirement[];
    compatibilityProperties: string[];
    enrichmentConfidence: number;
    errors: string[];
    warnings: string[];
    cached: boolean;
}
export declare class EbayEnrichmentService {
    private readonly motorsProductRepo;
    private readonly categoryMappingRepo;
    private readonly aspectRepo;
    private readonly configService;
    private readonly logger;
    private readonly CACHE_TTL_MS;
    constructor(motorsProductRepo: Repository<MotorsProduct>, categoryMappingRepo: Repository<EbayCategoryMapping>, aspectRepo: Repository<EbayAspectRequirement>, configService: ConfigService);
    enrichProduct(motorsProductId: string): Promise<EnrichmentResult>;
    private suggestCategory;
    private fetchCategoryAspects;
    private upsertCategoryMapping;
    private calculateEnrichmentConfidence;
    private isCacheFresh;
    private isAspectCacheFresh;
}
