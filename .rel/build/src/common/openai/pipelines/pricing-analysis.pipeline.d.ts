import { OpenAiService } from '../openai.service.js';
import type { OpenAiChatResponse } from '../openai.types.js';
export interface PricingSuggestion {
    suggestedPrice: number;
    reasoning: string;
    marketPosition: 'below_average' | 'average' | 'above_average';
    confidence: number;
    minViablePrice: number;
    maxRecommendedPrice: number;
    marginPercent: number;
    competitorCount: number;
    pricingStrategy: 'undercut' | 'match' | 'premium' | 'value';
    actionItems: string[];
    rawResponse: OpenAiChatResponse;
}
export declare class PricingAnalysisPipeline {
    private readonly openai;
    private readonly logger;
    constructor(openai: OpenAiService);
    suggestPrice(input: {
        model?: string;
        productTitle: string;
        partNumber: string;
        brand: string;
        condition: string;
        costPrice: number | null;
        retailPrice: number | null;
        mapPrice: number | null;
        competitors: Array<{
            seller: string;
            price: number;
            condition: string;
            title: string;
        }>;
        marketSummary: {
            totalListings: number;
            avgPrice: number | null;
            medianPrice: number | null;
            minPrice: number | null;
            maxPrice: number | null;
        };
    }): Promise<PricingSuggestion>;
    private num;
    private validPosition;
    private validStrategy;
}
