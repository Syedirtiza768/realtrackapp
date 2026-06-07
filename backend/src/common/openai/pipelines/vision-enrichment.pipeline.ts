import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiService } from '../openai.service.js';
import { ModelRouter } from '../model-router.js';
import { ListingQualityValidator } from '../listing-quality.validator.js';
import { applyListingGuards } from '../listing-guards.js';
import { AiRunLogService } from '../ai-run-log.service.js';
import type { PartContext } from '../ai-routing-policy.types.js';
import type { OpenAiChatResponse } from '../openai.types.js';

const MOTOR_PARTS_PROMPT = `Analyze this motor part image and extract:
1. Part title (max 80 chars, eBay-optimized)
2. Brand name
3. Manufacturer Part Number (MPN)
4. OE/OEM Part Number
5. Part type/category
6. Condition (New/Used/Refurbished)
7. Estimated market value (USD)
8. Description (250 chars)
9. Key features (array)
10. Vehicle fitment (make, model, year range, engine if visible)
11. Dimensions if measurable
12. Any visible defects or wear

Return JSON only with these exact keys:
{
  "title": string,
  "brand": string | null,
  "mpn": string | null,
  "oemNumber": string | null,
  "partType": string | null,
  "condition": "New" | "Used" | "Refurbished",
  "priceEstimate": number | null,
  "description": string,
  "features": string[],
  "fitment": { "make": string, "model": string, "yearStart": number, "yearEnd": number, "engine": string | null } | null,
  "dimensions": { "length": string, "width": string, "height": string, "weight": string } | null,
  "defects": string[],
  "confidence": {
    "title": number,
    "brand": number,
    "mpn": number,
    "partType": number,
    "overall": number
  }
}

Include confidence 0.0-1.0 for each field. Be conservative with confidence scores.`;

export interface VisionEnrichmentResult {
  raw: Record<string, unknown>;
  provider: string;
  model: string;
  lane: string;
  tokensUsed: number;
  latencyMs: number;
  estimatedCostUsd: number;
  validationScore: number;
  passedGate: boolean;
  hardFails: string[];
  softFails: string[];
  guardFixes: string[];
  rawResponse: OpenAiChatResponse;
}

@Injectable()
export class VisionEnrichmentPipeline {
  private readonly logger = new Logger(VisionEnrichmentPipeline.name);
  private readonly promptVersion: string;

  constructor(
    private readonly openai: OpenAiService,
    private readonly modelRouter: ModelRouter,
    private readonly validator: ListingQualityValidator,
    private readonly runLogService: AiRunLogService,
    private readonly config: ConfigService,
  ) {
    this.promptVersion = this.config.get('AI_PROMPT_VERSION', 'enrichment-v1');
  }

  async analyze(
    imageUrls: string[],
    partContext: PartContext = {},
    prompt?: string,
  ): Promise<VisionEnrichmentResult> {
    const route = this.modelRouter.selectVisionRoute(partContext);
    const response = await this.openai.chat({
      userPrompt: prompt ?? MOTOR_PARTS_PROMPT,
      systemPrompt:
        'You are an expert automotive parts vision analyst for eBay Motors listings.',
      imageUrls,
      model: route.model,
      costLane: route.lane,
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 2000,
    });

    let parsed =
      typeof response.content === 'object' && response.content
        ? (response.content as Record<string, unknown>)
        : { _raw: response.rawContent };

    const srcPart = {
      partNumber: partContext.partNumber,
      donorMake: partContext.donorMake ?? 'mercedes',
    };

    let guardFixes: string[] = [];
    if (parsed.title || parsed.compatibility) {
      const guarded = applyListingGuards(parsed, srcPart);
      parsed = guarded.item;
      guardFixes = guarded.fixes;
      if (guardFixes.length) {
        this.logger.debug(`Vision guard fixes: ${guardFixes.join(', ')}`);
      }
    }

    const validation = await this.validator.validateWithTaxonomy(parsed, srcPart);

    await this.runLogService.logRun({
      sku: partContext.sku ?? null,
      partNumber: partContext.partNumber ?? null,
      partType: partContext.partType ?? 'vision_ingestion',
      price: partContext.price ?? null,
      marketplace: partContext.marketplace ?? null,
      lane: route.lane,
      model: route.model,
      attempt: 1,
      promptVersion: this.promptVersion,
      routingPolicyVersion: route.policyVersion,
      inputTokens: response.usage.promptTokens,
      outputTokens: response.usage.completionTokens,
      costUsd: response.estimatedCostUsd,
      latencyMs: response.latencyMs,
      validationScore: validation.score,
      hardFails: validation.hardFails,
      softFails: validation.softFails,
      escalated: false,
      passedGate: validation.pass,
      fitmentRowCount: validation.fitmentRowCount,
      guardFixes,
    });

    return {
      raw: parsed,
      provider: 'openai_vision',
      model: route.model,
      lane: route.lane,
      tokensUsed: response.usage.totalTokens,
      latencyMs: response.latencyMs,
      estimatedCostUsd: response.estimatedCostUsd,
      validationScore: validation.score,
      passedGate: validation.pass,
      hardFails: validation.hardFails,
      softFails: validation.softFails,
      guardFixes,
      rawResponse: response,
    };
  }
}
