import { InventoryService } from './inventory.service.js';
import { InventoryWorkbenchService } from './inventory-workbench.service.js';
import { InventoryAutoTriggerService } from './inventory-auto-trigger.service.js';
import { EnrichmentRetryService } from './enrichment-retry.service.js';
import { AdjustInventoryDto, ReserveInventoryDto, ReleaseInventoryDto, ReconcileDto, LowStockQueryDto, InventoryEventsQueryDto } from './dto/inventory.dto.js';
import { InventoryListingsQueryDto, InventoryPartLookupDto, InventoryBulkPartLookupDto, InventoryEnrichDto, UpdateListingImagesDto, ReorderImagesDto, UpdateDonorVehicleDto, InventoryInlineEnrichDto, InventorySendToCatalogDto } from './dto/inventory-workbench.dto.js';
import { User } from '../auth/entities/user.entity.js';
export declare class InventoryController {
    private readonly inventoryService;
    private readonly workbench;
    private readonly autoTrigger;
    private readonly retryService;
    constructor(inventoryService: InventoryService, workbench: InventoryWorkbenchService, autoTrigger: InventoryAutoTriggerService, retryService: EnrichmentRetryService);
    getEnrichmentStatus(listingId: string): Promise<{
        status: import("./inventory-auto-trigger.service.js").EnrichmentStatus;
        stage: string | null;
    }>;
    listWorkbenchListings(query: InventoryListingsQueryDto, user: User): Promise<{
        items: import("./inventory-workbench.service.js").InventoryListingItem[];
        total: number;
    }>;
    listFacets(query: InventoryListingsQueryDto, user: User): Promise<{
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
    bulkSoftDeleteListings(body: {
        ids: string[];
    }): Promise<{
        deleted: number;
    }>;
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
        enrichmentStatus: import("./inventory-auto-trigger.service.js").EnrichmentStatus;
        priorCompletedJobs: {
            jobId: string;
            completedAt: string | null;
            listingId: string;
        }[];
        missingFields: string[];
        imageUrls: string[];
        storeListings: import("./inventory-workbench.service.js").InventoryStoreListing[];
    }>;
    softDeleteListing(listingId: string): Promise<{
        success: true;
    }>;
    updateListingImages(listingId: string, dto: UpdateListingImagesDto): Promise<{
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
        enrichmentStatus: import("./inventory-auto-trigger.service.js").EnrichmentStatus;
        priorCompletedJobs: {
            jobId: string;
            completedAt: string | null;
            listingId: string;
        }[];
        missingFields: string[];
        imageUrls: string[];
        storeListings: import("./inventory-workbench.service.js").InventoryStoreListing[];
    }>;
    reorderImages(listingId: string, dto: ReorderImagesDto): Promise<{
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
        enrichmentStatus: import("./inventory-auto-trigger.service.js").EnrichmentStatus;
        priorCompletedJobs: {
            jobId: string;
            completedAt: string | null;
            listingId: string;
        }[];
        missingFields: string[];
        imageUrls: string[];
        storeListings: import("./inventory-workbench.service.js").InventoryStoreListing[];
    }>;
    updateDonorVehicle(listingId: string, dto: UpdateDonorVehicleDto): Promise<{
        donorVin: string | null;
        donorYear: string | null;
        donorMake: string | null;
        donorModel: string | null;
    }>;
    lookupPart(dto: InventoryPartLookupDto): Promise<{
        listing: import("../listings/listing-record.entity.js").ListingRecord;
        lookup: import("../ingestion/services/single-listing-form.service.js").PartLookupResult;
    }>;
    bulkLookupParts(dto: InventoryBulkPartLookupDto): Promise<{
        results: Array<{
            listingId: string;
            success: boolean;
            lookup?: import("../ingestion/services/single-listing-form.service.js").PartLookupResult;
            error?: string;
        }>;
    }>;
    inlineEnrich(dto: InventoryInlineEnrichDto): Promise<{
        queued: boolean;
        reason?: string;
        listingId: string;
    }>;
    retryEnrichment(listingId: string): Promise<{
        queued: boolean;
        reason?: string;
        listingId: string;
    }>;
    getEnrichmentRetryStatus(listingId: string): Promise<{
        listingId: string;
        found: boolean;
    } | {
        retryCount: number;
        maxRetries: number;
        permanentFail: boolean;
        lastFailureReason: string | null;
        lastFailureAt: Date | null;
        nextRetryAt: Date | null;
        isRateLimit: boolean;
        listingId: string;
        found: boolean;
    }>;
    resetEnrichmentRetry(listingId: string): Promise<{
        listingId: string;
        reset: boolean;
    }>;
    getFilterBrands(): Promise<string[]>;
    getFilterMakes(): Promise<string[]>;
    getFilterModels(make?: string): Promise<string[]>;
    getFilterCategories(): Promise<string[]>;
    sendToCatalog(dto: InventorySendToCatalogDto): Promise<{
        results: Array<{
            listingId: string;
            sku: string;
            catalogProductId: string | null;
            success: boolean;
            error?: string;
        }>;
    }>;
    sendToPipeline(dto: InventoryEnrichDto, user: User): Promise<{
        job: Awaited<ReturnType<import("../ingestion/pipeline.service.js").PipelineService["createBatchJobFromListings"]>>;
        warnings: import("./inventory-workbench.service.js").InventoryRequeueWarning[];
    }>;
    enrichListings(dto: InventoryEnrichDto, user: User): Promise<{
        job: Awaited<ReturnType<import("../ingestion/pipeline.service.js").PipelineService["createBatchJobFromListings"]>>;
        warnings: import("./inventory-workbench.service.js").InventoryRequeueWarning[];
    }>;
    getLedger(listingId: string): Promise<{
        ledger: import("./entities/inventory-ledger.entity.js").InventoryLedger;
        recentEvents: import("./entities/inventory-event.entity.js").InventoryEvent[];
    }>;
    adjust(listingId: string, dto: AdjustInventoryDto): Promise<{
        ledger: import("./entities/inventory-ledger.entity.js").InventoryLedger;
        event: import("./entities/inventory-event.entity.js").InventoryEvent;
    }>;
    reserve(listingId: string, dto: ReserveInventoryDto): Promise<{
        ledger: import("./entities/inventory-ledger.entity.js").InventoryLedger;
        event: import("./entities/inventory-event.entity.js").InventoryEvent;
    }>;
    release(listingId: string, dto: ReleaseInventoryDto): Promise<{
        ledger: import("./entities/inventory-ledger.entity.js").InventoryLedger;
        event: import("./entities/inventory-event.entity.js").InventoryEvent;
    }>;
    lowStock(dto: LowStockQueryDto): Promise<import("./entities/inventory-ledger.entity.js").InventoryLedger[]>;
    reconcile(dto: ReconcileDto): Promise<{
        results: Array<{
            listingId: string;
            status: string;
            diff?: number;
        }>;
    }>;
    events(dto: InventoryEventsQueryDto): Promise<{
        events: import("./entities/inventory-event.entity.js").InventoryEvent[];
        total: number;
    }>;
    duplicates(confidence?: string): Promise<{
        idA: string;
        idB: string;
        matchType: string;
        score: number;
    }[]>;
    getAllocations(listingId: string, storeId?: string): Promise<import("./entities/store-inventory-allocation.entity.js").StoreInventoryAllocation[]>;
    allocateToStore(listingId: string, body: {
        storeId: string;
        quantity: number;
    }): Promise<import("./entities/store-inventory-allocation.entity.js").StoreInventoryAllocation>;
    reserveFromStore(listingId: string, body: {
        storeId: string;
        quantity: number;
        orderId: string;
    }): Promise<import("./entities/store-inventory-allocation.entity.js").StoreInventoryAllocation>;
}
