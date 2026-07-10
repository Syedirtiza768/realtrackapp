import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiService } from '../openai.service.js';
import { ModelRouter, inferPartType } from '../model-router.js';
import { ListingQualityValidator } from '../listing-quality.validator.js';
import { applyListingGuards } from '../listing-guards.js';
import { AiRunLogService } from '../ai-run-log.service.js';
import { ListingGuardAuditService } from '../listing-guard-audit.service.js';
import { renderPrompt } from '../prompts/index.js';
import {
  MOTORS_ENRICHMENT_COMPACT_PROMPT,
  MOTORS_ENRICHMENT_FULL_PROMPT,
} from '../prompts/motors-enrichment.prompt.js';
import { EnrichmentCacheService } from '../enrichment-cache.service.js';
import { compactJson, getEnrichmentProfile } from '../token-optimization.js';
import type { OpenAiChatResponse } from '../openai.types.js';
import type { RunMode } from '../ai-routing-policy.types.js';

/**
 * Result from the enrichment pipeline.
 */
export interface EnrichmentResult {
  title: string | null;
  brand: string | null;
  mpn: string | null;
  oemNumber: string | null;
  partType: string | null;
  condition: string | null;
  description: string | null;
  features: string[];
  suggestedCategory: string | null;
  itemSpecifics: Record<string, string>;
  searchKeywords: string[];
  confidence: Record<string, number>;
  compatibility?: Array<Record<string, unknown>>;
  validationScore?: number;
  passedGate?: boolean;
  escalated?: boolean;
  model?: string;
  lane?: string;
  guardFixes?: string[];
  /** Raw AI response for auditing */
  rawResponse: OpenAiChatResponse;
}

@Injectable()
export class EnrichmentPipeline {
  private readonly logger = new Logger(EnrichmentPipeline.name);
  private readonly promptVersion: string;

  constructor(
    private readonly openai: OpenAiService,
    private readonly modelRouter: ModelRouter,
    private readonly validator: ListingQualityValidator,
    private readonly runLogService: AiRunLogService,
    private readonly guardAudit: ListingGuardAuditService,
    private readonly enrichmentCache: EnrichmentCacheService,
    private readonly config: ConfigService,
  ) {
    this.promptVersion = this.config.get(
      'AI_PROMPT_VERSION',
      'enrichment-v2-compact',
    );
  }

  /**
   * Enrich a product with AI-generated data.
   */
  async enrich(
    rawData: Record<string, unknown>,
    options?: {
      runMode?: RunMode;
      marketplace?: string;
      enhancementId?: string;
      productId?: string;
      importId?: string;
    },
  ): Promise<EnrichmentResult> {
    const partContext = {
      sku: this.str(rawData.sku) ?? undefined,
      partNumber: this.str(rawData.partNumber ?? rawData.mpn) ?? undefined,
      partName: this.str(rawData.partName ?? rawData.title) ?? undefined,
      partType: this.str(rawData.partType) ?? undefined,
      price:
        typeof rawData.price === 'number'
          ? rawData.price
          : Number(rawData.price) || undefined,
      marketplace: options?.marketplace ?? 'US',
    };
    partContext.partType = partContext.partType ?? inferPartType(partContext);

    const thresholds = this.modelRouter.getThresholds();
    const profile = getEnrichmentProfile(
      partContext.price,
      thresholds.lowValueMaxPrice,
    );
    const mpn = partContext.partNumber;
    const cached = this.enrichmentCache.get(mpn, this.promptVersion, profile);
    if (cached) {
      this.logger.debug(
        `Enrichment cache hit for MPN ${mpn} profile=${profile}`,
      );
      return this.buildResultFromParsed(cached, partContext, {
        model: 'cache',
        lane: 'cache',
        escalated: false,
        guardFixes: [],
        rawResponse: {
          content: cached,
          rawContent: compactJson(cached),
          model: 'cache',
          finishReason: 'cache_hit',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          latencyMs: 0,
          estimatedCostUsd: 0,
        },
        validation: await this.validator.validateWithTaxonomy(
          cached,
          {
            partNumber: partContext.partNumber,
            donorMake:
              this.str(rawData.donorMake ?? rawData.brand) ?? 'mercedes',
          },
          {
            compactProfile: profile === 'compact',
            ebayCategoryId:
              this.str(rawData.ebayCategoryId ?? rawData.categoryId) ?? null,
          },
        ),
      });
    }

    const promptTemplate =
      profile === 'compact'
        ? MOTORS_ENRICHMENT_COMPACT_PROMPT
        : MOTORS_ENRICHMENT_FULL_PROMPT;

    const route = this.modelRouter.selectRoute(
      partContext,
      options?.runMode ?? 'default',
    );
    let attempt = 1;
    let model = route.model;
    let lane = route.lane;
    let escalated = false;

    const runOnce = async (
      useModel: string,
      useLane: string,
      useAttempt: number,
    ) => {
      const { systemPrompt, userPrompt } = renderPrompt(promptTemplate, {
        rawData: compactJson(rawData),
      });

      const response = await this.openai.chat({
        systemPrompt,
        userPrompt,
        model: useModel,
        costLane: useLane,
        jsonMode: true,
        temperature: promptTemplate.temperature,
        ...(typeof promptTemplate.maxTokens === 'number'
          ? { maxTokens: promptTemplate.maxTokens }
          : {}),
      });

      let parsed = response.content as Record<string, unknown>;
      const srcPart = {
        partNumber: partContext.partNumber,
        donorMake: this.str(rawData.donorMake ?? rawData.brand) ?? 'mercedes',
        condition: this.str(rawData.condition),
      };

      let guardFixes: string[] = [];
      if (parsed.title || parsed.compatibility) {
        const beforeGuard = { ...parsed };
        const guarded = applyListingGuards(parsed, srcPart);
        parsed = guarded.item;
        guardFixes = guarded.fixes;
        if (guardFixes.length) {
          await this.guardAudit.logGuardFixes(guardFixes, {
            productId:
              options?.productId ?? this.str(rawData.productId) ?? null,
            importId: options?.importId ?? this.str(rawData.importId) ?? null,
            sku: partContext.sku ?? null,
            before: beforeGuard,
            after: parsed,
          });
        }
      }

      const ebayCategoryId =
        this.str(rawData.ebayCategoryId ?? rawData.categoryId) ?? undefined;
      const validation = await this.validator.validateWithTaxonomy(
        parsed,
        srcPart,
        {
          ebayCategoryId,
          compactProfile: profile === 'compact',
        },
      );
      await this.runLogService.logRun({
        sku: partContext.sku ?? null,
        partNumber: partContext.partNumber ?? null,
        partType: partContext.partType ?? null,
        price: partContext.price ?? null,
        marketplace: partContext.marketplace ?? null,
        enhancementId: options?.enhancementId ?? null,
        lane: useLane,
        model: useModel,
        attempt: useAttempt,
        promptVersion: this.promptVersion,
        routingPolicyVersion: route.policyVersion,
        inputTokens: response.usage.promptTokens,
        outputTokens: response.usage.completionTokens,
        costUsd: response.estimatedCostUsd,
        latencyMs: response.latencyMs,
        validationScore: validation.score,
        hardFails: validation.hardFails,
        softFails: validation.softFails,
        escalated: useAttempt > 1,
        passedGate: validation.pass,
        fitmentRowCount: validation.fitmentRowCount,
        guardFixes,
      });

      return { parsed, response, validation, guardFixes };
    };

    let { parsed, response, validation, guardFixes } = await runOnce(
      model,
      lane,
      attempt,
    );

    if (!validation.pass && validation.escalate) {
      const escalationModel = this.modelRouter.getEscalationModel(model, lane);
      if (escalationModel) {
        attempt = 2;
        escalated = true;
        model = escalationModel;
        lane = 'escalation';
        this.logger.warn(
          `Escalating enrichment for ${partContext.sku ?? partContext.partNumber} → ${model}`,
        );
        ({ parsed, response, validation, guardFixes } = await runOnce(
          model,
          lane,
          attempt,
        ));
      }
    }

    if (mpn) {
      this.enrichmentCache.set(mpn, this.promptVersion, profile, parsed);
    }

    const result = this.buildResultFromParsed(parsed, partContext, {
      model,
      lane,
      escalated,
      guardFixes,
      rawResponse: response,
      validation,
    });

    this.logger.log(
      `Enriched product: title="${result.title}" model=${model} profile=${profile} score=${validation.score} pass=${validation.pass} cost=$${response.estimatedCostUsd.toFixed(4)}`,
    );

    return result;
  }

  private buildResultFromParsed(
    parsed: Record<string, unknown>,
    partContext: { partNumber?: string; partType?: string },
    meta: {
      model: string;
      lane: string;
      escalated: boolean;
      guardFixes: string[];
      rawResponse: OpenAiChatResponse;
      validation: { score: number; pass: boolean };
    },
  ): EnrichmentResult {
    return {
      title: this.str(parsed.title),
      brand: this.str(parsed.brand),
      mpn: this.str(parsed.mpn),
      oemNumber: this.str(parsed.oemNumber),
      partType: this.str(parsed.partType) ?? partContext.partType ?? null,
      condition: this.str(parsed.condition),
      description: this.str(parsed.description),
      features: Array.isArray(parsed.features)
        ? (parsed.features as string[])
        : [],
      suggestedCategory: this.str(parsed.suggestedCategory),
      itemSpecifics:
        typeof parsed.itemSpecifics === 'object' && parsed.itemSpecifics
          ? (parsed.itemSpecifics as Record<string, string>)
          : {},
      searchKeywords: Array.isArray(parsed.searchKeywords)
        ? (parsed.searchKeywords as string[])
        : [],
      confidence:
        typeof parsed.confidence === 'object' && parsed.confidence
          ? (parsed.confidence as Record<string, number>)
          : {},
      compatibility: Array.isArray(parsed.compatibility)
        ? (parsed.compatibility as Array<Record<string, unknown>>)
        : undefined,
      validationScore: meta.validation.score,
      passedGate: meta.validation.pass,
      escalated: meta.escalated,
      model: meta.model,
      lane: meta.lane,
      guardFixes: meta.guardFixes,
      rawResponse: meta.rawResponse,
    };
  }

  /**
   * Batch enrich multiple products.
   */
  async enrichBatch(
    items: Record<string, unknown>[],
    options?: { runMode?: RunMode; marketplace?: string },
  ): Promise<EnrichmentResult[]> {
    const results: EnrichmentResult[] = [];
    for (let i = 0; i < items.length; i++) {
      this.logger.debug(`Enriching item ${i + 1}/${items.length}`);
      results.push(await this.enrich(items[i], options));
    }
    return results;
  }

  private str(val: unknown): string | null {
    return typeof val === 'string' && val.trim().length > 0 ? val.trim() : null;
  }
}
