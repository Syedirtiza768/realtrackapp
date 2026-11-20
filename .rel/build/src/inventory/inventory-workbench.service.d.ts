import type { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { VinDecodeService } from '../fitment/vin-decode.service.js';
import { ImageAsset } from '../storage/entities/image-asset.entity.js';
import { StorageService } from '../storage/storage.service.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { PartFitment } from '../fitment/entities/part-fitment.entity.js';
import { PipelineJob } from '../ingestion/entities/pipeline-job.entity.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { Store } from '../channels/entities/store.entity.js';
import { EbayListingChannel } from '../integrations/ebay/entities/ebay-listing-channel.entity.js';
import { SingleListingFormService } from '../ingestion/services/single-listing-form.service.js';
import type { PartLookupResult } from '../ingestion/services/single-listing-form.service.js';
import { PipelineService } from '../ingestion/pipeline.service.js';
import type { EnrichmentStatus } from './inventory-auto-trigger.service.js';
import { InventoryAutoTriggerService } from './inventory-auto-trigger.service.js';
import { FitmentDiscoveryService } from '../listing-optimization/fitment-discovery.service.js';
import type { InventoryListingsQueryDto } from './dto/inventory-workbench.dto.js';
import { ListingGenerationPipeline } from '../common/openai/pipelines/listing-generation.pipeline.js';
import { EnrichmentPipeline } from '../common/openai/pipelines/enrichment.pipeline.js';
import { ModelRouter } from '../common/openai/model-router.js';
import { EbayTaxonomyApiService } from '../channels/ebay/ebay-taxonomy-api.service.js';
import { PartIdentificationService } from './part-identification.service.js';
import { TeamsService } from '../teams/teams.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import type { User } from '../auth/entities/user.entity.js';
export interface InventoryMarketplaceVariant {
    listingId: string;
    marketplace: string | null;
    status: string;
    ebayListingId?: string;
    pipelineJobId?: string;
}
export interface InventoryStoreListing {
    storeId: string;
    storeName: string;
    marketplaceId: string;
    offerId: string | null;
    ebayListingId: string | null;
    listingUrl: string | null;
    price: number | null;
    quantity: number | null;
    status: string;
    publishedAt: string | null;
    lastSyncedAt: string | null;
}
export interface InventoryListingItem {
    id: string;
    sku: string;
    title: string;
    brand: string;
    price: number;
    quantity: number;
    condition: string;
    imageUrl: string;
    imageUrls: string[];
    categoryName: string;
    status: 'draft' | 'ready' | 'publishing' | 'published' | 'error';
    ebayListingId?: string;
    fitmentCount: number;
    missingFields: string[];
    errorMessage?: string;
    pipelineJobId?: string;
    pipelineJobStatus?: string;
    hasCompletedPipelineJob: boolean;
    enrichmentStatus: EnrichmentStatus;
    intakeSource?: boolean;
    marketplaceVariants: InventoryMarketplaceVariant[];
    storeListings: InventoryStoreListing[];
    importedAt?: string;
}
export interface InventoryRequeueWarning {
    listingId: string;
    sku: string;
    jobId: string;
    completedAt: string | null;
}
export declare class InventoryWorkbenchService {
    private readonly listingRepo;
    private readonly fitmentRepo;
    private readonly pipelineJobRepo;
    private readonly imageAssetRepo;
    private readonly productRepo;
    private readonly channelRepo;
    private readonly storeRepo;
    private readonly singleListingForm;
    private readonly pipelineService;
    private readonly autoTrigger;
    private readonly listingGenPipeline;
    private readonly enrichmentPipeline;
    private readonly modelRouter;
    private readonly taxonomy;
    private readonly partIdentification;
    private readonly fitmentDiscovery;
    private readonly storageService;
    private readonly vinDecode;
    private readonly listingOptimizationQueue;
    private readonly teamsService;
    private readonly rbac;
    private readonly logger;
    private readonly categorySuggestionCache;
    private static readonly CATEGORY_CACHE_TTL_MS;
    private static readonly CATEGORY_API_DELAY_MS;
    constructor(listingRepo: Repository<ListingRecord>, fitmentRepo: Repository<PartFitment>, pipelineJobRepo: Repository<PipelineJob>, imageAssetRepo: Repository<ImageAsset>, productRepo: Repository<CatalogProduct>, channelRepo: Repository<EbayListingChannel>, storeRepo: Repository<Store>, singleListingForm: SingleListingFormService, pipelineService: PipelineService, autoTrigger: InventoryAutoTriggerService, listingGenPipeline: ListingGenerationPipeline, enrichmentPipeline: EnrichmentPipeline, modelRouter: ModelRouter, taxonomy: EbayTaxonomyApiService, partIdentification: PartIdentificationService, fitmentDiscovery: FitmentDiscoveryService, storageService: StorageService, vinDecode: VinDecodeService, listingOptimizationQueue: Queue, teamsService: TeamsService, rbac: RbacService);
    private resolveTeamScopeIds;
    listListings(query: InventoryListingsQueryDto, user?: User): Promise<{
        items: InventoryListingItem[];
        total: number;
    }>;
    private loadPipelineJobsForListings;
    getListingDetail(listingId: string): Promise<{
        listing: {
            id: string;
            customLabelSku: string | null;
            title: string | null;
            description: string | null;
            cBrand: string | null;
            cType: string | null;
            cManufacturerPartNumber: string | null;
            cOeOemPartNumber: string | null;
            cFeatures: string | null;
            categoryId: string | null;
            categoryName: string | null;
            conditionId: string | null;
            startPrice: string | null;
            startPriceNum: number | null;
            quantity: string | null;
            quantityNum: number | null;
            itemPhotoUrl: string | null;
            pUpc: string | null;
            pEpid: string | null;
            location: string | null;
            format: string | null;
            sourceFileName: string;
            marketplace: string | null;
            status: "archived" | "draft" | "ready" | "published" | "sold" | "delisted";
            ebayListingId: string | null;
            pipelineJobId: string | null;
            extractedMake: string | null;
            extractedModel: string | null;
            enrichmentStage: string | null;
            enrichmentPermanentFail: boolean;
            failureReason: string | undefined;
            failureClass: import("./enrichment-retry.service.js").FailureUiClass | undefined;
            importedAt: Date;
            updatedAt: Date;
            publishedAt: Date | null;
            version: number;
        };
        donorVehicle: {
            vin: string | null;
            year: string | null;
            make: string | null;
            model: string | null;
        };
        fitments: {
            id: string;
            make: string | null;
            model: string | null;
            submodel: string | null;
            engine: string | null;
            yearStart: number;
            yearEnd: number;
            source: import("../fitment/entities/part-fitment.entity.js").FitmentSource;
            confidence: number | null;
            verified: boolean;
            notes: string | null;
        }[];
        marketplaceVariants: {
            listingId: string;
            marketplace: string | null;
            status: "archived" | "draft" | "ready" | "published" | "sold" | "delisted";
            ebayListingId: string | null;
            pipelineJobId: string | null;
            title: string | null;
            importedAt: Date;
        }[];
        pipelineJob: {
            id: string;
            status: import("../ingestion/entities/pipeline-job.entity.js").PipelineJobStatus;
            originalFilename: string;
            completedAt: Date | null;
            createdAt: Date;
            totalParts: number;
            enrichedCount: number;
        } | null;
        enrichmentStatus: EnrichmentStatus;
        priorCompletedJobs: {
            jobId: string;
            completedAt: string | null;
            listingId: string;
        }[];
        missingFields: string[];
        imageUrls: string[];
        storeListings: InventoryStoreListing[];
    }>;
    private loadStoreListingsBySkus;
    private getCompletedJobsForSku;
    private serializeListing;
    lookupPartForListing(listingId: string): Promise<{
        listing: ListingRecord;
        lookup: PartLookupResult;
    }>;
    inlineEnrichListing(listingId: string): Promise<{
        baseListing: ListingRecord;
        marketplaceListings: Array<{
            marketplace: string;
            listingId: string;
            title: string;
        }>;
    }>;
    private runInlineEnrichListing;
    private sleep;
    private getCategorySuggestionsCached;
    private resolveCategoryFromQuery;
    private resolveCategoryForListing;
    private composeDeterministicTitle;
    private static readonly TITLE_PART_NAME_JUNK;
    private cleanTitlePartName;
    private seedBrowseFitment;
    private discoverAndPersistFitment;
    private resolveCategoryForMarketplace;
    private buildCategoryQueryCandidates;
    private buildCategoryQuery;
    private upsertCatalogProductFromListing;
    updateListingImages(listingId: string, imageUrls: string[], uploadedAssetIds?: string[]): Promise<{
        listing: {
            id: string;
            customLabelSku: string | null;
            title: string | null;
            description: string | null;
            cBrand: string | null;
            cType: string | null;
            cManufacturerPartNumber: string | null;
            cOeOemPartNumber: string | null;
            cFeatures: string | null;
            categoryId: string | null;
            categoryName: string | null;
            conditionId: string | null;
            startPrice: string | null;
            startPriceNum: number | null;
            quantity: string | null;
            quantityNum: number | null;
            itemPhotoUrl: string | null;
            pUpc: string | null;
            pEpid: string | null;
            location: string | null;
            format: string | null;
            sourceFileName: string;
            marketplace: string | null;
            status: "archived" | "draft" | "ready" | "published" | "sold" | "delisted";
            ebayListingId: string | null;
            pipelineJobId: string | null;
            extractedMake: string | null;
            extractedModel: string | null;
            enrichmentStage: string | null;
            enrichmentPermanentFail: boolean;
            failureReason: string | undefined;
            failureClass: import("./enrichment-retry.service.js").FailureUiClass | undefined;
            importedAt: Date;
            updatedAt: Date;
            publishedAt: Date | null;
            version: number;
        };
        donorVehicle: {
            vin: string | null;
            year: string | null;
            make: string | null;
            model: string | null;
        };
        fitments: {
            id: string;
            make: string | null;
            model: string | null;
            submodel: string | null;
            engine: string | null;
            yearStart: number;
            yearEnd: number;
            source: import("../fitment/entities/part-fitment.entity.js").FitmentSource;
            confidence: number | null;
            verified: boolean;
            notes: string | null;
        }[];
        marketplaceVariants: {
            listingId: string;
            marketplace: string | null;
            status: "archived" | "draft" | "ready" | "published" | "sold" | "delisted";
            ebayListingId: string | null;
            pipelineJobId: string | null;
            title: string | null;
            importedAt: Date;
        }[];
        pipelineJob: {
            id: string;
            status: import("../ingestion/entities/pipeline-job.entity.js").PipelineJobStatus;
            originalFilename: string;
            completedAt: Date | null;
            createdAt: Date;
            totalParts: number;
            enrichedCount: number;
        } | null;
        enrichmentStatus: EnrichmentStatus;
        priorCompletedJobs: {
            jobId: string;
            completedAt: string | null;
            listingId: string;
        }[];
        missingFields: string[];
        imageUrls: string[];
        storeListings: InventoryStoreListing[];
    }>;
    updateDonorVehicle(listingId: string, dto: {
        donorVin?: string;
        donorYear?: string;
        donorMake?: string;
        donorModel?: string;
    }): Promise<{
        donorVin: string | null;
        donorYear: string | null;
        donorMake: string | null;
        donorModel: string | null;
    }>;
    reorderListingImages(listingId: string, imageUrls: string[]): Promise<{
        listing: {
            id: string;
            customLabelSku: string | null;
            title: string | null;
            description: string | null;
            cBrand: string | null;
            cType: string | null;
            cManufacturerPartNumber: string | null;
            cOeOemPartNumber: string | null;
            cFeatures: string | null;
            categoryId: string | null;
            categoryName: string | null;
            conditionId: string | null;
            startPrice: string | null;
            startPriceNum: number | null;
            quantity: string | null;
            quantityNum: number | null;
            itemPhotoUrl: string | null;
            pUpc: string | null;
            pEpid: string | null;
            location: string | null;
            format: string | null;
            sourceFileName: string;
            marketplace: string | null;
            status: "archived" | "draft" | "ready" | "published" | "sold" | "delisted";
            ebayListingId: string | null;
            pipelineJobId: string | null;
            extractedMake: string | null;
            extractedModel: string | null;
            enrichmentStage: string | null;
            enrichmentPermanentFail: boolean;
            failureReason: string | undefined;
            failureClass: import("./enrichment-retry.service.js").FailureUiClass | undefined;
            importedAt: Date;
            updatedAt: Date;
            publishedAt: Date | null;
            version: number;
        };
        donorVehicle: {
            vin: string | null;
            year: string | null;
            make: string | null;
            model: string | null;
        };
        fitments: {
            id: string;
            make: string | null;
            model: string | null;
            submodel: string | null;
            engine: string | null;
            yearStart: number;
            yearEnd: number;
            source: import("../fitment/entities/part-fitment.entity.js").FitmentSource;
            confidence: number | null;
            verified: boolean;
            notes: string | null;
        }[];
        marketplaceVariants: {
            listingId: string;
            marketplace: string | null;
            status: "archived" | "draft" | "ready" | "published" | "sold" | "delisted";
            ebayListingId: string | null;
            pipelineJobId: string | null;
            title: string | null;
            importedAt: Date;
        }[];
        pipelineJob: {
            id: string;
            status: import("../ingestion/entities/pipeline-job.entity.js").PipelineJobStatus;
            originalFilename: string;
            completedAt: Date | null;
            createdAt: Date;
            totalParts: number;
            enrichedCount: number;
        } | null;
        enrichmentStatus: EnrichmentStatus;
        priorCompletedJobs: {
            jobId: string;
            completedAt: string | null;
            listingId: string;
        }[];
        missingFields: string[];
        imageUrls: string[];
        storeListings: InventoryStoreListing[];
    }>;
    bulkLookupParts(listingIds: string[]): Promise<{
        results: Array<{
            listingId: string;
            success: boolean;
            lookup?: PartLookupResult;
            error?: string;
        }>;
    }>;
    buildRequeueWarnings(listingIds: string[]): Promise<InventoryRequeueWarning[]>;
    sendToPipeline(listingIds: string[], userId?: string): Promise<{
        job: Awaited<ReturnType<PipelineService['createBatchJobFromListings']>>;
        warnings: InventoryRequeueWarning[];
    }>;
    enrichListings(listingIds: string[], userId?: string): Promise<{
        job: Awaited<ReturnType<PipelineService['createBatchJobFromListings']>>;
        warnings: InventoryRequeueWarning[];
    }>;
    getListingOrThrow(listingId: string): Promise<ListingRecord>;
    getFilterBrands(): Promise<string[]>;
    getFilterMakes(): Promise<string[]>;
    getFilterModels(make?: string): Promise<string[]>;
    getFilterCategories(): Promise<string[]>;
    listFacets(query: InventoryListingsQueryDto, user?: User): Promise<{
        brands: Array<{
            value: string;
            count: number;
        }>;
        conditions: Array<{
            value: string;
            count: number;
        }>;
        locations: Array<{
            value: string;
            count: number;
        }>;
        marketplaces: Array<{
            value: string;
            count: number;
        }>;
        makes: Array<{
            value: string;
            count: number;
        }>;
        models: Array<{
            value: string;
            count: number;
        }>;
        categories: Array<{
            value: string;
            count: number;
        }>;
        statuses: Array<{
            value: string;
            count: number;
        }>;
        teams: Array<{
            value: string;
            count: number;
            label: string;
            color: string;
        }>;
        stockLevels: Array<{
            value: string;
            count: number;
        }>;
        totalFiltered: number;
        priceRange: {
            min: number;
            max: number;
        };
        weightRange: {
            min: number;
            max: number;
        };
    }>;
    sendToCatalog(listingIds: string[]): Promise<{
        results: Array<{
            listingId: string;
            sku: string;
            catalogProductId: string | null;
            success: boolean;
            error?: string;
        }>;
    }>;
    softDeleteListing(listingId: string): Promise<{
        success: true;
    }>;
    bulkSoftDeleteListings(ids: string[]): Promise<{
        deleted: number;
    }>;
}
