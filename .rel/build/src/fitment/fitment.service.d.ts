import { Repository } from 'typeorm';
import { FitmentMake } from './entities/fitment-make.entity.js';
import { FitmentModel } from './entities/fitment-model.entity.js';
import { FitmentSubmodel } from './entities/fitment-submodel.entity.js';
import { FitmentEngine } from './entities/fitment-engine.entity.js';
import { PartFitment } from './entities/part-fitment.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import type { CreateFitmentDto } from './dto/create-fitment.dto.js';
import type { SearchFitmentDto } from './dto/search-fitment.dto.js';
import { VinDecodeService } from './vin-decode.service.js';
import { EbayVinSearchService } from './ebay-vin-search.service.js';
export declare class FitmentService {
    private readonly makeRepo;
    private readonly modelRepo;
    private readonly submodelRepo;
    private readonly engineRepo;
    private readonly fitmentRepo;
    private readonly listingRepo;
    private readonly vinDecodeService;
    private readonly ebayVinSearch;
    private readonly logger;
    constructor(makeRepo: Repository<FitmentMake>, modelRepo: Repository<FitmentModel>, submodelRepo: Repository<FitmentSubmodel>, engineRepo: Repository<FitmentEngine>, fitmentRepo: Repository<PartFitment>, listingRepo: Repository<ListingRecord>, vinDecodeService: VinDecodeService, ebayVinSearch: EbayVinSearchService);
    getMakes(q?: string): Promise<FitmentMake[]>;
    getModels(makeId: number): Promise<FitmentModel[]>;
    getSubmodels(modelId: number): Promise<FitmentSubmodel[]>;
    getEngines(q?: string): Promise<FitmentEngine[]>;
    getListingFitments(listingId: string): Promise<PartFitment[]>;
    createFitment(listingId: string, dto: CreateFitmentDto): Promise<PartFitment>;
    deleteFitment(fitmentId: string): Promise<void>;
    verifyFitment(fitmentId: string, verified: boolean, userId?: string): Promise<PartFitment>;
    searchByVehicle(dto: SearchFitmentDto): Promise<{
        fitments: PartFitment[];
        total: number;
    }>;
    findListingsByVin(vin: string): Promise<{
        vin: string;
        vehicle: import("./vin-decode.service.js").VinDecodeResult;
        totalFitments: number;
        totalListings: number;
        matchStrategy: "fitment" | "fallback_text" | "ai_enriched" | "ebay_browse";
        listings: any[];
    }>;
    private findListingsByAiEnrichment;
    private findListingsByVehicleText;
    private slugify;
}
