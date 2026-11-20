import { ConfigService } from '@nestjs/config';
import type { ValidationResult } from './ai-routing-policy.types.js';
import { EbayTaxonomyTruthService } from './ebay-taxonomy-truth.service.js';
export interface ItemScore {
    composite: number;
    titleWithinLimit: boolean;
    mpnMatchesProvided: boolean;
    fitmentRows: number;
    fitmentAllMercedes: boolean;
    flags: string[];
}
export declare function scoreItem(item: Record<string, unknown>, srcPart: {
    partNumber?: string;
    donorMake?: string;
}): ItemScore;
export declare class ListingQualityValidator {
    private readonly config;
    private readonly taxonomyTruth;
    private readonly fitmentMinRows;
    constructor(config: ConfigService, taxonomyTruth: EbayTaxonomyTruthService);
    validateWithTaxonomy(item: Record<string, unknown>, srcPart: {
        partNumber?: string;
        donorMake?: string;
    }, options?: {
        expectedBatchSize?: number;
        actualBatchSize?: number;
        ebayCategoryId?: string | null;
        compactProfile?: boolean;
    }): Promise<ValidationResult>;
    validate(item: Record<string, unknown>, srcPart: {
        partNumber?: string;
        donorMake?: string;
    }, options?: {
        expectedBatchSize?: number;
        actualBatchSize?: number;
        compactProfile?: boolean;
    }): ValidationResult;
}
