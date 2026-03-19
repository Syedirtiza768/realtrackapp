import { Injectable, Logger } from '@nestjs/common';
import { OpenAiService } from '../openai.service.js';
import { renderPrompt } from '../prompts/index.js';
import { PRICING_ANALYSIS_PROMPT } from '../prompts/pricing-analysis.prompt.js';
import type { OpenAiChatResponse } from '../openai.types.js';

/**
 * Result from the AI pricing analysis pipeline.
 */
export interface PricingSuggestion {
  suggestedPrice: number;
  reasoning: string;
  marketPosition: 'below_average' | 'average' | 'above_average';
  confidence: number;
  minViablePrice: number;
  maxRecommendedPrice: number;
  marginPercent: number;
  competitorCount: number;
  pricingStrategy: 'undercut' | 'match' | 'premium' | 'value';
  actionItems: string[];
  /** Raw AI response for auditing */
  rawResponse: OpenAiChatResponse;
}

/**
 * PricingAnalysisPipeline — AI-powered pricing suggestions.
 *
 * Phase 5 pipeline:
 *  - Takes product cost/price data + competitor prices + market snapshot
 *  - Returns optimal pricing suggestion with confidence score
 *  - Respects MAP price floors and cost minimums
 */
@Injectable()
export class PricingAnalysisPipeline {
  private readonly logger = new Logger(PricingAnalysisPipeline.name);

  constructor(private readonly openai: OpenAiService) {}

  /**
   * Generate a pricing suggestion for a product.
   */
  async suggestPrice(input: {
    productTitle: string;
    partNumber: string;
    brand: string;
    condition: string;
    costPrice: number | null;
    retailPrice: number | null;
    mapPrice: number | null;
    competitors: Array<{
      seller: string;
      price: number;
      condition: string;
      title: string;
    }>;
    marketSummary: {
      totalListings: number;
      avgPrice: number | null;
      medianPrice: number | null;
      minPrice: number | null;
      maxPrice: number | null;
    };
  }): Promise<PricingSuggestion> {
    const competitorData = input.competitors
      .map(
        (c) =>
          `- ${c.seller}: ${c.price.toFixed(2)} USD (${c.condition}) — ${c.title}`,
      )
      .join('\n');

    const { systemPrompt, userPrompt } = renderPrompt(
      PRICING_ANALYSIS_PROMPT,
      {
        productTitle: input.productTitle,
        partNumber: input.partNumber,
        brand: input.brand,
        condition: input.condition,
        costPrice: input.costPrice?.toFixed(2) ?? 'N/A',
        retailPrice: input.retailPrice?.toFixed(2) ?? 'N/A',
        mapPrice: input.mapPrice?.toFixed(2) ?? 'N/A',
        competitorData: competitorData || 'No competitor data available',
        totalListings: String(input.marketSummary.totalListings),
        avgPrice: input.marketSummary.avgPrice?.toFixed(2) ?? 'N/A',
        medianPrice: input.marketSummary.medianPrice?.toFixed(2) ?? 'N/A',
        minPrice: input.marketSummary.minPrice?.toFixed(2) ?? 'N/A',
        maxPrice: input.marketSummary.maxPrice?.toFixed(2) ?? 'N/A',
      },
    );

    const response = await this.openai.chat({
      systemPrompt,
      userPrompt,
      jsonMode: true,
      temperature: PRICING_ANALYSIS_PROMPT.temperature,
      maxTokens: PRICING_ANALYSIS_PROMPT.maxTokens,
    });

    const parsed = response.content as Record<string, unknown>;

    const result: PricingSuggestion = {
      suggestedPrice: this.num(parsed.suggestedPrice) ?? input.retailPrice ?? 0,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      marketPosition: this.validPosition(parsed.marketPosition),
      confidence: this.num(parsed.confidence) ?? 0,
      minViablePrice: this.num(parsed.minViablePrice) ?? input.costPrice ?? 0,
      maxRecommendedPrice: this.num(parsed.maxRecommendedPrice) ?? 999999,
      marginPercent: this.num(parsed.marginPercent) ?? 0,
      competitorCount: this.num(parsed.competitorCount) ?? 0,
      pricingStrategy: this.validStrategy(parsed.pricingStrategy),
      actionItems: Array.isArray(parsed.actionItems)
        ? (parsed.actionItems as string[])
        : [],
      rawResponse: response,
    };

    // Enforce MAP floor
    if (input.mapPrice && result.suggestedPrice < input.mapPrice) {
      result.suggestedPrice = input.mapPrice;
      result.reasoning += ' (adjusted to MAP floor)';
    }

    // Enforce cost floor
    if (input.costPrice && result.suggestedPrice < input.costPrice) {
      result.suggestedPrice = input.costPrice;
      result.reasoning += ' (adjusted to cost floor)';
    }

    this.logger.log(
      `Pricing suggestion for "${input.productTitle}": $${result.suggestedPrice.toFixed(2)} ` +
        `(${result.pricingStrategy}, confidence=${result.confidence}) cost=$${response.estimatedCostUsd.toFixed(4)}`,
    );

    return result;
  }

  private num(val: unknown): number | null {
    const n = Number(val);
    return isNaN(n) ? null : n;
  }

  private validPosition(
    val: unknown,
  ): 'below_average' | 'average' | 'above_average' {
    const s = String(val);
    if (s === 'below_average' || s === 'average' || s === 'above_average') return s;
    return 'average';
  }

  private validStrategy(
    val: unknown,
  ): 'undercut' | 'match' | 'premium' | 'value' {
    const s = String(val);
    if (s === 'undercut' || s === 'match' || s === 'premium' || s === 'value') return s;
    return 'match';
  }
}
