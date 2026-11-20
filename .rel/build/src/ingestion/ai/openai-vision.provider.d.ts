import type { AiRawResponse, AiVisionProvider } from './ai-provider.interface.js';
import { VisionEnrichmentPipeline } from '../../common/openai/pipelines/vision-enrichment.pipeline.js';
import type { PartContext } from '../../common/openai/ai-routing-policy.types.js';
export declare class OpenAiVisionProvider implements AiVisionProvider {
    private readonly visionPipeline;
    readonly name = "openai_vision";
    private readonly logger;
    constructor(visionPipeline: VisionEnrichmentPipeline);
    analyzeImages(imageUrls: string[], prompt?: string, partContext?: PartContext): Promise<AiRawResponse>;
    estimateCost(imageCount: number): number;
}
