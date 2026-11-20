import { ListingGenerationService } from './listing-generation.service.js';
declare class GenerateDto {
    masterProductId: string;
    templateId?: string;
    storeId?: string;
    categoryName?: string;
}
declare class GenerateAndPublishDto {
    masterProductId: string;
    templateId?: string;
    storeIds: string[];
    categoryName?: string;
    publishImmediately?: boolean;
}
declare class GenerateBatchDto {
    items: GenerateDto[];
}
export declare class ListingGenerationController {
    private readonly generationService;
    constructor(generationService: ListingGenerationService);
    generate(dto: GenerateDto): Promise<import("./listing-generation.service.js").GeneratedListingWithMeta>;
    generateBatch(dto: GenerateBatchDto): Promise<import("./listing-generation.service.js").GeneratedListingWithMeta[]>;
    generateAndPublish(dto: GenerateAndPublishDto): Promise<{
        generation: import("../common/openai/pipelines/listing-generation.pipeline.js").ListingGenerationResult;
        offers: import("./entities/ebay-offer.entity.js").EbayOffer[];
        publishResults?: import("../channels/ebay/ebay-publish.service.js").PublishResult[];
    }>;
}
export {};
