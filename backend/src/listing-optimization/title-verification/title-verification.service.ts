import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import { PipelineJob } from '../../ingestion/entities/pipeline-job.entity.js';
import { OpenAiService } from '../../common/openai/openai.service.js';
import { TITLE_PART_VERIFICATION_PROMPT } from '../../common/openai/prompts/title-part-verification.prompt.js';
import type {
  TitleVerificationBatchItem,
  TitleVerificationModelResult,
  TitleVerificationSummary,
} from './title-verification.types.js';

const DEFAULT_MODEL = 'google/gemini-3.1-flash-lite';

/**
 * Batched, text-only title/part consistency check via Gemini (through the
 * shared OpenAiService/OpenRouter client) — no eBay Browse API calls, no
 * images. Runs on-demand (POST jobs/:id/verify-titles), not auto-chained
 * into the pipeline yet; see title-verification section of the project plan
 * for the fast-follow decision once accuracy has been validated manually.
 */
@Injectable()
export class TitleVerificationService {
  private readonly logger = new Logger(TitleVerificationService.name);

  constructor(
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(PipelineJob)
    private readonly jobRepo: Repository<PipelineJob>,
    private readonly openAi: OpenAiService,
  ) {}

  async verifyJob(jobId: string): Promise<TitleVerificationSummary> {
    const pipelineJob = await this.jobRepo.findOneBy({ id: jobId });
    if (!pipelineJob) {
      throw new NotFoundException(`Pipeline job ${jobId} not found`);
    }

    // Re-verify every product on each explicit manual run — no skip-if-
    // unchanged filtering in v1. Cost at ~$0.0001/product is trivial enough
    // that the added complexity of a content-hash skip (like optimization's
    // sourceDataHash) isn't worth it yet; revisit if this gets auto-chained
    // into every pipeline run and volume grows by orders of magnitude.
    const products = await this.productRepo.find({
      where: { pipelineJobId: jobId },
      select: [
        'id',
        'title',
        'partType',
        'mpn',
        'oemPartNumber',
        'brand',
        'categoryName',
      ],
      order: { id: 'ASC' },
    });

    await this.jobRepo.update(jobId, {
      titleVerificationStatus: 'running',
      titleVerificationTotal: products.length,
      titleVerificationProcessed: 0,
      titleVerificationFlaggedCount: 0,
      titleVerificationCostUsd: 0,
    } as any);

    if (products.length === 0) {
      await this.jobRepo.update(jobId, {
        titleVerificationStatus: 'completed',
      } as any);
      return {
        jobId,
        status: 'completed',
        totalProducts: 0,
        processedProducts: 0,
        flaggedCount: 0,
        unprocessedProductIds: [],
        estimatedCostUsd: 0,
      };
    }

    const model = process.env.TITLE_VERIFICATION_MODEL || DEFAULT_MODEL;
    const batchSize = Math.max(
      1,
      Number(process.env.TITLE_VERIFICATION_BATCH_SIZE ?? '25') || 25,
    );
    const concurrency = Math.max(
      1,
      Number(process.env.TITLE_VERIFICATION_CONCURRENCY ?? '5') || 5,
    );
    const chunkTimeoutMs = Math.max(
      1000,
      Number(process.env.TITLE_VERIFICATION_CHUNK_TIMEOUT_MS ?? '30000') ||
        30000,
    );

    const chunks: CatalogProduct[][] = [];
    for (let i = 0; i < products.length; i += batchSize) {
      chunks.push(products.slice(i, i + batchSize));
    }

    this.logger.log(
      `Title verification for job ${jobId}: ${products.length} products, ${chunks.length} batches of up to ${batchSize}, concurrency ${concurrency}, model ${model}`,
    );

    let processed = 0;
    let flaggedCount = 0;
    let costUsd = 0;
    const unprocessedProductIds: string[] = [];

    await this.mapWithConcurrency(chunks, concurrency, async (chunk) => {
      const chunkIds = chunk.map((p) => p.id);
      try {
        const items: TitleVerificationBatchItem[] = chunk.map((p) => ({
          id: p.id,
          title: p.title,
          partType: p.partType,
          mpn: p.mpn,
          oemPartNumber: p.oemPartNumber,
          brand: p.brand,
          categoryName: p.categoryName,
        }));

        const response = await Promise.race([
          this.openAi.chat({
            systemPrompt: TITLE_PART_VERIFICATION_PROMPT.systemPrompt,
            userPrompt: `Verify title/part consistency for these ${items.length} items:\n\n${JSON.stringify(items)}\n\n${TITLE_PART_VERIFICATION_PROMPT.userPrompt}`,
            jsonMode: true,
            temperature: TITLE_PART_VERIFICATION_PROMPT.temperature,
            maxTokens: TITLE_PART_VERIFICATION_PROMPT.maxTokens,
            model,
            costLane: 'title-verification',
          }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    `Title verification batch of ${chunk.length} timed out after ${chunkTimeoutMs}ms`,
                  ),
                ),
              chunkTimeoutMs,
            ),
          ),
        ]);

        costUsd += response.estimatedCostUsd;

        const parsed = response.content as
          | { results?: TitleVerificationModelResult[] }
          | undefined;
        const resultsById = new Map<string, TitleVerificationModelResult>();
        for (const r of parsed?.results ?? []) {
          if (r && typeof r.id === 'string') resultsById.set(r.id, r);
        }

        for (const product of chunk) {
          const result = resultsById.get(product.id);
          if (!result) {
            this.logger.warn(
              `Title verification: no result returned for product ${product.id} in job ${jobId} — leaving unprocessed`,
            );
            unprocessedProductIds.push(product.id);
            continue;
          }
          processed += 1;
          if (result.match === false) {
            flaggedCount += 1;
            await this.flagTitleMismatch(product.id, result);
          }
        }
      } catch (err) {
        this.logger.error(
          `Title verification batch failed for job ${jobId} (${chunk.length} products): ${String(err)}`,
        );
        // A verification-infra failure (timeout/throw) is not evidence of a
        // real title/part problem — leave these products untouched rather
        // than flagging them, and report them as unprocessed for a retry.
        unprocessedProductIds.push(...chunkIds);
      }

      await this.jobRepo.update(jobId, {
        titleVerificationProcessed: processed,
        titleVerificationFlaggedCount: flaggedCount,
        titleVerificationCostUsd: costUsd,
      } as any);
    });

    const status = unprocessedProductIds.length > 0 ? 'partial' : 'completed';
    await this.jobRepo.update(jobId, {
      titleVerificationStatus: status,
    } as any);

    return {
      jobId,
      status,
      totalProducts: products.length,
      processedProducts: processed,
      flaggedCount,
      unprocessedProductIds,
      estimatedCostUsd: costUsd,
    };
  }

  /**
   * Flags a product for manual review and appends a structured warning in
   * one atomic statement — avoids a lost-update race if the optimization
   * pass writes optimization_warnings on the same row concurrently.
   */
  private async flagTitleMismatch(
    productId: string,
    result: TitleVerificationModelResult,
  ): Promise<void> {
    const warning = {
      code: 'TITLE_PART_MISMATCH',
      severity: 'warning',
      message: result.issue ?? 'Title does not match identified part',
      field: 'title',
      confidence: result.confidence,
      source: 'title-verification',
      detectedAt: new Date().toISOString(),
    };
    await this.productRepo.query(
      `UPDATE catalog_products
          SET optimization_warnings = COALESCE(optimization_warnings, '[]'::jsonb) || $2::jsonb,
              manual_review = true,
              optimization_status = 'needs_review',
              "updatedAt" = NOW()
        WHERE id = $1`,
      [productId, JSON.stringify([warning])],
    );
  }

  /** Bounded-concurrency worker pool — mirrors ListingOptimizationService.mapWithConcurrency. */
  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const worker = async (): Promise<void> => {
      while (true) {
        const i = nextIndex++;
        if (i >= items.length) return;
        results[i] = await fn(items[i], i);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(concurrency, items.length) }, () =>
        worker(),
      ),
    );
    return results;
  }
}
