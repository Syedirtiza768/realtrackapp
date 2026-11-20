import { OpenAiService } from '../openai.service.js';
export interface TitlePositionPartNameItem {
    id: string;
    rawDesc?: string | null;
    partNumber?: string | null;
    make?: string | null;
    model?: string | null;
    year?: string | null;
    categoryName?: string | null;
    fallbackPosition?: string | null;
    fallbackPartName?: string | null;
}
export interface TitlePositionPartNameResult {
    id: string;
    position: string;
    partName: string;
    source: 'gemini' | 'fallback';
}
export declare class TitlePositionPartNamePipeline {
    private readonly openai;
    private readonly logger;
    constructor(openai: OpenAiService);
    resolveBatch(items: TitlePositionPartNameItem[]): Promise<Map<string, TitlePositionPartNameResult>>;
    private sanitizeSlot;
    private mapWithConcurrency;
}
