import { Injectable, Logger } from '@nestjs/common';
import { OpenAiService } from '../openai.service.js';
import { renderPrompt } from '../prompts/index.js';
import { COMPETITIVE_ANALYSIS_PROMPT } from '../prompts/competitive-analysis.prompt.js';
import type { OpenAiChatResponse } from '../openai.types.js';

/**
 * Result from the competitive analysis pipeline.
 */
export interface CompetitiveAnalysisResult {
  marketSummary: {
    totalListings: number;
    avgPrice: number | null;
    medianPrice: number | null;
    minPrice: number | null;
    maxPrice: number | null;
    priceStdDev: number | null;
  };
  conditionBreakdown: Record<
    string,
    { count: number; avgPrice: number | null }
  >;
  recommendedPricing: {
    competitive: number | null;
    premium: number | null;
    aggressive: number | null;
    rationale: string | null;
  };
  marketInsights: string[];
  listingOptimizations: string[];
  confidence: number;
  /** Raw AI response for auditing */
  rawResponse: OpenAiChatResponse;
}

/**
 * CompetitiveAnalysisPipeline — AI-powered competitive pricing intelligence.
 *
 * Takes competitor listing data (from Browse API search results) and generates:
 * - Market pricing summary
 * - Condition-based breakdown
 * - Recommended pricing at three tiers
 * - Actionable market insights
 */
@Injectable()
export class CompetitiveAnalysisPipeline {
  private readonly logger = new Logger(CompetitiveAnalysisPipeline.name);

  constructor(private readonly openai: OpenAiService) {}

  /**
   * Analyze competitive landscape for a product.
   */
  async analyze(
    productTitle: string,
    partNumber: string,
    condition: string,
    competitorData: Record<string, unknown>[],
  ): Promise<CompetitiveAnalysisResult> {
    const { systemPrompt, userPrompt } = renderPrompt(
      COMPETITIVE_ANALYSIS_PROMPT,
      {
        productTitle,
        partNumber,
        condition,
        competitorData: JSON.stringify(competitorData, null, 2),
      },
    );

    const response = await this.openai.chat({
      systemPrompt,
      userPrompt,
      jsonMode: true,
      temperature: COMPETITIVE_ANALYSIS_PROMPT.temperature,
      maxTokens: COMPETITIVE_ANALYSIS_PROMPT.maxTokens,
    });

    const parsed = response.content as Record<string, unknown>;

    const summary = (parsed.marketSummary ?? {}) as Record<string, unknown>;
    const pricing = (parsed.recommendedPricing ?? {}) as Record<string, unknown>;
    const breakdown = (parsed.conditionBreakdown ?? {}) as Record<
      string,
      Record<string, unknown>
    >;

    const result: CompetitiveAnalysisResult = {
      marketSummary: {
        totalListings: this.num(summary.totalListings) ?? 0,
        avgPrice: this.num(summary.avgPrice),
        medianPrice: this.num(summary.medianPrice),
        minPrice: this.num(summary.minPrice),
        maxPrice: this.num(summary.maxPrice),
        priceStdDev: this.num(summary.priceStdDev),
      },
      conditionBreakdown: Object.fromEntries(
        Object.entries(breakdown).map(([k, v]) => [
          k,
          { count: this.num(v.count) ?? 0, avgPrice: this.num(v.avgPrice) },
        ]),
      ),
      recommendedPricing: {
        competitive: this.num(pricing.competitive),
        premium: this.num(pricing.premium),
        aggressive: this.num(pricing.aggressive),
        rationale:
          typeof pricing.rationale === 'string' ? pricing.rationale : null,
      },
      marketInsights: Array.isArray(parsed.marketInsights)
        ? (parsed.marketInsights as string[])
        : [],
      listingOptimizations: Array.isArray(parsed.listingOptimizations)
        ? (parsed.listingOptimizations as string[])
        : [],
      confidence: this.num(parsed.confidence) ?? 0,
      rawResponse: response,
    };

    this.logger.log(
      `Competitive analysis for "${productTitle}": avg=$${result.marketSummary.avgPrice} confidence=${result.confidence} cost=$${response.estimatedCostUsd.toFixed(4)}`,
    );

    return result;
  }

  private num(val: unknown): number | null {
    const n = Number(val);
    return isNaN(n) ? null : n;
  }
}
