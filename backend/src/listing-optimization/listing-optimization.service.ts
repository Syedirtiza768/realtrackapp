import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { PipelineJob } from '../ingestion/entities/pipeline-job.entity.js';
import { EnterpriseListingIntelligenceService } from '../ingestion/enterprise-listing-intelligence.service.js';
import { FitmentDiscoveryService } from './fitment-discovery.service.js';
import { computeSourceDataHash } from './source-data-hash.util.js';
import type {
  JobOptimizationStatus,
  OptimizationIssue,
  OptimizationStatus,
  ProductOptimizationSummary,
} from './listing-optimization.types.js';

const OPTIMIZATION_VERSION = 1;

@Injectable()
export class ListingOptimizationService {
  private readonly logger = new Logger(ListingOptimizationService.name);

  constructor(
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(PipelineJob)
    private readonly jobRepo: Repository<PipelineJob>,
    private readonly fitmentDiscovery: FitmentDiscoveryService,
    private readonly enterprise: EnterpriseListingIntelligenceService,
  ) {}

  async enqueueJobOptimization(jobId: string, marketplace: 'US' | 'DE' | 'AU' = 'US'): Promise<void> {
    await this.jobRepo.update(jobId, {
      optimizationStatus: 'pending',
      optimizationProcessed: 0,
    } as any);

    const products = await this.productRepo.find({
      where: { pipelineJobId: jobId },
      select: ['id'],
    });

    await this.jobRepo.update(jobId, {
      optimizationTotal: products.length,
      optimizationStatus: 'running',
    } as any);

    for (const { id } of products) {
      try {
        await this.optimizeProduct(id, marketplace, { force: false });
      } catch (err) {
        this.logger.error(`Optimization failed for product ${id}: ${String(err)}`);
      }
      await this.refreshJobOptimizationCounts(jobId);
    }

    await this.jobRepo.update(jobId, {
      optimizationStatus: 'completed',
    } as any);
  }

  async optimizeProduct(
    productId: string,
    marketplace: 'US' | 'DE' | 'AU' = 'US',
    options?: { force?: boolean },
  ): Promise<CatalogProduct> {
    const product = await this.productRepo.findOneBy({ id: productId });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    const hash = computeSourceDataHash(product);
    if (
      !options?.force &&
      product.optimizationStatus === 'completed' &&
      product.sourceDataHash === hash
    ) {
      return product;
    }

    await this.productRepo.update(productId, {
      optimizationStatus: 'running',
      fitmentStatus: 'running',
    } as any);

    const fitment = await this.fitmentDiscovery.discover(product);
    const fitmentJson = this.fitmentDiscovery.toFitmentDataJson(fitment.rows);

    await this.productRepo.update(productId, {
      fitmentData: fitmentJson.length > 0 ? fitmentJson : product.fitmentData,
      fitmentRows: fitment.rows as unknown as Record<string, unknown>[],
      fitmentStatus: fitment.status,
      fitmentConfidence: fitment.confidence,
      donorVin: fitment.donorVin,
      donorVinDecoded: fitment.donorVinDecoded,
    } as any);

    const refreshed = await this.productRepo.findOneByOrFail({ id: productId });
    const listing = await this.enterprise.generateForProduct(productId, {
      marketplace,
      listingQualityProfile: 'max_seo_comprehensive',
    });

    const errors: OptimizationIssue[] = listing.complianceWarnings
      .filter((w) => w.severity === 'error')
      .map((w) => ({ code: w.code, severity: w.severity, message: w.message, field: w.field }));

    const warnings: OptimizationIssue[] = [
      ...listing.complianceWarnings
        .filter((w) => w.severity !== 'error')
        .map((w) => ({ code: w.code, severity: w.severity, message: w.message, field: w.field })),
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
      optimizationStatus === 'needs_review' || fitment.status === 'needs_review';

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

    if (product.pipelineJobId) {
      await this.refreshJobOptimizationCounts(product.pipelineJobId);
    }

    return this.productRepo.findOneByOrFail({ id: productId });
  }

  async getJobOptimizationStatus(jobId: string): Promise<JobOptimizationStatus> {
    const job = await this.jobRepo.findOneBy({ id: jobId });
    if (!job) throw new NotFoundException(`Pipeline job ${jobId} not found`);

    const products = await this.productRepo.find({
      where: { pipelineJobId: jobId },
      order: { sourceRow: 'ASC' },
    });

    return {
      jobId,
      optimizationStatus: (job.optimizationStatus as OptimizationStatus) ?? 'pending',
      processed: job.optimizationProcessed ?? 0,
      total: job.optimizationTotal ?? products.length,
      passCount: job.optimizationPassCount ?? 0,
      reviewCount: job.optimizationReviewCount ?? 0,
      blockCount: job.optimizationBlockCount ?? 0,
      products: products.map((p) => this.toProductSummary(p)),
    };
  }

  async getProductOptimization(productId: string): Promise<ProductOptimizationSummary & {
    fitmentRows: unknown;
    fitmentData: unknown;
    optimizationPayload: unknown;
  }> {
    const product = await this.productRepo.findOneBy({ id: productId });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);
    return {
      ...this.toProductSummary(product),
      fitmentRows: product.fitmentRows,
      fitmentData: product.fitmentData,
      optimizationPayload: product.optimizationPayload,
    };
  }

  async markManualReview(productId: string, enabled = true): Promise<CatalogProduct> {
    await this.productRepo.update(productId, {
      manualReview: enabled,
      optimizationStatus: enabled ? 'needs_review' : 'completed',
    } as any);
    return this.productRepo.findOneByOrFail({ id: productId });
  }

  canPublish(product: CatalogProduct): boolean {
    if (product.optimizationStatus !== 'completed') return false;
    if (product.manualReview) return false;
    const payload = product.optimizationPayload as { validationStatus?: string } | null;
    if (payload?.validationStatus === 'block') return false;
    const errors = (product.optimizationErrors as unknown as OptimizationIssue[]) ?? [];
    if (errors.some((e) => e.severity === 'error')) return false;
    return true;
  }

  private toProductSummary(product: CatalogProduct): ProductOptimizationSummary {
    const payload = product.optimizationPayload as {
      validationStatus?: 'pass' | 'review' | 'block';
      uploadReadinessScore?: number;
      missingDataReport?: string[];
    } | null;

    const fitmentRows = Array.isArray(product.fitmentRows) ? product.fitmentRows : [];

    return {
      productId: product.id,
      sku: product.sku,
      optimizationStatus: (product.optimizationStatus as OptimizationStatus) ?? 'pending',
      fitmentStatus: (product.fitmentStatus as ProductOptimizationSummary['fitmentStatus']) ?? 'pending',
      ebayValidationStatus: product.ebayValidationStatus as ProductOptimizationSummary['ebayValidationStatus'],
      optimizedTitle: product.optimizedTitle,
      validationStatus: payload?.validationStatus ?? 'review',
      uploadReadinessScore: payload?.uploadReadinessScore ?? Number(product.readinessScore ?? 0),
      seoScore: Number(product.seoScore ?? 0),
      readinessScore: Number(product.readinessScore ?? 0),
      fitmentConfidence: product.fitmentConfidence != null ? Number(product.fitmentConfidence) : null,
      fitmentRowCount: fitmentRows.length,
      manualReview: Boolean(product.manualReview),
      errors: (product.optimizationErrors as unknown as OptimizationIssue[]) ?? [],
      warnings: (product.optimizationWarnings as unknown as OptimizationIssue[]) ?? [],
      missingDataReport: payload?.missingDataReport ?? [],
      canPublish: this.canPublish(product),
    };
  }

  private async refreshJobOptimizationCounts(jobId: string): Promise<void> {
    const products = await this.productRepo.find({
      where: { pipelineJobId: jobId },
      select: ['optimizationStatus', 'optimizationPayload', 'manualReview', 'optimizationErrors'],
    });

    let passCount = 0;
    let reviewCount = 0;
    let blockCount = 0;
    let processed = 0;

    for (const p of products) {
      if (p.optimizationStatus === 'pending' || p.optimizationStatus === 'running') continue;
      processed++;
      const payload = p.optimizationPayload as { validationStatus?: string } | null;
      const status = payload?.validationStatus;
      if (status === 'block' || p.optimizationStatus === 'failed') blockCount++;
      else if (status === 'review' || p.optimizationStatus === 'needs_review' || p.manualReview)
        reviewCount++;
      else if (status === 'pass' && p.optimizationStatus === 'completed') passCount++;
      else reviewCount++;
    }

    await this.jobRepo.update(jobId, {
      optimizationProcessed: processed,
      optimizationPassCount: passCount,
      optimizationReviewCount: reviewCount,
      optimizationBlockCount: blockCount,
    } as any);
  }
}
