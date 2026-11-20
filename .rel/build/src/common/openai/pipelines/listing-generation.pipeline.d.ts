import { OpenAiService } from '../openai.service.js';
import type { OpenAiChatResponse } from '../openai.types.js';
export interface ListingGenerationResult {
    title: string;
    subtitle: string | null;
    description: string;
    itemSpecifics: Record<string, string>;
    bulletPoints: string[];
    searchTerms: string[];
    pricePositioning: {
        suggestedPrice: number | null;
        rationale: string | null;
    };
    rawResponse: OpenAiChatResponse;
}
export declare class ListingGenerationPipeline {
    private readonly openai;
    private readonly logger;
    constructor(openai: OpenAiService);
    generate(productData: Record<string, unknown>, categoryName: string, condition: string, options?: {
        temperature?: number;
        marketplace?: 'US' | 'DE' | 'AU';
        sellerCountry?: string;
    }): Promise<ListingGenerationResult>;
    generateBatch(items: GenerateBatchItem[]): Promise<ListingGenerationResult[]>;
    private generateChunk;
    private toListingResult;
}
interface GenerateBatchItem {
    productData: Record<string, unknown>;
    categoryName: string;
    condition: string;
    options?: {
        temperature?: number;
        marketplace?: 'US' | 'DE' | 'AU';
        sellerCountry?: string;
    };
}
export {};
