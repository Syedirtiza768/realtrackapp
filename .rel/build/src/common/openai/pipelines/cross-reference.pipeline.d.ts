import { Repository } from 'typeorm';
import { OpenAiService } from '../openai.service.js';
import { CrossReference } from '../../../listings/entities/cross-reference.entity.js';
import type { OpenAiChatResponse } from '../openai.types.js';
export interface CrossReferencePart {
    oemNumbers: string[];
    aftermarketNumbers: string[];
    brand: string | null;
    mpn: string | null;
    partType: string | null;
    confidence: number;
}
export interface CrossReferenceResult {
    parts: CrossReferencePart[];
    totalOemNumbers: number;
    totalAftermarketNumbers: number;
    totalCrossReferences: number;
    upsertedCount: number;
    rawResponse: OpenAiChatResponse;
}
export declare class CrossReferencePipeline {
    private readonly openai;
    private readonly crossRefRepo;
    private readonly logger;
    constructor(openai: OpenAiService, crossRefRepo: Repository<CrossReference>);
    processRawSupplierData(rawText: string, masterProductId: string): Promise<CrossReferenceResult>;
    processStructuredParts(parts: Array<{
        oemNumber?: string;
        aftermarketNumber?: string;
        brand?: string;
        partType?: string;
    }>, masterProductId: string): Promise<{
        upsertedCount: number;
    }>;
    private upsertRef;
    private str;
    private toStrArray;
}
