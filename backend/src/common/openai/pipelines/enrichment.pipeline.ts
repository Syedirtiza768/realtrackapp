import { Injectable, Logger } from '@nestjs/common';
import { OpenAiService } from '../openai.service.js';
import { renderPrompt } from '../prompts/index.js';
import { DATA_ENRICHMENT_PROMPT } from '../prompts/data-enrichment.prompt.js';
import type { OpenAiChatResponse } from '../openai.types.js';

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
  /** Raw AI response for auditing */
  rawResponse: OpenAiChatResponse;
}

/**
 * EnrichmentPipeline — Orchestrates AI-powered data enrichment.
 *
 * Takes partial/raw product data (from spreadsheet imports, image analysis, etc.)
 * and uses OpenAI to fill in missing fields, validate existing ones, and
 * generate eBay-optimized content.
 */
@Injectable()
export class EnrichmentPipeline {
  private readonly logger = new Logger(EnrichmentPipeline.name);

  constructor(private readonly openai: OpenAiService) {}

  /**
   * Enrich a product with AI-generated data.
   */
  async enrich(rawData: Record<string, unknown>): Promise<EnrichmentResult> {
    const { systemPrompt, userPrompt } = renderPrompt(
      DATA_ENRICHMENT_PROMPT,
      { rawData: JSON.stringify(rawData, null, 2) },
    );

    const response = await this.openai.chat({
      systemPrompt,
      userPrompt,
      jsonMode: true,
      temperature: DATA_ENRICHMENT_PROMPT.temperature,
      maxTokens: DATA_ENRICHMENT_PROMPT.maxTokens,
    });

    const parsed = response.content as Record<string, unknown>;

    const result: EnrichmentResult = {
      title: this.str(parsed.title),
      brand: this.str(parsed.brand),
      mpn: this.str(parsed.mpn),
      oemNumber: this.str(parsed.oemNumber),
      partType: this.str(parsed.partType),
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
      rawResponse: response,
    };

    this.logger.log(
      `Enriched product: title="${result.title}" confidence=${result.confidence.overall ?? 'N/A'} cost=$${response.estimatedCostUsd.toFixed(4)}`,
    );

    return result;
  }

  /**
   * Batch enrich multiple products.
   * Processes sequentially to respect rate limits.
   */
  async enrichBatch(
    items: Record<string, unknown>[],
  ): Promise<EnrichmentResult[]> {
    const results: EnrichmentResult[] = [];
    for (let i = 0; i < items.length; i++) {
      this.logger.debug(`Enriching item ${i + 1}/${items.length}`);
      const result = await this.enrich(items[i]);
      results.push(result);
    }
    return results;
  }

  private str(val: unknown): string | null {
    return typeof val === 'string' && val.trim().length > 0 ? val.trim() : null;
  }
}
