import { AiEnhancementService } from './ai-enhancement.service.js';
import { RequestEnhancementDto, BulkRequestEnhancementDto, ApproveEnhancementDto, RejectEnhancementDto, EnhancementQueryDto } from './dto/ai-enhancement.dto.js';
export declare class AiEnhancementController {
    private readonly aiService;
    constructor(aiService: AiEnhancementService);
    getEnhancements(dto: EnhancementQueryDto): Promise<{
        items: import("./entities/ai-enhancement.entity.js").AiEnhancement[];
        total: number;
    }>;
    getStats(): Promise<Record<string, unknown>>;
    getEnhancement(id: string): Promise<import("./entities/ai-enhancement.entity.js").AiEnhancement>;
    getListingEnhancements(listingId: string): Promise<import("./entities/ai-enhancement.entity.js").AiEnhancement[]>;
    requestEnhancement(dto: RequestEnhancementDto): Promise<import("./entities/ai-enhancement.entity.js").AiEnhancement>;
    bulkRequest(dto: BulkRequestEnhancementDto): Promise<{
        results: Array<{
            listingId: string;
            enhancementId?: string;
            status: string;
            error?: string;
        }>;
    }>;
    approve(id: string, dto: ApproveEnhancementDto): Promise<import("./entities/ai-enhancement.entity.js").AiEnhancement>;
    apply(id: string): Promise<{
        enhancement: import("./entities/ai-enhancement.entity.js").AiEnhancement;
        listing: import("../listings/listing-record.entity.js").ListingRecord;
    }>;
    reject(id: string, dto: RejectEnhancementDto): Promise<import("./entities/ai-enhancement.entity.js").AiEnhancement>;
}
