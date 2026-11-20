import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { OpenAiService } from '../../common/openai/openai.service.js';
import { VisionEnrichmentPipeline } from '../../common/openai/pipelines/vision-enrichment.pipeline.js';
import { EbayMvlService } from '../../fitment/ebay-mvl.service.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import { ImageAsset } from '../../storage/entities/image-asset.entity.js';
import { StorageService } from '../../storage/storage.service.js';
import { ImageDriveService } from '../../storage/image-drive.service.js';
import { ImageOptimizerService } from '../image-enrichment/image-optimizer.service.js';
import { EbayBrowseApiService } from '../../channels/ebay/ebay-browse-api.service.js';
export declare const PART_LOOKUP_MIN_VISION_IMAGES = 2;
export interface PartLookupResult {
    partName?: string;
    brand?: string;
    model?: string;
    make?: string;
    year?: string;
    category?: string;
    note?: string;
    partNumber?: string;
    confidence?: 'high' | 'medium' | 'low';
    mvlMatched?: boolean;
    source: 'ebay_browse' | 'oem_text' | 'vision';
    aiModel: string;
    visionModel?: string;
    estimatedCostUsd: number;
    fallbackUsed: boolean;
}
export interface PartLookupDto {
    partNumber: string;
    brand?: string;
    vehicleMake?: string;
    vin?: string;
    imageUrls?: string[];
    partType?: string;
}
export interface CreateIntakePartDto {
    sku?: string;
    partNumber: string;
    brand: string;
    partType: 'OEM' | 'Aftermarket' | 'Salvage';
    conditionId: string;
    vehicleMake?: string;
    price: number;
    quantity?: number;
    imageUrls?: string[];
    uploadedAssetIds?: string[];
    title?: string;
    categoryName?: string;
    description?: string;
    teamId?: string;
    location?: string;
    weight?: number;
}
export interface PartLookupPricingEstimate {
    oemModel: string;
    visionModel: string;
    recommendedStack: string;
    assumptions: {
        oemPromptTokens: number;
        oemCompletionTokens: number;
        visionPromptTokens: number;
        visionCompletionTokens: number;
        visionFallbackRate: number;
    };
    perLookupUsd: {
        oemTextOnly: number;
        visionFallback: number;
        oemPlusVision: number;
    };
    bulk15000PartsUsd: {
        allOemSuccess: number;
        typicalWithVisionFallback: number;
        worstCase: number;
    };
}
export declare class SingleListingFormService {
    private readonly listingRepo;
    private readonly catalogProductRepo;
    private readonly imageAssetRepo;
    private readonly openAi;
    private readonly config;
    private readonly mvl;
    private readonly visionPipeline;
    private readonly storageService;
    private readonly imageDriveService;
    private readonly imageOptimizer;
    private readonly browseApi;
    private readonly listingOptimizationQueue;
    private readonly logger;
    constructor(listingRepo: Repository<ListingRecord>, catalogProductRepo: Repository<CatalogProduct>, imageAssetRepo: Repository<ImageAsset>, openAi: OpenAiService, config: ConfigService, mvl: EbayMvlService, visionPipeline: VisionEnrichmentPipeline, storageService: StorageService, imageDriveService: ImageDriveService, imageOptimizer: ImageOptimizerService, browseApi: EbayBrowseApiService, listingOptimizationQueue: Queue);
    getLookupPricing(): PartLookupPricingEstimate;
    createIntakePart(dto: CreateIntakePartDto): Promise<{
        listing: ListingRecord;
    }>;
    private autoEnrichListing;
    private buildSeoTitle;
    lookupAndApplyToListing(listingId: string): Promise<{
        listing: ListingRecord;
        lookup: PartLookupResult;
    }>;
    private syncLookupFieldsToCatalogProduct;
    private seedCatalogFitmentFromBrowse;
    listBrands(query?: string): Promise<{
        brands: string[];
    }>;
    lookupPart(dto: PartLookupDto): Promise<PartLookupResult>;
    private assertAiConfigured;
    private isOemLookupUsable;
    private isVisionLookupUsable;
    private browseItemMatchesVehicleMake;
    private runBrowseLookup;
    private derivePartNameFromTitle;
    private runOemTextLookup;
    private resizeImagesForVision;
    private prepareVisionImageInputs;
    private visionMimeType;
    private runVisionLookup;
    private finalizeLookupFields;
    private visibleTextContainsPartNumber;
    allocateSku(): Promise<string>;
    private allocateIntakeSourceRow;
    private isUniqueViolation;
    private isSkuUniqueViolation;
    private formatSku;
    private str;
    private sanitizePartNumber;
    private stripTitleSpecialChars;
    private normalizeConfidence;
}
