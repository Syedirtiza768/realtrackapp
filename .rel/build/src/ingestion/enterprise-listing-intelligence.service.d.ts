import { Repository } from 'typeorm';
import { PipelineJob } from './entities/pipeline-job.entity.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { EbayCategoryMapping } from '../motors-intelligence/entities/ebay-category-mapping.entity.js';
import { ListingGenerationPipeline } from '../common/openai/pipelines/listing-generation.pipeline.js';
import { TitlePositionPartNamePipeline } from '../common/openai/pipelines/title-position-part-name.pipeline.js';
import { EbayTaxonomyApiService } from '../channels/ebay/ebay-taxonomy-api.service.js';
export type Marketplace = 'US' | 'DE' | 'AU';
export type ListingQualityProfile = 'max_seo_comprehensive' | 'balanced' | 'creative_exploration';
interface EnterpriseOptions {
    marketplace: Marketplace;
    limit: number;
    aiBudgetListings: number;
    listingQualityProfile: ListingQualityProfile;
}
export interface SpecificFieldScore {
    field: string;
    required: boolean;
    present: boolean;
    inferred: boolean;
    confidence: number;
    source: 'source_data' | 'ai' | 'inferred' | 'missing';
}
export interface CompatibilityRow {
    make: string;
    model: string;
    year: string;
    trim?: string;
    engine?: string;
    drivetrain?: string;
    bodyStyle?: string;
    notes?: string;
    confidence: number;
    source: 'source_data' | 'rejected';
    evidenceSource?: 'ebay_mpn_lookup' | 'oem_catalog_lookup';
    mvlStatus?: 'valid' | 'rejected' | 'needs_review';
    rejectedReason?: string;
}
export interface ComplianceWarning {
    code: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    field?: string;
}
export interface EnterpriseListingResult {
    productId: string;
    sku: string | null;
    optimizedTitle: string;
    subtitle: string | null;
    categoryId: string | null;
    categoryName: string | null;
    itemSpecifics: Record<string, string>;
    specificsScore: {
        coverage: number;
        requiredPresent: number;
        requiredTotal: number;
        details: SpecificFieldScore[];
    };
    compatibility: CompatibilityRow[];
    compatibilitySummary: {
        validRows: number;
        rejectedRows: number;
        confidence: number;
    };
    seoDescription: string;
    shortDescription: string;
    imageAnalysis: {
        count: number;
        qualityScore: number;
        readinessScore: number;
        findings: string[];
        recommendations: string[];
    };
    confidenceScores: {
        title: number;
        specifics: number;
        fitment: number;
        description: number;
        category: number;
        overall: number;
    };
    complianceWarnings: ComplianceWarning[];
    validationStatus: 'pass' | 'review' | 'block';
    missingDataReport: string[];
    uploadReadinessScore: number;
    finalUploadPayload: Record<string, unknown>;
}
export interface EnterpriseOptimizationResult {
    jobId: string;
    marketplace: Marketplace;
    totalProducts: number;
    aiGeneratedCount: number;
    blockedCount: number;
    reviewCount: number;
    passCount: number;
    averageUploadReadiness: number;
    listings: EnterpriseListingResult[];
}
export declare class EnterpriseListingIntelligenceService {
    private readonly pipelineRepo;
    private readonly productRepo;
    private readonly categoryMappingRepo;
    private readonly listingPipeline;
    private readonly titlePositionPartName;
    private readonly taxonomy;
    private readonly logger;
    private static readonly MOTORS_TREE_ID;
    private static readonly KEYWORD_MOTORS_IDS;
    private static readonly UNTRUSTED_GENERIC_PART_IDENTITIES;
    private static readonly WRONG_VERTICAL_MOTORS_IDS;
    private fallbackLeaf;
    private readonly categorySuggestionCache;
    private readonly categorySuggestionInFlight;
    constructor(pipelineRepo: Repository<PipelineJob>, productRepo: Repository<CatalogProduct>, categoryMappingRepo: Repository<EbayCategoryMapping>, listingPipeline: ListingGenerationPipeline, titlePositionPartName: TitlePositionPartNamePipeline, taxonomy: EbayTaxonomyApiService);
    generateForPipelineJob(jobId: string, rawOptions?: Partial<EnterpriseOptions>): Promise<EnterpriseOptimizationResult>;
    generateForProduct(productId: string, rawOptions?: Partial<EnterpriseOptions>): Promise<EnterpriseListingResult>;
    generateForProductsBatch(productIds: string[], rawOptions?: Partial<EnterpriseOptions>): Promise<Map<string, EnterpriseListingResult>>;
    parseDonorVehicleFromFilename(filename: string | null | undefined, expectedBrand: string | null | undefined): {
        year: string;
        make: string;
        model: string;
    } | null;
    private resolveTitleSlots;
    private buildAiListingItem;
    private static readonly NON_DESCRIPTIVE_PART_TYPES;
    private hasUntrustedPartType;
    private resolveDescriptivePartType;
    private buildEnterpriseListing;
    private mergeAiSpecifics;
    resolvePublishableCategory(product: CatalogProduct): Promise<{
        categoryId: string | null;
        categoryName: string | null;
        confidence: number;
    }>;
    private findMotorsLeafFromSuggestions;
    private isUntrustedGenericPartIdentity;
    private getFallbackLeafCategory;
    private isMotorsCategory;
    private normalizePartTypeKey;
    private lookupCachedCategoryByPartType;
    private cacheCategoryForPartType;
    private readonly leafCategoryCache;
    private isCurrentlyLeafCategory;
    private getRequiredAspectsSafe;
    private extractBaseSpecifics;
    private evaluateSpecifics;
    private normalizeCompatibility;
    private normalizeReviewTitleEvidence;
    private evaluateImages;
    private buildComplianceWarnings;
    private toEnglishListingInput;
    private static readonly NON_VEHICLE_BRANDS;
    private resolveVehicleMake;
    private toGermanListingInput;
    private selectTitleRangeRows;
    private selectExplicitOemYearRange;
    private vehicleModelTokens;
    private buildMissingDataReport;
    private cleanTitle;
    private sanitizeOptimizedTitle;
    private cleanDescription;
    private ensureEnterpriseDescriptionQuality;
    private buildFallbackTitle;
    private buildFallbackDescription;
    private buildShortDescription;
    private buildShortDescriptionFromAi;
    private localizeText;
    private buildFinalPayload;
    private round;
    private getTemperatureForProfile;
    private getContentRequirements;
}
export {};
