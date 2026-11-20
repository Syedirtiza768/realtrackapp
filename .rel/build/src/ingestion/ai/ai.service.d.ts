import type { AiRawResponse, AiVisionProvider, NormalizedAiFields } from './ai-provider.interface.js';
import { OpenAiVisionProvider } from './openai-vision.provider.js';
export declare class AiService {
    private readonly openaiProvider;
    private readonly logger;
    private readonly providers;
    constructor(openaiProvider: OpenAiVisionProvider);
    getProvider(name?: string): AiVisionProvider;
    analyzeImages(imageUrls: string[], preferredProvider?: string, partContext?: Record<string, unknown>): Promise<AiRawResponse>;
    normalizeResponse(response: AiRawResponse): NormalizedAiFields;
    private str;
    private num;
    private clamp;
}
