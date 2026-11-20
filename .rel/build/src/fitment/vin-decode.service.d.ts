import { Repository } from 'typeorm';
import { VinCache } from './entities/vin-cache.entity.js';
import { OpenAiService } from '../common/openai/openai.service.js';
import { BrandVinDecoderRegistry } from './vin-decoders/brand-decoder.registry.js';
export interface VinDecodeResult {
    vin: string;
    year: string;
    make: string;
    model: string;
    trim: string;
    bodyClass: string;
    driveType: string;
    engineCylinders: string;
    engineDisplacementL: string;
    fuelType: string;
    plantCountry: string;
    vehicleType: string;
    raw: Record<string, string>;
    aiEnriched?: boolean;
    aiData?: {
        engineDescription?: string;
        transmission?: string;
        mpg?: string;
        horsepower?: string;
        torque?: string;
        seatingCapacity?: string;
        wheelbase?: string;
        curbWeight?: string;
        commonParts?: string[];
        knownFitment?: string[];
        description?: string;
    };
}
export interface RecallInfo {
    campaignNumber: string;
    component: string;
    summary: string;
    consequence: string;
    remedy: string;
}
export declare class VinDecodeService {
    private readonly cacheRepo;
    private readonly openai;
    private readonly brandRegistry;
    private readonly logger;
    private static readonly NHTSA_BASE;
    private static readonly NHTSA_RECALL_BASE;
    private static readonly VIN_REGEX;
    constructor(cacheRepo: Repository<VinCache>, openai: OpenAiService, brandRegistry: BrandVinDecoderRegistry);
    decode(vin: string): Promise<VinDecodeResult>;
    toEbayCompatibilityFilter(vin: string): Promise<Record<string, string>>;
    getRecalls(make: string, model: string, year: string): Promise<RecallInfo[]>;
    private enrichWithAI;
    private buildRawMap;
    private normalize;
    private isExpired;
}
