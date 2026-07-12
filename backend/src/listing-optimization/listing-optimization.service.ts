import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bullmq';
import { IsNull, Repository } from 'typeorm';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { PipelineJob } from '../ingestion/entities/pipeline-job.entity.js';
import { EnterpriseListingIntelligenceService } from '../ingestion/enterprise-listing-intelligence.service.js';
import { FitmentDiscoveryService } from './fitment-discovery.service.js';
import type { FitmentDiscoveryResult } from './fitment-discovery.service.js';
import type { EnterpriseListingResult } from '../ingestion/enterprise-listing-intelligence.service.js';
import { computeSourceDataHash } from './source-data-hash.util.js';
import type {
  JobOptimizationStatus,
  OptimizationIssue,
  OptimizationStatus,
  ProductOptimizationSummary,
} from './listing-optimization.types.js';

const OPTIMIZATION_VERSION = 1;

type PreparedOptimization =
  | { skip: true; product: CatalogProduct }
  | {
      skip: false;
      product: CatalogProduct;
      fitment: FitmentDiscoveryResult;
      hash: string;
    };

@Injectable()
export class ListingOptimizationService {
  private readonly logger = new Logger(ListingOptimizationService.name);

  constructor(
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectRepository(PipelineJob)
    private readonly jobRepo: Repository<PipelineJob>,
    private readonly fitmentDiscovery: FitmentDiscoveryService,
    private readonly enterprise: EnterpriseListingIntelligenceService,
  ) {}

  async enqueueJobOptimization(
    jobId: string,
    marketplace: 'US' | 'DE' | 'AU' = 'US',
    bullJob?: Job,
  ): Promise<void> {
    const pipelineJob = await this.jobRepo.findOneBy({ id: jobId });
    const byMkt = (pipelineJob?.optimizationByMarketplace ?? {}) as Record<
      string,
      any
    >;
    const existingStatus = byMkt[marketplace]?.status;

    if (existingStatus === 'completed' || existingStatus === 'needs_review') {
      this.logger.log(
        `Optimization for job ${jobId} [${marketplace}] already completed, skipping`,
      );
      await this.refreshJobOptimizationAggregate(jobId);
      return;
    }

    const isRetry = existingStatus === 'running';
    const existingCounts = isRetry ? (byMkt[marketplace] ?? {}) : {};

    await this.mergeOptimizationByMarketplace(jobId, marketplace, {
      status: 'running',
      passCount: isRetry ? (existingCounts.passCount ?? 0) : 0,
      reviewCount: isRetry ? (existingCounts.reviewCount ?? 0) : 0,
      blockCount: isRetry ? (existingCounts.blockCount ?? 0) : 0,
      processed: isRetry ? (existingCounts.processed ?? 0) : 0,
      total: isRetry ? (existingCounts.total ?? 0) : 0,
    });
    await this.jobRepo.update(jobId, {
      optimizationStatus: 'running',
      optimizationProcessed: isRetry ? (existingCounts.processed ?? 0) : 0,
    } as any);

    // Filter products by marketplace: only optimize products that have a listing_record for this marketplace
    const marketplaceListingSkus = await this.listingRepo
      .createQueryBuilder('lr')
      .select('lr.customLabelSku', 'sku')
      .where('lr.pipelineJobId = :jobId', { jobId })
      .andWhere('lr.marketplace = :marketplace', { marketplace })
      .andWhere('lr.customLabelSku IS NOT NULL')
      .getRawMany<{ sku: string }>();

    const marketplaceSkus = new Set(marketplaceListingSkus.map((r) => r.sku));

    let products = await this.productRepo.find({
      where: { pipelineJobId: jobId },
      select: ['id', 'sku'],
    });

    // Only process products that have a listing_record for this marketplace.
    // If no listing records exist for this marketplace, skip entirely.
    if (marketplaceSkus.size === 0) {
      this.logger.log(
        `No listing records for job ${jobId} [${marketplace}], skipping optimization`,
      );
      await this.mergeOptimizationByMarketplace(jobId, marketplace, {
        status: 'completed',
        passCount: 0,
        reviewCount: 0,
        blockCount: 0,
        processed: 0,
        total: 0,
      });
      await this.refreshJobOptimizationAggregate(jobId);
      return;
    }
    products = products.filter((p) => p.sku && marketplaceSkus.has(p.sku));

    await this.jobRepo.update(jobId, {
      optimizationTotal: products.length,
    } as any);

    const PRODUCT_TIMEOUT_MS = 60_000;
    const EXTEND_LOCK_MS = 10 * 60 * 1000; // 10 min extension
    // Each product makes its own OpenAI call (enterprise-listing-intelligence's
    // generateForProduct); processing them one at a time was the real driver
    // of "painfully slow" jobs, not eBay rate limiting. OpenAiService.chat
    // already backs off on provider rate-limit headers, so it's safe to fan
    // these out instead of serializing every product in the job.
    const PRODUCT_CONCURRENCY = Math.max(
      1,
      Number(process.env.LISTING_OPTIMIZATION_PRODUCT_CONCURRENCY ?? '5') ||
        5,
    );
    // Group products into batches that each make ONE OpenAI call (see
    // ListingGenerationPipeline.generateBatch) instead of one call per
    // product — this is what actually cuts total LLM round-trips; running
    // single-item calls concurrently (PRODUCT_CONCURRENCY above) still makes
    // one call per product, just in parallel.
    const OPTIMIZATION_BATCH_SIZE = Math.max(
      1,
      Number(process.env.LISTING_OPTIMIZATION_BATCH_SIZE ?? '5') || 5,
    );
    const EXTEND_LOCK_EVERY_N_CHUNKS = Math.max(
      1,
      Math.round(10 / OPTIMIZATION_BATCH_SIZE),
    );

    const startIndex = isRetry ? (existingCounts.processed ?? 0) : 0;
    const remaining = products.slice(startIndex);
    const chunks: (typeof remaining)[] = [];
    for (let i = 0; i < remaining.length; i += OPTIMIZATION_BATCH_SIZE) {
      chunks.push(remaining.slice(i, i + OPTIMIZATION_BATCH_SIZE));
    }

    this.logger.log(
      `Optimization for job ${jobId} [${marketplace}]: ${products.length} total, starting at index ${startIndex}${isRetry ? ' (retry)' : ''}, ${chunks.length} batches of up to ${OPTIMIZATION_BATCH_SIZE}, concurrency ${PRODUCT_CONCURRENCY}`,
    );

    await this.mapWithConcurrency(
      chunks,
      PRODUCT_CONCURRENCY,
      async (chunk, ci) => {
        if (bullJob && ci > 0 && ci % EXTEND_LOCK_EVERY_N_CHUNKS === 0) {
          try {
            await bullJob.extendLock(bullJob.token!, EXTEND_LOCK_MS);
          } catch (e) {
            this.logger.warn(
              `Failed to extend lock for job ${jobId} [${marketplace}]: ${String(e)}`,
            );
          }
          const pct = Math.floor((ci / chunks.length) * 100);
          try {
            await bullJob.updateProgress(pct);
          } catch {
            // progress update is best-effort
          }
        }

        const chunkTimeoutMs = PRODUCT_TIMEOUT_MS * chunk.length;
        try {
          await Promise.race([
            this.optimizeProductsBatch(
              chunk.map((p) => p.id),
              marketplace,
              { force: false },
            ),
            new Promise<never>((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(
                      `Batch of ${chunk.length} products timed out after ${chunkTimeoutMs}ms`,
                    ),
                  ),
                chunkTimeoutMs,
              ),
            ),
          ]);
        } catch (err) {
          this.logger.error(
            `Batch optimization failed for ${chunk.length} products [${marketplace}]: ${String(err)}`,
          );
          // Mark every product in the chunk as failed so they're counted as
          // processed — prevents the job from getting stuck with
          // processed < total forever. optimizeProductsBatch already isolates
          // per-product failures internally; this only fires if the whole
          // chunk call hangs or throws before it can do that itself.
          await Promise.all(
            chunk.map((p) =>
              this.markProductOptimizationFailed(p.id, String(err)),
            ),
          );
        }

        try {
          await this.refreshJobOptimizationCounts(jobId, marketplace);
        } catch (err) {
          // A transient failure here (DB blip, etc.) must not crash the whole
          // job — that leaves the job permanently stuck at this product's
          // count with no path to recovery (see process() catch in the
          // processor for the terminal case). Log and keep going.
          this.logger.error(
            `refreshJobOptimizationCounts failed for job ${jobId} [${marketplace}] after batch: ${String(err)}`,
          );
        }
      },
    );

    await this.refreshJobOptimizationAggregate(jobId);
  }

  /** Bounded-concurrency worker pool — mirrors PipelineProcessor.mapWithConcurrency. */
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

  async optimizeProduct(
    productId: string,
    marketplace: 'US' | 'DE' | 'AU' = 'US',
    options?: { force?: boolean },
  ): Promise<CatalogProduct> {
    const prepared = await this.prepareProductForOptimization(
      productId,
      marketplace,
      options,
    );
    if (prepared.skip) return prepared.product;

    const listing = await this.enterprise.generateForProduct(productId, {
      marketplace,
      listingQualityProfile: 'max_seo_comprehensive',
    });

    return this.finalizeProductOptimization(
      productId,
      marketplace,
      prepared.product,
      prepared.fitment,
      prepared.hash,
      listing,
    );
  }

  /**
   * Batch variant of optimizeProduct — prepares each product's fitment
   * individually (that part is DB/local-lookup driven, not the bottleneck),
   * then makes ONE call to enterprise.generateForProductsBatch covering all
   * of them instead of one OpenAI call per product. A failure for one
   * product (prepare, AI, or finalize) is caught and marks just that
   * product failed, matching the per-product isolation optimizeProduct's
   * caller previously got from running items one at a time.
   */
  async optimizeProductsBatch(
    productIds: string[],
    marketplace: 'US' | 'DE' | 'AU' = 'US',
    options?: { force?: boolean },
  ): Promise<void> {
    if (productIds.length === 0) return;

    const prepared: {
      id: string;
      result?: PreparedOptimization;
      error?: unknown;
    }[] = await Promise.all(
      productIds.map(async (id) => {
        try {
          return {
            id,
            result: await this.prepareProductForOptimization(
              id,
              marketplace,
              options,
            ),
          };
        } catch (err) {
          return { id, error: err };
        }
      }),
    );

    const toGenerate = prepared.filter(
      (
        p,
      ): p is {
        id: string;
        result: Extract<PreparedOptimization, { skip: false }>;
      } => p.result !== undefined && !p.result.skip,
    );

    const aiResults = await this.enterprise.generateForProductsBatch(
      toGenerate.map((p) => p.id),
      { marketplace, listingQualityProfile: 'max_seo_comprehensive' },
    );

    for (const p of toGenerate) {
      const listing = aiResults.get(p.id);
      if (!listing) {
        await this.markProductOptimizationFailed(
          p.id,
          'No AI listing result returned for product in batch',
        );
        continue;
      }
      try {
        await this.finalizeProductOptimization(
          p.id,
          marketplace,
          p.result.product,
          p.result.fitment,
          p.result.hash,
          listing,
        );
      } catch (err) {
        await this.markProductOptimizationFailed(p.id, String(err));
      }
    }

    for (const p of prepared) {
      if ('error' in p) {
        await this.markProductOptimizationFailed(p.id, String(p.error));
      }
    }
  }

  private async markProductOptimizationFailed(
    productId: string,
    message: string,
  ): Promise<void> {
    await this.productRepo
      .update(productId, {
        optimizationStatus: 'failed',
        optimizationErrors: [
          {
            code: 'OPTIMIZATION_FAILED',
            severity: 'error',
            message: message.substring(0, 500),
          },
        ],
      } as any)
      .catch(() => {});
  }

  /** Fetch + skip-check + running-status + fitment discovery for one product. */
  private async prepareProductForOptimization(
    productId: string,
    marketplace: 'US' | 'DE' | 'AU',
    options?: { force?: boolean },
  ): Promise<PreparedOptimization> {
    const product = await this.productRepo.findOneBy({ id: productId });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    const hash = computeSourceDataHash(product);
    if (
      !options?.force &&
      product.optimizationStatus === 'completed' &&
      product.sourceDataHash === hash
    ) {
      return { skip: true, product };
    }

    await this.productRepo.update(productId, {
      optimizationStatus: 'running',
      fitmentStatus: 'running',
    } as any);

    // Resolve the per-marketplace categoryId from the matching listing record.
    // Each marketplace (US/AU/DE) has its own category tree, so fitment must be
    // discovered/validated against the listing record's categoryId for that
    // marketplace rather than the shared catalog_product.categoryId.
    let discoveryCategoryId: string | undefined;
    if (product.sku) {
      const mktListing = await this.listingRepo.findOne({
        where: {
          customLabelSku: product.sku,
          marketplace,
          deletedAt: IsNull(),
        },
        select: ['categoryId'],
      });
      if (mktListing?.categoryId) {
        discoveryCategoryId = mktListing.categoryId;
      }
    }

    const fitment = await this.fitmentDiscovery.discover(product, {
      marketplace,
      categoryId: discoveryCategoryId,
    });
    const fitmentJson = this.fitmentDiscovery.toFitmentDataJson(fitment.rows);

    await this.productRepo.update(productId, {
      fitmentData: fitmentJson.length > 0 ? fitmentJson : product.fitmentData,
      fitmentRows: fitment.rows as unknown as Record<string, unknown>[],
      fitmentStatus: fitment.status,
      fitmentConfidence: fitment.confidence,
      donorVin: fitment.donorVin,
      donorVinDecoded: fitment.donorVinDecoded,
    } as any);

    return { skip: false, product, fitment, hash };
  }

  /** Post-AI-call status/score computation + persistence for one product. */
  private async finalizeProductOptimization(
    productId: string,
    marketplace: 'US' | 'DE' | 'AU',
    product: CatalogProduct,
    fitment: FitmentDiscoveryResult,
    hash: string,
    listing: EnterpriseListingResult,
  ): Promise<CatalogProduct> {
    const errors: OptimizationIssue[] = listing.complianceWarnings
      .filter((w) => w.severity === 'error')
      .map((w) => ({
        code: w.code,
        severity: w.severity,
        message: w.message,
        field: w.field,
      }));

    const warnings: OptimizationIssue[] = [
      ...listing.complianceWarnings
        .filter((w) => w.severity !== 'error')
        .map((w) => ({
          code: w.code,
          severity: w.severity,
          message: w.message,
          field: w.field,
        })),
      ...fitment.manualReviewReasons.map((msg) => ({
        code: 'FITMENT_REVIEW',
        severity: 'warning' as const,
        message: msg,
        field: 'fitment',
      })),
    ];

    let optimizationStatus: OptimizationStatus = 'completed';
    if (listing.validationStatus === 'block') {
      optimizationStatus = 'failed';
    } else if (
      listing.validationStatus === 'review' ||
      fitment.status === 'needs_review' ||
      fitment.manualReviewReasons.length > 0
    ) {
      optimizationStatus = 'needs_review';
    }

    const ebayValidationStatus =
      fitment.rows.filter((r) => r.validationStatus === 'valid').length > 0
        ? 'valid'
        : fitment.categorySupportsCompatibility === false
          ? 'unsupported'
          : 'needs_review';

    const manualReview =
      optimizationStatus === 'needs_review' ||
      fitment.status === 'needs_review';

    const seoScore = listing.confidenceScores.overall;
    const readinessScore = listing.uploadReadinessScore;

    await this.productRepo.update(productId, {
      optimizationStatus,
      optimizationVersion: OPTIMIZATION_VERSION,
      optimizedAt: new Date(),
      sourceDataHash: hash,
      ebayValidationStatus,
      optimizationErrors: errors,
      optimizationWarnings: warnings,
      optimizedTitle: listing.optimizedTitle,
      optimizedDescription: listing.seoDescription,
      optimizationPayload: listing as unknown as Record<string, unknown>,
      seoScore,
      readinessScore,
      manualReview,
    } as any);

    // Persist the resolved eBay category back to the marketplace-specific
    // listing record so publish paths use a validated Motors category instead
    // of the raw source categoryId.
    if (product.sku) {
      const mktListing = await this.listingRepo.findOne({
        where: {
          customLabelSku: product.sku,
          marketplace,
          deletedAt: IsNull(),
        },
      });
      if (mktListing && listing.categoryId) {
        mktListing.categoryId = listing.categoryId;
        if (listing.categoryName) {
          mktListing.categoryName = listing.categoryName;
        }
        await this.listingRepo.save(mktListing);
      }
    }

    if (product.pipelineJobId) {
      await this.refreshJobOptimizationCounts(
        product.pipelineJobId,
        marketplace,
      );
    }

    return this.productRepo.findOneByOrFail({ id: productId });
  }

  async getJobOptimizationStatus(
    jobId: string,
    marketplace?: string,
  ): Promise<JobOptimizationStatus> {
    const job = await this.jobRepo.findOneBy({ id: jobId });
    if (!job) throw new NotFoundException(`Pipeline job ${jobId} not found`);

    const products = await this.productRepo.find({
      where: { pipelineJobId: jobId },
      order: { sourceRow: 'ASC' },
    });

    const byMkt = (job.optimizationByMarketplace ?? {}) as Record<string, any>;
    const mktData = marketplace ? byMkt[marketplace] : null;

    return {
      jobId,
      optimizationStatus:
        (job.optimizationStatus as OptimizationStatus) ?? 'pending',
      processed: mktData?.processed ?? job.optimizationProcessed ?? 0,
      total: mktData?.total ?? job.optimizationTotal ?? products.length,
      passCount: mktData?.passCount ?? job.optimizationPassCount ?? 0,
      reviewCount: mktData?.reviewCount ?? job.optimizationReviewCount ?? 0,
      blockCount: mktData?.blockCount ?? job.optimizationBlockCount ?? 0,
      byMarketplace: byMkt,
      products: products.map((p) => this.toProductSummary(p)),
    };
  }

  async getProductOptimization(productId: string): Promise<
    ProductOptimizationSummary & {
      fitmentRows: unknown;
      fitmentData: unknown;
      optimizationPayload: unknown;
    }
  > {
    const product = await this.productRepo.findOneBy({ id: productId });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);
    return {
      ...this.toProductSummary(product),
      fitmentRows: product.fitmentRows,
      fitmentData: product.fitmentData,
      optimizationPayload: product.optimizationPayload,
    };
  }

  async markManualReview(
    productId: string,
    enabled = true,
  ): Promise<CatalogProduct> {
    await this.productRepo.update(productId, {
      manualReview: enabled,
      optimizationStatus: enabled ? 'needs_review' : 'completed',
    } as any);
    return this.productRepo.findOneByOrFail({ id: productId });
  }

  async bypassJobOptimization(
    jobId: string,
  ): Promise<{ updatedCount: number }> {
    const job = await this.jobRepo.findOneBy({ id: jobId });
    if (!job) throw new NotFoundException(`Pipeline job ${jobId} not found`);

    const result = await this.productRepo.update({ pipelineJobId: jobId }, {
      optimizationStatus: 'completed',
      manualReview: false,
      optimizationErrors: [],
      optimizationWarnings: [],
    } as any);

    this.logger.warn(
      `Optimization bypassed for job ${jobId} — ${result.affected ?? 0} products updated`,
    );

    await this.productRepo
      .createQueryBuilder()
      .update(CatalogProduct)
      .set({
        optimizationPayload: () =>
          `jsonb_set(COALESCE(optimization_payload, '{}'), '{validationStatus}', '"pass"')`,
      })
      .where('pipeline_job_id = :jobId', { jobId })
      .execute();

    await this.jobRepo.update(jobId, {
      optimizationStatus: 'completed',
      optimizationProcessed: result.affected ?? 0,
      optimizationPassCount: result.affected ?? 0,
      optimizationReviewCount: 0,
      optimizationBlockCount: 0,
    } as any);

    return { updatedCount: result.affected ?? 0 };
  }

  canPublish(product: CatalogProduct): boolean {
    if (product.optimizationStatus !== 'completed') return false;
    if (product.manualReview) return false;
    const payload = product.optimizationPayload as {
      validationStatus?: string;
    } | null;
    if (payload?.validationStatus === 'block') return false;
    const errors =
      (product.optimizationErrors as unknown as OptimizationIssue[]) ?? [];
    if (errors.some((e) => e.severity === 'error')) return false;
    return true;
  }

  private toProductSummary(
    product: CatalogProduct,
  ): ProductOptimizationSummary {
    const payload = product.optimizationPayload as {
      validationStatus?: 'pass' | 'review' | 'block';
      uploadReadinessScore?: number;
      missingDataReport?: string[];
    } | null;

    const fitmentRows = Array.isArray(product.fitmentRows)
      ? product.fitmentRows
      : [];

    return {
      productId: product.id,
      sku: product.sku,
      optimizationStatus:
        (product.optimizationStatus as OptimizationStatus) ?? 'pending',
      fitmentStatus:
        (product.fitmentStatus as ProductOptimizationSummary['fitmentStatus']) ??
        'pending',
      ebayValidationStatus:
        product.ebayValidationStatus as ProductOptimizationSummary['ebayValidationStatus'],
      optimizedTitle: product.optimizedTitle,
      validationStatus: payload?.validationStatus ?? 'review',
      uploadReadinessScore:
        payload?.uploadReadinessScore ?? Number(product.readinessScore ?? 0),
      seoScore: Number(product.seoScore ?? 0),
      readinessScore: Number(product.readinessScore ?? 0),
      fitmentConfidence:
        product.fitmentConfidence != null
          ? Number(product.fitmentConfidence)
          : null,
      fitmentRowCount: fitmentRows.length,
      manualReview: Boolean(product.manualReview),
      errors:
        (product.optimizationErrors as unknown as OptimizationIssue[]) ?? [],
      warnings:
        (product.optimizationWarnings as unknown as OptimizationIssue[]) ?? [],
      missingDataReport: payload?.missingDataReport ?? [],
      canPublish: this.canPublish(product),
    };
  }

  private async refreshJobOptimizationCounts(
    jobId: string,
    marketplace?: string,
  ): Promise<void> {
    const products = await this.productRepo.find({
      where: { pipelineJobId: jobId },
      select: [
        'optimizationStatus',
        'optimizationPayload',
        'manualReview',
        'optimizationErrors',
      ],
    });

    let passCount = 0;
    let reviewCount = 0;
    let blockCount = 0;
    let processed = 0;

    for (const p of products) {
      if (
        p.optimizationStatus === 'pending' ||
        p.optimizationStatus === 'running'
      )
        continue;
      processed++;
      const payload = p.optimizationPayload as {
        validationStatus?: string;
      } | null;
      const status = payload?.validationStatus;
      if (status === 'block' || p.optimizationStatus === 'failed') blockCount++;
      else if (
        status === 'review' ||
        p.optimizationStatus === 'needs_review' ||
        p.manualReview
      )
        reviewCount++;
      else if (status === 'pass' && p.optimizationStatus === 'completed')
        passCount++;
      else reviewCount++;
    }

    const job = await this.jobRepo.findOneBy({ id: jobId });

    if (marketplace) {
      const total = job?.optimizationTotal ?? 0;
      // Only finalize a verdict (failed/needs_review/completed) once every
      // product has actually been processed. Computing it off partial counts
      // mid-loop (e.g. 1 block out of 4 processed with 762 still pending)
      // falsely reports "failed" while the job is still actively running.
      const status =
        processed < total
          ? 'running'
          : blockCount > 0 && passCount === 0
            ? 'failed'
            : reviewCount > 0
              ? 'needs_review'
              : 'completed';
      await this.mergeOptimizationByMarketplace(jobId, marketplace, {
        status,
        passCount,
        reviewCount,
        blockCount,
        processed,
        total,
      });
    }

    await this.jobRepo.update(jobId, {
      optimizationProcessed: processed,
      optimizationPassCount: passCount,
      optimizationReviewCount: reviewCount,
      optimizationBlockCount: blockCount,
    } as any);
  }

  /** Atomically merge one marketplace slice into optimization_by_marketplace (avoids lost updates when US/AU/DE run in parallel). */
  private async mergeOptimizationByMarketplace(
    jobId: string,
    marketplace: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.jobRepo.query(
      `UPDATE pipeline_jobs
       SET optimization_by_marketplace = COALESCE(optimization_by_marketplace, '{}'::jsonb) || $2::jsonb
       WHERE id = $1`,
      [jobId, JSON.stringify({ [marketplace]: data })],
    );
  }

  /**
   * Called from the BullMQ processor's catch block when enqueueJobOptimization
   * throws mid-run. Flips the marketplace slice and the job-level aggregate to
   * 'failed' so the UI stops polling a dead job forever instead of showing
   * "Optimizing…" indefinitely.
   */
  async markJobOptimizationFailed(
    jobId: string,
    marketplace: string,
  ): Promise<void> {
    const job = await this.jobRepo.findOneBy({ id: jobId });
    if (!job) return;

    const byMkt = (job.optimizationByMarketplace ?? {}) as Record<string, any>;
    const existing = byMkt[marketplace] ?? {};

    await this.mergeOptimizationByMarketplace(jobId, marketplace, {
      ...existing,
      status: 'failed',
    });
    await this.refreshJobOptimizationAggregate(jobId);
  }

  private async refreshJobOptimizationAggregate(jobId: string): Promise<void> {
    const job = await this.jobRepo.findOneBy({ id: jobId });
    if (!job) return;

    const byMkt = (job.optimizationByMarketplace ?? {}) as Record<string, any>;
    const statuses = Object.values(byMkt).map(
      (v: any) => v.status ?? 'pending',
    );

    let aggregateStatus = 'completed';
    if (statuses.length === 0) aggregateStatus = 'pending';
    else if (statuses.some((s: string) => s === 'running'))
      aggregateStatus = 'running';
    else if (statuses.some((s: string) => s === 'failed'))
      aggregateStatus = 'needs_review';
    else if (statuses.some((s: string) => s === 'needs_review'))
      aggregateStatus = 'needs_review';
    else if (statuses.some((s: string) => s === 'pending'))
      aggregateStatus = 'pending';

    await this.jobRepo.update(jobId, {
      optimizationStatus: aggregateStatus,
      optimizationByMarketplace: byMkt,
    } as any);
  }
}
