import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiService } from '../openai.service.js';
import { ModelRouter } from '../model-router.js';
import { ListingQualityValidator } from '../listing-quality.validator.js';
import { applyListingGuards } from '../listing-guards.js';
import { AiRunLogService } from '../ai-run-log.service.js';
import type { PartContext } from '../ai-routing-policy.types.js';
import type { OpenAiChatResponse } from '../openai.types.js';
import {
  ECU_IDENTIFICATION_PROMPT,
  isEcuPartType,
} from '../prompts/ecu-identification.prompt.js';

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

export interface EcuIdentifiers {
  partType: string | null;
  brand: string | null;
  mpn: string | null;
  oemNumber: string | null;
  hardwareNumber: string | null;
  softwareNumber: string | null;
  otherNumbers: string[];
  visibleText: string[];
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYearRange: string | null;
  confidence: {
    brand: number;
    partNumbers: number;
    vehicleApplication: number;
    overall: number;
  };
}

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
  /** Present only when an ECU identification prompt was used */
  ecuIdentifiers?: EcuIdentifiers;
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
    // Auto-detect ECU / electronic modules and use the specialised prompt
    // unless the caller explicitly supplied a custom prompt.
    const useEcuPrompt = !prompt && isEcuPartType(partContext.partType);
    const effectivePrompt = prompt ?? (useEcuPrompt ? ECU_IDENTIFICATION_PROMPT : MOTOR_PARTS_PROMPT);
    const systemPrompt = useEcuPrompt
      ? 'You are an expert at identifying automotive electronic control modules (ECUs, TCMs, BCMs) from their labels and physical appearance.'
      : 'You are an expert automotive parts vision analyst for eBay Motors listings.';

    const route = this.modelRouter.selectVisionRoute(partContext);
    const response = await this.openai.chat({
      userPrompt: effectivePrompt,
      systemPrompt,
      imageUrls,
      model: route.model,
      costLane: route.lane,
      jsonMode: true,
      temperature: 0.1,
      maxTokens: useEcuPrompt ? 2500 : 2000,
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

    const result: VisionEnrichmentResult = {
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

    // Extract ECU identifiers when the ECU prompt was used
    if (useEcuPrompt && parsed && typeof parsed === 'object') {
      const partNums = (parsed as Record<string, unknown>).partNumbers as Record<string, unknown> | undefined;
      const vehicleApp = (parsed as Record<string, unknown>).vehicleApplication as Record<string, unknown> | undefined;
      const ecuConfidence = (parsed as Record<string, unknown>).confidence as Record<string, unknown> | undefined;
      result.ecuIdentifiers = {
        partType: (parsed as Record<string, unknown>).partType as string ?? null,
        brand: (parsed as Record<string, unknown>).brand as string ?? null,
        mpn: partNums?.mpn as string ?? null,
        oemNumber: partNums?.oemNumber as string ?? null,
        hardwareNumber: partNums?.hardwareNumber as string ?? null,
        softwareNumber: partNums?.softwareNumber as string ?? null,
        otherNumbers: Array.isArray(partNums?.otherNumbers) ? partNums.otherNumbers as string[] : [],
        visibleText: Array.isArray((parsed as Record<string, unknown>).visibleText) ? (parsed as Record<string, unknown>).visibleText as string[] : [],
        vehicleMake: vehicleApp?.make as string ?? null,
        vehicleModel: vehicleApp?.model as string ?? null,
        vehicleYearRange: vehicleApp?.yearRange as string ?? null,
        confidence: {
          brand: Number(ecuConfidence?.brand) || 0,
          partNumbers: Number(ecuConfidence?.partNumbers) || 0,
          vehicleApplication: Number(ecuConfidence?.vehicleApplication) || 0,
          overall: Number(ecuConfidence?.overall) || 0,
        },
      };
      this.logger.log(
        `ECU identification: partType=${result.ecuIdentifiers.partType}, ` +
        `brand=${result.ecuIdentifiers.brand}, mpn=${result.ecuIdentifiers.mpn}, ` +
        `oem=${result.ecuIdentifiers.oemNumber}, hw=${result.ecuIdentifiers.hardwareNumber}`,
      );
    }

    return result;
  }
}
