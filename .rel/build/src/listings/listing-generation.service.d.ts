import { Repository } from 'typeorm';
import { MasterProduct } from './entities/master-product.entity.js';
import { EbayOffer } from './entities/ebay-offer.entity.js';
import { ExportRuleService } from './export-rule.service.js';
import { ListingGenerationPipeline } from '../common/openai/pipelines/listing-generation.pipeline.js';
import { TemplateService } from '../templates/template.service.js';
import { EbayPublishService } from '../channels/ebay/ebay-publish.service.js';
import type { PublishResult } from '../channels/ebay/ebay-publish.service.js';
import type { ListingGenerationResult } from '../common/openai/pipelines/listing-generation.pipeline.js';
export interface GenerateListingInput {
    masterProductId: string;
    templateId?: string;
    storeId?: string;
    categoryName?: string;
}
export interface GenerateAndPublishInput extends GenerateListingInput {
    storeIds: string[];
    publishImmediately?: boolean;
}
export interface GeneratedListingWithMeta {
    generation: ListingGenerationResult;
    product: MasterProduct;
    appliedOverrides: {
        price: number;
        title: string;
        storeId?: string;
    } | null;
}
export declare class ListingGenerationService {
    private readonly productRepo;
    private readonly offerRepo;
    private readonly listingPipeline;
    private readonly templateService;
    private readonly exportRuleService;
    private readonly publishService;
    private readonly logger;
    constructor(productRepo: Repository<MasterProduct>, offerRepo: Repository<EbayOffer>, listingPipeline: ListingGenerationPipeline, templateService: TemplateService, exportRuleService: ExportRuleService, publishService: EbayPublishService);
    generate(input: GenerateListingInput): Promise<GeneratedListingWithMeta>;
    generateAndCreateOffers(input: GenerateAndPublishInput): Promise<{
        generation: ListingGenerationResult;
        offers: EbayOffer[];
        publishResults?: PublishResult[];
    }>;
    private publishOffers;
    generateBatch(inputs: GenerateListingInput[]): Promise<GeneratedListingWithMeta[]>;
    private findBestRulePrice;
}
