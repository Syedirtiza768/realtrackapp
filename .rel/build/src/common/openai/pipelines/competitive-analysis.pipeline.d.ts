import { OpenAiService } from '../openai.service.js';
import type { OpenAiChatResponse } from '../openai.types.js';
export interface CompetitiveAnalysisResult {
    marketSummary: {
        totalListings: number;
        avgPrice: number | null;
        medianPrice: number | null;
        minPrice: number | null;
        maxPrice: number | null;
        priceStdDev: number | null;
    };
    conditionBreakdown: Record<string, {
        count: number;
        avgPrice: number | null;
    }>;
    recommendedPricing: {
        competitive: number | null;
        premium: number | null;
        aggressive: number | null;
        rationale: string | null;
    };
    marketInsights: string[];
    listingOptimizations: string[];
    confidence: number;
    rawResponse: OpenAiChatResponse;
}
export declare class CompetitiveAnalysisPipeline {
    private readonly openai;
    private readonly logger;
    constructor(openai: OpenAiService);
    analyze(productTitle: string, partNumber: string, condition: string, competitorData: Record<string, unknown>[]): Promise<CompetitiveAnalysisResult>;
    private num;
}
