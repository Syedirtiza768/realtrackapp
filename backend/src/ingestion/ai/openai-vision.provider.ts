import { Injectable, Logger } from '@nestjs/common';
import type { AiRawResponse, AiVisionProvider } from './ai-provider.interface.js';
import { VisionEnrichmentPipeline } from '../../common/openai/pipelines/vision-enrichment.pipeline.js';
import type { PartContext } from '../../common/openai/ai-routing-policy.types.js';

@Injectable()
export class OpenAiVisionProvider implements AiVisionProvider {
  readonly name = 'openai_vision';
  private readonly logger = new Logger(OpenAiVisionProvider.name);

  constructor(private readonly visionPipeline: VisionEnrichmentPipeline) {}

  async analyzeImages(
    imageUrls: string[],
    prompt?: string,
    partContext?: PartContext,
  ): Promise<AiRawResponse> {
    try {
      const result = await this.visionPipeline.analyze(
        imageUrls,
        partContext ?? {},
        prompt,
      );
      return {
        raw: result.raw,
        provider: result.provider,
        model: result.model,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
        estimatedCostUsd: result.estimatedCostUsd,
        validationScore: result.validationScore,
        passedGate: result.passedGate,
        guardFixes: result.guardFixes,
      };
    } catch (err) {
      this.logger.error('AI Vision API call failed', err);
      throw err;
    }
  }

  estimateCost(imageCount: number): number {
    return imageCount * 0.0025;
  }
}
