import type { Response } from 'express';
import { FitmentService } from './fitment.service.js';
import { FitmentMatcherService } from './fitment-matcher.service.js';
import { FitmentImportService, type AcesVehicleRow } from './fitment-import.service.js';
import { EbayMvlService, type FitmentSelection } from './ebay-mvl.service.js';
import { EbayMvlImportService } from './ebay-mvl-import.service.js';
import { EbayMvlStoreService } from './ebay-mvl-store.service.js';
import { ImportEbayMvlDirectoryDto, ImportEbayMvlFileDto, ValidateEbayMvlBatchDto } from './dto/ebay-mvl-import.dto.js';
import { VinDecodeService } from './vin-decode.service.js';
import { VinExportService } from './vin-export.service.js';
import { VinDbExportService } from './vin-db-export.service.js';
import { CreateFitmentDto, VerifyFitmentDto, FitmentDetectionDto } from './dto/create-fitment.dto.js';
import { SearchFitmentDto } from './dto/search-fitment.dto.js';
import { User } from '../auth/entities/user.entity.js';
export declare class FitmentController {
    private readonly fitmentService;
    private readonly matcherService;
    private readonly importService;
    private readonly mvlService;
    private readonly mvlImportService;
    private readonly mvlStoreService;
    private readonly vinService;
    private readonly vinExport;
    private readonly vinDbExport;
    constructor(fitmentService: FitmentService, matcherService: FitmentMatcherService, importService: FitmentImportService, mvlService: EbayMvlService, mvlImportService: EbayMvlImportService, mvlStoreService: EbayMvlStoreService, vinService: VinDecodeService, vinExport: VinExportService, vinDbExport: VinDbExportService);
    getMakes(q?: string): Promise<import("./entities/fitment-make.entity.js").FitmentMake[]>;
    getModels(makeId: number): Promise<import("./entities/fitment-model.entity.js").FitmentModel[]>;
    getSubmodels(modelId: number): Promise<import("./entities/fitment-submodel.entity.js").FitmentSubmodel[]>;
    getEngines(q?: string): Promise<import("./entities/fitment-engine.entity.js").FitmentEngine[]>;
    searchByVehicle(dto: SearchFitmentDto): Promise<{
        fitments: import("./entities/part-fitment.entity.js").PartFitment[];
        total: number;
    }>;
    getListingFitments(listingId: string): Promise<import("./entities/part-fitment.entity.js").PartFitment[]>;
    createFitment(listingId: string, dto: CreateFitmentDto): Promise<import("./entities/part-fitment.entity.js").PartFitment>;
    deleteFitment(fitmentId: string): Promise<void>;
    verifyFitment(fitmentId: string, dto: VerifyFitmentDto): Promise<import("./entities/part-fitment.entity.js").PartFitment>;
    detectFitment(dto: FitmentDetectionDto): Promise<import("./fitment-matcher.service.js").DetectedFitment[]>;
    bulkImport(body: {
        rows: AcesVehicleRow[];
    }, user: User): Promise<{
        jobId: string;
        rowCount: number;
    }>;
    getCompatibilityProperties(categoryId: string, treeId?: string): Promise<import("./ebay-mvl.service.js").CompatibilityTree>;
    getPropertyValues(categoryId: string, propertyName: string, q?: string, limit?: string, offset?: string, allQuery?: Record<string, string>): Promise<{
        options: import("./ebay-mvl.service.js").PropertyValueOption[];
        hasMore: boolean;
    }>;
    buildCompatibility(body: {
        selections: FitmentSelection[];
    }): import("./ebay-mvl.service.js").EbayCompatibilityEntry[];
    getEbayMakes(categoryId?: string, q?: string, limit?: string, offset?: string): Promise<{
        options: import("./ebay-mvl.service.js").PropertyValueOption[];
        hasMore: boolean;
    }>;
    getEbayModels(make: string, categoryId?: string, q?: string, limit?: string, offset?: string, treeId?: string): Promise<{
        options: import("./ebay-mvl.service.js").PropertyValueOption[];
        hasMore: boolean;
    }>;
    getEbayMvlStatus(): Promise<{
        marketplace: string;
        activeRelease: import("./entities/ebay-mvl-release.entity.js").EbayMvlRelease | null;
        entryCount: number;
    }[]>;
    listEbayMvlReleases(marketplace?: string): Promise<import("./entities/ebay-mvl-release.entity.js").EbayMvlRelease[]>;
    importEbayMvlDirectory(dto: ImportEbayMvlDirectoryDto): Promise<import("./ebay-mvl-import.service.js").EbayMvlDirectoryImportSummary>;
    importEbayMvlFile(dto: ImportEbayMvlFileDto): Promise<import("./ebay-mvl-import.service.js").EbayMvlImportResult>;
    validateEbayMvlBatch(dto: ValidateEbayMvlBatchDto): Promise<import("./ebay-mvl.service.js").MvlValidationSummary>;
    decodeVin(vin: string): Promise<import("./vin-decode.service.js").VinDecodeResult>;
    vinToEbayFilter(vin: string): Promise<Record<string, string>>;
    getListingsByVin(vin: string): Promise<{
        vin: string;
        vehicle: import("./vin-decode.service.js").VinDecodeResult;
        totalFitments: number;
        totalListings: number;
        matchStrategy: "fitment" | "fallback_text" | "ai_enriched" | "ebay_browse";
        listings: any[];
    }>;
    exportVinPipelineInput(vin: string, res: Response): Promise<void>;
    exportVinDbListings(vin: string, res: Response): Promise<void>;
}
