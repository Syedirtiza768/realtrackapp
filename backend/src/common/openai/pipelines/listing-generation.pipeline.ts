import { Injectable, Logger } from '@nestjs/common';
import { OpenAiService } from '../openai.service.js';
import { renderPrompt } from '../prompts/index.js';
import { LISTING_GENERATION_PROMPT } from '../prompts/listing-generation.prompt.js';
import { LISTING_GENERATION_DE_PROMPT } from '../prompts/listing-generation-de.prompt.js';
import { LISTING_GENERATION_BATCH_PROMPT } from '../prompts/listing-generation-batch.prompt.js';
import { LISTING_GENERATION_BATCH_DE_PROMPT } from '../prompts/listing-generation-batch-de.prompt.js';
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
    options?: {
      temperature?: number;
      marketplace?: 'US' | 'DE' | 'AU';
      sellerCountry?: string;
    },
  ): Promise<ListingGenerationResult> {
    const marketplace = options?.marketplace ?? 'US';
    const promptTemplate =
      marketplace === 'DE'
        ? LISTING_GENERATION_DE_PROMPT
        : LISTING_GENERATION_PROMPT;

    const { systemPrompt, userPrompt } = renderPrompt(promptTemplate, {
      productData: JSON.stringify(productData),
      categoryName,
      condition,
      sellerCountry: options?.sellerCountry ?? 'US',
    });

    const response = await this.openai.chat({
      systemPrompt,
      userPrompt,
      jsonMode: true,
      temperature: options?.temperature ?? promptTemplate.temperature,
      ...(typeof promptTemplate.maxTokens === 'number'
        ? { maxTokens: promptTemplate.maxTokens }
        : {}),
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
   *
   * Groups items into chunks (LISTING_GENERATION_BATCH_SIZE, default 5) of
   * the same marketplace and makes ONE OpenAI call per chunk instead of one
   * call per product — this is what actually cuts LLM round-trips during
   * bulk listing optimization (running single-item calls concurrently still
   * makes N API calls; this makes N/batchSize calls). Falls back to
   * per-item calls for any chunk whose batched response can't be parsed, so
   * one malformed batch response doesn't take out every product in it.
   */
  async generateBatch(
    items: GenerateBatchItem[],
  ): Promise<ListingGenerationResult[]> {
    if (items.length === 0) return [];

    const batchSize = Math.max(
      1,
      Number(process.env.LISTING_GENERATION_BATCH_SIZE ?? '5') || 5,
    );
    const results = new Array<ListingGenerationResult>(items.length);

    // Chunk into runs of the same marketplace, each up to batchSize, so the
    // batch prompt (US or DE) is never asked to mix languages in one call.
    let i = 0;
    while (i < items.length) {
      const marketplace = items[i].options?.marketplace ?? 'US';
      let end = i + 1;
      while (
        end < items.length &&
        end - i < batchSize &&
        (items[end].options?.marketplace ?? 'US') === marketplace
      ) {
        end++;
      }
      const chunk = items.slice(i, end);

      if (chunk.length === 1) {
        results[i] = await this.generate(
          chunk[0].productData,
          chunk[0].categoryName,
          chunk[0].condition,
          chunk[0].options,
        );
      } else {
        const chunkResults = await this.generateChunk(chunk, marketplace);
        for (let j = 0; j < chunk.length; j++) results[i + j] = chunkResults[j];
      }
      i = end;
    }

    return results;
  }

  /** Generate one batched OpenAI call covering multiple same-marketplace items. */
  private async generateChunk(
    chunk: GenerateBatchItem[],
    marketplace: 'US' | 'DE' | 'AU',
  ): Promise<ListingGenerationResult[]> {
    const promptTemplate =
      marketplace === 'DE'
        ? LISTING_GENERATION_BATCH_DE_PROMPT
        : LISTING_GENERATION_BATCH_PROMPT;

    const itemsData = chunk.map((item, index) => ({
      index,
      productData: item.productData,
      categoryName: item.categoryName,
      condition: item.condition,
      sellerCountry: item.options?.sellerCountry ?? 'US',
    }));

    const { systemPrompt, userPrompt } = renderPrompt(promptTemplate, {
      itemsData: JSON.stringify(itemsData),
    });

    try {
      const response = await this.openai.chat({
        systemPrompt,
        userPrompt,
        jsonMode: true,
        temperature: chunk[0].options?.temperature ?? promptTemplate.temperature,
        maxTokens:
          (promptTemplate.maxTokens ?? 2000) * Math.max(1, chunk.length),
      });

      const parsed = response.content as { results?: unknown };
      const rawResults = Array.isArray(parsed?.results) ? parsed.results : null;
      if (!rawResults || rawResults.length !== chunk.length) {
        throw new Error(
          `Batch response had ${rawResults?.length ?? 0} results, expected ${chunk.length}`,
        );
      }

      // Results are matched by "index" rather than assumed to be in order,
      // since the model isn't guaranteed to preserve array order exactly.
      const byIndex = new Map<number, Record<string, unknown>>();
      for (const r of rawResults as Record<string, unknown>[]) {
        if (typeof r.index === 'number') byIndex.set(r.index, r);
      }

      return chunk.map((_, index) =>
        this.toListingResult(byIndex.get(index) ?? rawResults[index], response),
      );
    } catch (err) {
      this.logger.warn(
        `Batched listing generation failed for chunk of ${chunk.length}, falling back to per-item calls: ${String(err)}`,
      );
      const fallback: ListingGenerationResult[] = [];
      for (const item of chunk) {
        fallback.push(
          await this.generate(
            item.productData,
            item.categoryName,
            item.condition,
            item.options,
          ),
        );
      }
      return fallback;
    }
  }

  private toListingResult(
    parsed: Record<string, unknown> | undefined,
    rawResponse: OpenAiChatResponse,
  ): ListingGenerationResult {
    const p = parsed ?? {};
    const pricing = (p.pricePositioning ?? {}) as Record<string, unknown>;

    return {
      title: (p.title as string) ?? 'Untitled',
      subtitle: typeof p.subtitle === 'string' ? p.subtitle : null,
      description: (p.description as string) ?? '',
      itemSpecifics:
        typeof p.itemSpecifics === 'object' && p.itemSpecifics
          ? (p.itemSpecifics as Record<string, string>)
          : {},
      bulletPoints: Array.isArray(p.bulletPoints)
        ? (p.bulletPoints as string[])
        : [],
      searchTerms: Array.isArray(p.searchTerms)
        ? (p.searchTerms as string[])
        : [],
      pricePositioning: {
        suggestedPrice:
          typeof pricing.suggestedPrice === 'number'
            ? pricing.suggestedPrice
            : null,
        rationale:
          typeof pricing.rationale === 'string' ? pricing.rationale : null,
      },
      rawResponse,
    };
  }
}

interface GenerateBatchItem {
  productData: Record<string, unknown>;
  categoryName: string;
  condition: string;
  options?: {
    temperature?: number;
    marketplace?: 'US' | 'DE' | 'AU';
    sellerCountry?: string;
  };
}
