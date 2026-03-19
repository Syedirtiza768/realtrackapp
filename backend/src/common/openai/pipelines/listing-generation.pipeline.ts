import { Injectable, Logger } from '@nestjs/common';
import { OpenAiService } from '../openai.service.js';
import { renderPrompt } from '../prompts/index.js';
import { LISTING_GENERATION_PROMPT } from '../prompts/listing-generation.prompt.js';
import type { OpenAiChatResponse } from '../openai.types.js';

/**
 * Result from the listing generation pipeline.
 */
export interface ListingGenerationResult {
  title: string;
  subtitle: string | null;
  description: string;
  itemSpecifics: Record<string, string>;
  bulletPoints: string[];
  searchTerms: string[];
  pricePositioning: {
    suggestedPrice: number | null;
    rationale: string | null;
  };
  /** Raw AI response for auditing */
  rawResponse: OpenAiChatResponse;
}

/**
 * ListingGenerationPipeline — Generates complete eBay listing content.
 *
 * Takes product data (enriched or raw) and generates:
 * - SEO-optimized title
 * - Rich HTML description
 * - Item specifics
 * - Search keywords
 * - Pricing suggestions
 */
@Injectable()
export class ListingGenerationPipeline {
  private readonly logger = new Logger(ListingGenerationPipeline.name);

  constructor(private readonly openai: OpenAiService) {}

  /**
   * Generate listing content for a product.
   */
  async generate(
    productData: Record<string, unknown>,
    categoryName: string,
    condition: string,
  ): Promise<ListingGenerationResult> {
    const { systemPrompt, userPrompt } = renderPrompt(
      LISTING_GENERATION_PROMPT,
      {
        productData: JSON.stringify(productData, null, 2),
        categoryName,
        condition,
      },
    );

    const response = await this.openai.chat({
      systemPrompt,
      userPrompt,
      jsonMode: true,
      temperature: LISTING_GENERATION_PROMPT.temperature,
      maxTokens: LISTING_GENERATION_PROMPT.maxTokens,
    });

    const parsed = response.content as Record<string, unknown>;

    const pricing = (parsed.pricePositioning ?? {}) as Record<string, unknown>;

    const result: ListingGenerationResult = {
      title: (parsed.title as string) ?? 'Untitled',
      subtitle: typeof parsed.subtitle === 'string' ? parsed.subtitle : null,
      description: (parsed.description as string) ?? '',
      itemSpecifics:
        typeof parsed.itemSpecifics === 'object' && parsed.itemSpecifics
          ? (parsed.itemSpecifics as Record<string, string>)
          : {},
      bulletPoints: Array.isArray(parsed.bulletPoints)
        ? (parsed.bulletPoints as string[])
        : [],
      searchTerms: Array.isArray(parsed.searchTerms)
        ? (parsed.searchTerms as string[])
        : [],
      pricePositioning: {
        suggestedPrice:
          typeof pricing.suggestedPrice === 'number'
            ? pricing.suggestedPrice
            : null,
        rationale:
          typeof pricing.rationale === 'string' ? pricing.rationale : null,
      },
      rawResponse: response,
    };

    this.logger.log(
      `Generated listing: "${result.title}" cost=$${response.estimatedCostUsd.toFixed(4)}`,
    );

    return result;
  }

  /**
   * Batch generate listings for multiple products.
   */
  async generateBatch(
    items: { productData: Record<string, unknown>; categoryName: string; condition: string }[],
  ): Promise<ListingGenerationResult[]> {
    const results: ListingGenerationResult[] = [];
    for (let i = 0; i < items.length; i++) {
      this.logger.debug(`Generating listing ${i + 1}/${items.length}`);
      const result = await this.generate(
        items[i].productData,
        items[i].categoryName,
        items[i].condition,
      );
      results.push(result);
    }
    return results;
  }
}
