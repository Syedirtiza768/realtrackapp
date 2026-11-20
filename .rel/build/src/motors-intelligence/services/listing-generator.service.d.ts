import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ListingGeneration, EbayCategoryMapping, EbayAspectRequirement } from '../entities';
export interface ListingGenerationInput {
    brand: string;
    mpn: string;
    productType: string;
    placement?: string;
    material?: string;
    finish?: string;
    includes?: string[];
    features?: string[];
    condition: string;
    compatibleVehicleSummary?: string;
    categoryId: string;
    requiredAspects: Record<string, any>;
    recommendedAspects?: Record<string, any>;
    forbiddenClaims: string[];
    titleCharLimit: number;
    dimensions?: Record<string, any>;
    quantityPerPack?: string;
    sideOrientation?: string;
    frontRear?: string;
    oemPartNumber?: string;
}
export interface ListingGenerationOutput {
    title: string;
    itemSpecifics: Record<string, string>;
    bulletFeatures: string[];
    htmlDescription: string;
    keywordRationale: string;
    searchTags: string[];
    titleQualityScore: number;
    descriptionQualityScore: number;
}
export declare class ListingGeneratorService {
    private readonly listingGenRepo;
    private readonly categoryMappingRepo;
    private readonly aspectRequirementRepo;
    private readonly configService;
    private readonly logger;
    private openai;
    constructor(listingGenRepo: Repository<ListingGeneration>, categoryMappingRepo: Repository<EbayCategoryMapping>, aspectRequirementRepo: Repository<EbayAspectRequirement>, configService: ConfigService);
    generateListing(motorsProductId: string, input: ListingGenerationInput): Promise<ListingGeneration>;
    private canUseTemplate;
    private generateFromTemplate;
    private generateWithAI;
    private buildPositionString;
    private buildBullets;
    private buildHtmlDescription;
    private truncateTitle;
    private escapeHtml;
    getGenerations(motorsProductId: string): Promise<ListingGeneration[]>;
}
