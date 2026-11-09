import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { EbayHostedImage } from '../integrations/ebay/entities/ebay-hosted-image.entity.js';
import { EbayListingJobTarget } from '../integrations/ebay/entities/ebay-listing-job-target.entity.js';
import { ListingActionLog } from '../integrations/ebay/entities/listing-action-log.entity.js';
import { EbayMultiStoreListingService } from '../integrations/ebay/services/ebay-multi-store-listing.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { FashionListingsService } from '../verticals/fashion-listings.service.js';
import { VerticalsService } from '../verticals/verticals.service.js';
import {
  FashionComplianceConfigRow,
  FashionListingPipeline,
  FashionPublishBatch,
  FashionPublishBatchItem,
  type AiSuggestion,
  type FashionPipelineState,
  type PipelineImage,
} from './entities/fashion-publish.entities.js';
import {
  checkListingText,
  decide,
  mergeComplianceConfig,
  riskScore,
  type ComplianceDecision,
  type ComplianceFix,
  type ComplianceIssue,
  type ComplianceListing,
  type FashionComplianceConfig,
} from './fashion-compliance.rules.js';
import {
  EBAY_MASTER_IMAGE_SET_KEY,
  type EbayMasterImageSet,
} from './fashion-ebay-images.util.js';
import {
  ebayMasterUrls,
  FashionImagePipelineService,
} from './fashion-image-pipeline.service.js';
import {
  FashionVisionCheckService,
  visionIssues,
  type VisionVerdict,
} from './fashion-vision-check.service.js';

export const FASHION_BATCH_QUEUE = 'fashion-batch-publish';
export const MAX_BATCH_SIZE = 500;

export type FashionBatchJob =
  | { kind: 'process'; itemId: string }
  | { kind: 'sync'; itemId: string; attempt: number };

/** States a batch item can finish in. */
const DRY_RUN_FINAL: FashionPipelineState[] = ['READY', 'NEEDS_REVIEW', 'BLOCKED', 'FAILED'];
const LIVE_FINAL: FashionPipelineState[] = ['PUBLISHED', 'NEEDS_REVIEW', 'BLOCKED', 'FAILED'];
const SYNC_DELAY_MS = 15_000;
const SYNC_MAX_ATTEMPTS = 120; // ~30 minutes

interface Evaluation {
  decision: ComplianceDecision;
  risk: number;
  issues: ComplianceIssue[];
  fixes: ComplianceFix[];
  fixed: ComplianceListing;
  images: PipelineImage[];
  masterUrls: string[];
  suggestion: AiSuggestion | null;
  vision: VisionVerdict | null;
  fingerprint: string | null;
}

const attr = (p: CatalogProduct): Record<string, unknown> =>
  (p.verticalAttributes ?? {}) as Record<string, unknown>;

function firstString(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null;
  if (Array.isArray(v)) return firstString(v[0]);
  return null;
}

export function listingSnapshot(p: CatalogProduct): ComplianceListing {
  const a = attr(p);
  const specifics = (a._sourceItemSpecifics ?? {}) as Record<string, unknown>;
  return {
    title: p.title ?? '',
    description: p.description ?? null,
    brand: p.brand ?? null,
    brandSpecific: firstString(a.brand) ?? firstString(specifics.Brand) ?? null,
    price: p.price != null ? Number(p.price) : null,
    categoryId: p.categoryId ?? null,
    categoryName: p.categoryName ?? null,
  };
}

function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

@Injectable()
export class FashionBatchPublishService {
  private readonly logger = new Logger(FashionBatchPublishService.name);

  constructor(
    private readonly db: DataSource,
    @InjectQueue(FASHION_BATCH_QUEUE) private readonly queue: Queue<FashionBatchJob>,
    @InjectRepository(FashionListingPipeline)
    private readonly pipelineRepo: Repository<FashionListingPipeline>,
    @InjectRepository(FashionPublishBatch)
    private readonly batchRepo: Repository<FashionPublishBatch>,
    @InjectRepository(FashionPublishBatchItem)
    private readonly itemRepo: Repository<FashionPublishBatchItem>,
    @InjectRepository(FashionComplianceConfigRow)
    private readonly configRepo: Repository<FashionComplianceConfigRow>,
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(ListingActionLog)
    private readonly auditRepo: Repository<ListingActionLog>,
    @InjectRepository(EbayListingJobTarget)
    private readonly targetRepo: Repository<EbayListingJobTarget>,
    @InjectRepository(EbayHostedImage)
    private readonly hostedImageRepo: Repository<EbayHostedImage>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly organizations: UserOrganizationService,
    private readonly stores: StoreAccessService,
    private readonly rbac: RbacService,
    private readonly verticals: VerticalsService,
    private readonly fashion: FashionListingsService,
    private readonly listings: EbayMultiStoreListingService,
    private readonly imagePipeline: FashionImagePipelineService,
    private readonly vision: FashionVisionCheckService,
  ) {}

  // -------------------------------------------------------------------------
  // Batch creation
  // -------------------------------------------------------------------------

  async createBatch(
    user: User,
    dto: {
      size: number;
      dryRun: boolean;
      ebayAccountId?: string;
      marketplaceId?: string;
      confirmAuthenticity?: boolean;
      organizationId?: string;
    },
  ) {
    const { organizationId } = await this.organizations.resolveOrganizationId(
      user.id,
      dto.organizationId,
    );
    await this.verticals.assertFeatureEnabled();
    const size = Math.floor(Number(dto.size));
    if (!(size >= 1 && size <= MAX_BATCH_SIZE))
      throw new BadRequestException(`Batch size must be 1–${MAX_BATCH_SIZE}`);

    let marketplaceId: string | null = null;
    let ebayAccountId: string | null = null;
    let confirmedByUserId: string | null = null;
    if (dto.ebayAccountId) {
      const account = await this.fashion.account(dto.ebayAccountId, organizationId);
      await this.stores.assertStoreAccess(user, account.primaryStoreId, 'operate');
      marketplaceId = dto.marketplaceId || account.primaryStore.ebayMarketplaceId || null;
      if (
        !marketplaceId ||
        !account.marketplaces.some((m) => m.enabled && m.marketplaceId === marketplaceId)
      )
        throw new BadRequestException('Marketplace is not enabled for this Fashion seller account');
      if (!dto.dryRun && account.connectionStatus !== 'active')
        throw new BadRequestException(
          `The eBay account for ${account.primaryStore.storeName} needs to be reconnected before publishing`,
        );
      ebayAccountId = account.id;
    }
    if (!dto.dryRun) {
      if (!ebayAccountId)
        throw new BadRequestException('Choose the eBay store to publish to');
      if (dto.confirmAuthenticity !== true)
        throw new BadRequestException(
          'A live batch needs a reviewer to confirm authenticity for listings that pass the compliance check',
        );
      for (const key of ['fashion.review', 'fashion.authenticity.review'])
        if (!(await this.rbac.userHasPermission(user.id, key)))
          throw new ForbiddenException(
            'Only a Fashion reviewer can confirm authenticity for a live batch',
          );
      confirmedByUserId = user.id;
    }

    const result = await this.db.transaction(async (manager) => {
      // One picker at a time per organisation: no double-picking.
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `fashion-batch-publish:${organizationId}`,
      ]);
      const batch = await manager.getRepository(FashionPublishBatch).save(
        manager.getRepository(FashionPublishBatch).create({
          organizationId,
          requestedByUserId: user.id,
          requestedSize: size,
          dryRun: dto.dryRun,
          ebayAccountId,
          marketplaceId,
          confirmedByUserId,
          status: 'queued',
        }),
      );
      // Live batches also take listings a dry run already marked READY.
      const states = dto.dryRun ? ['UNPUBLISHED'] : ['UNPUBLISHED', 'READY'];
      const rows: Array<{ id: string }> = await manager.query(
        `SELECT p.id
           FROM catalog_products p
           LEFT JOIN fashion_listing_pipeline f ON f.catalog_product_id = p.id
          WHERE p.organization_id = $1
            AND p.vertical = 'fashion'
            AND p.ebay_item_id IS NULL
            AND p.manual_review = false
            AND COALESCE(p.vertical_validation_status, '') NOT IN ('deleted', 'quarantined', 'rejected')
            AND NOT EXISTS (
              SELECT 1 FROM ebay_listing_channels c
               WHERE c.catalog_product_id = p.id
                 AND c.listing_status IN ('published', 'active'))
            AND (f.catalog_product_id IS NULL
                 OR (f.active_batch_id IS NULL AND f.state = ANY($2)))
          ORDER BY p."createdAt" ASC, p.id ASC
          LIMIT $3
          FOR UPDATE OF p SKIP LOCKED`,
        [organizationId, states, size],
      );
      if (!rows.length) {
        batch.status = 'completed';
        batch.completedAt = new Date();
        await manager.getRepository(FashionPublishBatch).save(batch);
        return { batch, itemIds: [] as string[] };
      }
      const ids = rows.map((r) => r.id);
      await manager.query(
        `INSERT INTO fashion_listing_pipeline (catalog_product_id, organization_id, state, active_batch_id, last_batch_id)
         SELECT unnest($1::uuid[]), $2, 'UNPUBLISHED', $3, $3
         ON CONFLICT (catalog_product_id) DO UPDATE
           SET active_batch_id = EXCLUDED.active_batch_id,
               last_batch_id = EXCLUDED.last_batch_id,
               updated_at = now()`,
        [ids, organizationId, batch.id],
      );
      const items = await manager.getRepository(FashionPublishBatchItem).save(
        ids.map((catalogProductId, position) =>
          manager.getRepository(FashionPublishBatchItem).create({
            batchId: batch.id,
            organizationId,
            catalogProductId,
            position,
            state: 'UNPUBLISHED',
          }),
        ),
      );
      return { batch, itemIds: items.map((i) => i.id) };
    });

    if (result.itemIds.length) {
      await this.queue.addBulk(
        result.itemIds.map((itemId) => ({
          name: 'process',
          data: { kind: 'process' as const, itemId },
          opts: { jobId: `fbp-process-${itemId}` },
        })),
      );
      await this.batchRepo.update(result.batch.id, { status: 'running' });
    }
    return {
      batchId: result.batch.id,
      picked: result.itemIds.length,
      dryRun: dto.dryRun,
      message: result.itemIds.length
        ? `${result.itemIds.length} listing(s) queued`
        : 'No unpublished Fashion listings left to pick',
    };
  }

  // -------------------------------------------------------------------------
  // Worker: one listing through the pipeline
  // -------------------------------------------------------------------------

  async processItem(itemId: string): Promise<void> {
    const item = await this.itemRepo.findOneBy({ id: itemId });
    if (!item) return;
    const batch = await this.batchRepo.findOneByOrFail({ id: item.batchId });
    const finals = batch.dryRun ? DRY_RUN_FINAL : LIVE_FINAL;
    if (finals.includes(item.state) || item.state === 'PUBLISHING') return;

    try {
      const product = await this.productRepo.findOneBy({ id: item.catalogProductId });
      if (!product || product.vertical !== 'fashion')
        throw new Error('Fashion catalog product no longer exists');
      const pipeline = await this.pipelineRepo.findOneByOrFail({
        catalogProductId: product.id,
      });

      // Always re-run: images are reused by content hash and the vision verdict
      // by fingerprint, so a listing a dry run already checked costs almost
      // nothing, and any edit since then is caught.
      let evaluation: Evaluation;
      {
        await this.setState(item, pipeline, 'IMAGES_PROCESSING');
        const images = await this.imagePipeline.process(
          product.id,
          product.imageUrls ?? [],
          pipeline.images,
        );
        pipeline.images = images.images;
        pipeline.ebayMasterUrls = images.masterUrls;
        await this.setState(item, pipeline, 'IMAGES_READY');
        await this.audit(product, null, 'fashion.batch.images', images.masterUrls.length ? 'success' : 'failed', undefined, {
          batchId: batch.id,
          processed: images.images.length,
          usable: images.masterUrls.length,
          reused: images.images.filter((i) => i.reused).length,
          lowQuality: images.images.filter((i) => i.flags.includes('low_quality')).length,
          failed: images.images.filter((i) => i.error).map((i) => ({ index: i.index, error: i.error })),
        });

        await this.setState(item, pipeline, 'COMPLIANCE_CHECK');
        const config = await this.config(product.organizationId!);
        evaluation = await this.evaluate(product, pipeline, config);
        this.storeEvaluation(pipeline, evaluation);

        // Dry runs report fixes without touching the catalog.
        if (!batch.dryRun && evaluation.decision !== 'BLOCKED')
          await this.applyFixesToProduct(product, evaluation, batch.id, null);
        await this.audit(product, null, 'fashion.batch.compliance', evaluation.decision.toLowerCase(), undefined, {
          batchId: batch.id,
          dryRun: batch.dryRun,
          riskScore: evaluation.risk,
          issues: evaluation.issues,
          fixes: evaluation.fixes,
          visionModel: evaluation.vision?.model ?? null,
        });
      }

      const decision = evaluation.decision;
      const next: FashionPipelineState =
        decision === 'BLOCKED' ? 'BLOCKED' : decision === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW' : 'READY';

      if (batch.dryRun || next !== 'READY') {
        await this.finish(item, pipeline, next, null);
        return;
      }
      await this.setState(item, pipeline, 'READY');
      await this.publish(item, pipeline, batch, product);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Batch item ${itemId} failed: ${message}`);
      const pipeline = await this.pipelineRepo.findOneBy({ catalogProductId: item.catalogProductId });
      if (pipeline) {
        await this.finish(item, pipeline, 'FAILED', message.slice(0, 2000));
        const product = await this.productRepo.findOneBy({ id: item.catalogProductId });
        if (product) await this.audit(product, null, 'fashion.batch.failed', 'failed', undefined, { batchId: item.batchId, message });
      }
    }
  }

  private async publish(
    item: FashionPublishBatchItem,
    pipeline: FashionListingPipeline,
    batch: FashionPublishBatch,
    product: CatalogProduct,
  ) {
    const reviewer = await this.userRepo.findOneByOrFail({ id: batch.confirmedByUserId! });
    // Record the reviewer's batch confirmation as this listing's approval.
    const review = await this.fashion.getReview(reviewer, product.id, batch.organizationId);
    if (review.status !== 'approved' || !review.authenticityConfirmed) {
      await this.fashion.review(
        reviewer,
        product.id,
        {
          decision: 'approved',
          authenticityConfirmed: true,
          notes: `Approved via Fashion batch ${batch.id}: compliance ${pipeline.complianceResult} (risk ${pipeline.riskScore}); reviewer confirmed authenticity for passing listings.`,
        },
        batch.organizationId,
      );
    }
    pipeline.approvedByUserId = reviewer.id;
    pipeline.ebayAccountId = batch.ebayAccountId;
    pipeline.marketplaceId = batch.marketplaceId;
    await this.setState(item, pipeline, 'PUBLISHING');

    const { job } = await this.listings.createPublishJob({
      organizationId: batch.organizationId,
      requestedByUserId: reviewer.id,
      catalogProductId: product.id,
      targets: [{ ebayAccountId: batch.ebayAccountId!, marketplaceId: batch.marketplaceId! }],
      // Same listing + store + attempt → same job: re-running never double-lists.
      idempotencyKey: `fbp:${product.id}:${batch.ebayAccountId}:${batch.marketplaceId}:${pipeline.publishAttempt}`,
    });
    pipeline.listingJobId = job.id;
    await this.pipelineRepo.save(pipeline);
    await this.audit(product, reviewer.id, 'fashion.batch.publish.queued', 'processing', undefined, {
      batchId: batch.id,
      listingJobId: job.id,
      ebayAccountId: batch.ebayAccountId,
      marketplaceId: batch.marketplaceId,
      masterImages: pipeline.ebayMasterUrls.length,
    });
    await this.queue.add(
      'sync',
      { kind: 'sync', itemId: item.id, attempt: 1 },
      { delay: SYNC_DELAY_MS, jobId: `fbp-sync-${item.id}-${pipeline.publishAttempt}-1` },
    );
  }

  /** Follow the eBay publish job until it lands, then record the outcome. */
  async syncItem(itemId: string, attempt: number): Promise<void> {
    const item = await this.itemRepo.findOneBy({ id: itemId });
    if (!item || item.state !== 'PUBLISHING') return;
    const done = await this.syncPublishing(item);
    if (done) return;
    if (attempt >= SYNC_MAX_ATTEMPTS) {
      const pipeline = await this.pipelineRepo.findOneByOrFail({ catalogProductId: item.catalogProductId });
      await this.finish(item, pipeline, 'FAILED', 'Timed out waiting for the eBay publish job; check the job and retry');
      return;
    }
    const pipeline = await this.pipelineRepo.findOneByOrFail({ catalogProductId: item.catalogProductId });
    await this.queue.add(
      'sync',
      { kind: 'sync', itemId, attempt: attempt + 1 },
      { delay: SYNC_DELAY_MS, jobId: `fbp-sync-${itemId}-${pipeline.publishAttempt}-${attempt + 1}` },
    );
  }

  /** Returns true when the item reached a final state. */
  private async syncPublishing(item: FashionPublishBatchItem): Promise<boolean> {
    const pipeline = await this.pipelineRepo.findOneByOrFail({ catalogProductId: item.catalogProductId });
    if (!pipeline.listingJobId) return false;
    const target = await this.targetRepo.findOne({
      where: { listingJobId: pipeline.listingJobId, catalogProductId: item.catalogProductId },
      relations: ['ebayAccount'],
    });
    if (!target || target.status === 'pending' || target.status === 'processing') return false;
    const product = await this.productRepo.findOneByOrFail({ id: item.catalogProductId });
    const payload = (target.resultPayload ?? {}) as Record<string, unknown>;
    if (target.status === 'success' || target.status === 'skipped') {
      const listingId =
        (typeof payload.listingId === 'string' && payload.listingId) ||
        (typeof payload.duplicateExistingListingId === 'string' && payload.duplicateExistingListingId) ||
        product.ebayItemId;
      pipeline.ebayItemId = listingId || null;
      pipeline.ebayOfferId = typeof payload.offerId === 'string' ? payload.offerId : null;
      pipeline.publishedAt = new Date();
      const storeId = target.ebayAccount?.primaryStoreId;
      if (storeId && pipeline.ebayMasterUrls.length) {
        const hosted = await this.hostedImageRepo.find({
          where: { storeId, sourceUrl: In(pipeline.ebayMasterUrls) },
        });
        const bySource = new Map(hosted.map((h) => [h.sourceUrl, h.hostedUrl]));
        pipeline.ebayImageUrls = pipeline.ebayMasterUrls
          .map((u) => bySource.get(u))
          .filter((u): u is string => !!u);
      }
      item.ebayItemId = pipeline.ebayItemId;
      await this.finish(item, pipeline, 'PUBLISHED', null);
      await this.audit(product, pipeline.approvedByUserId, 'fashion.batch.publish.success', 'success', undefined, {
        batchId: item.batchId,
        ebayItemId: pipeline.ebayItemId,
        offerId: pipeline.ebayOfferId,
        ebayImageUrls: pipeline.ebayImageUrls,
        duplicate: target.status === 'skipped',
      });
      return true;
    }
    const err = (target.errorPayload ?? {}) as Record<string, unknown>;
    const errors = Array.isArray(err.errors) ? err.errors.filter((e) => typeof e === 'string') : [];
    const message =
      [typeof err.message === 'string' ? err.message : null, ...errors].filter(Boolean).join(' — ') ||
      `eBay publish ${target.status}`;
    await this.finish(item, pipeline, 'FAILED', message.slice(0, 2000));
    await this.audit(product, pipeline.approvedByUserId, 'fashion.batch.publish.failed', 'failed', undefined, {
      batchId: item.batchId,
      listingJobId: pipeline.listingJobId,
      message,
    });
    return true;
  }

  // -------------------------------------------------------------------------
  // Compliance evaluation
  // -------------------------------------------------------------------------

  private async evaluate(
    product: CatalogProduct,
    pipeline: FashionListingPipeline,
    config: FashionComplianceConfig,
    opts: { skipVision?: boolean } = {},
  ): Promise<Evaluation> {
    const text = checkListingText(listingSnapshot(product), config);
    const issues: ComplianceIssue[] = [...text.issues];
    const fixes: ComplianceFix[] = [...text.fixes];
    // Fresh copy so dropped-image decisions are recomputed every run.
    const images: PipelineImage[] = pipeline.images.map((i) => ({
      ...i,
      excluded:
        i.excluded && !['IMAGE_WATERMARK', 'IMAGE_OFF_PRODUCT', 'IMAGE_COLLAGE', 'IMAGE_TEXT_OVERLAY'].includes(i.excluded.code)
          ? i.excluded
          : null,
    }));

    for (const img of images) {
      if (img.error)
        issues.push({ code: 'IMAGE_FETCH_FAILED', severity: 'warn', field: 'images', source: 'image', imageIndex: img.index, message: `Photo ${img.index + 1} could not be processed: ${img.error}` });
      else if (img.excluded?.code === 'IMAGE_TOO_SMALL')
        issues.push({ code: 'IMAGE_TOO_SMALL', severity: 'warn', field: 'images', source: 'image', imageIndex: img.index, autoFixed: true, message: `${img.excluded.reason}; removed from the eBay photo set` });
      else if (img.flags.includes('low_quality'))
        issues.push({ code: 'IMAGE_LOW_RESOLUTION', severity: 'info', field: 'images', source: 'image', imageIndex: img.index, message: `Photo ${img.index + 1} is ${Math.max(img.width ?? 0, img.height ?? 0)}px on its longest side (under 1600px)` });
    }

    let vision: VisionVerdict | null = null;
    let fingerprint: string | null = null;
    const usable = images.filter((i) => !i.excluded && !i.error);
    if (usable.length && !opts.skipVision) {
      const input = {
        title: text.fixed.title,
        description: product.description,
        brand: text.declaredBrand,
        categoryName: product.categoryName,
        color: firstString(attr(product).color),
        textIssues: text.issues,
        images: usable,
      };
      fingerprint = this.vision.fingerprint(input);
      if (pipeline.visionFingerprint === fingerprint && pipeline.visionResult) {
        vision = pipeline.visionResult as unknown as VisionVerdict;
      } else {
        try {
          vision = await this.vision.check(input);
        } catch (error) {
          issues.push({
            code: 'VISION_CHECK_UNAVAILABLE',
            severity: 'review',
            field: 'images',
            source: 'vision',
            message: `Image check could not run (${error instanceof Error ? error.message : error}); review the photos manually`,
          });
          fingerprint = null;
        }
      }
    } else if (opts.skipVision && pipeline.visionResult) {
      vision = pipeline.visionResult as unknown as VisionVerdict;
      fingerprint = pipeline.visionFingerprint;
    }

    if (vision) {
      const v = visionIssues(vision, images);
      issues.push(...v.issues);
      for (const [index, reason] of v.dropIndexes) {
        const img = images.find((i) => i.index === index);
        if (img) img.excluded = reason;
      }
      if (v.dropIndexes.size)
        fixes.push({
          field: 'images',
          before: usable.map((i) => i.index),
          after: images.filter((i) => !i.excluded && !i.error).map((i) => i.index),
          reason: [...v.dropIndexes.values()].map((d) => d.reason).join('; '),
        });
    }

    const masterUrls = ebayMasterUrls(images);
    if (!masterUrls.length)
      issues.push({ code: 'NO_USABLE_IMAGES', severity: 'review', field: 'images', source: 'image', message: 'No photo is usable for eBay (at least one is required)' });

    const decision = decide(issues);
    let suggestion: AiSuggestion | null = null;
    if (decision === 'NEEDS_REVIEW' && vision?.suggestedFix) {
      const s = vision.suggestedFix;
      const after = {
        title: s.title ?? text.fixed.title,
        description: s.description ?? product.description,
        brand: s.brand ?? text.fixed.brandSpecific ?? product.brand,
      };
      const before = { title: text.fixed.title, description: product.description, brand: text.fixed.brandSpecific ?? product.brand };
      if (JSON.stringify(after) !== JSON.stringify(before))
        suggestion = { before, after, rationale: s.rationale, model: vision.model ?? null, status: 'pending', createdAt: new Date().toISOString() };
    }

    return {
      decision,
      risk: riskScore(issues),
      issues,
      fixes,
      fixed: text.fixed,
      images,
      masterUrls,
      suggestion,
      vision,
      fingerprint,
    };
  }

  private storeEvaluation(pipeline: FashionListingPipeline, e: Evaluation) {
    pipeline.complianceResult = e.decision;
    pipeline.riskScore = e.risk;
    pipeline.issues = e.issues;
    pipeline.fixes = e.fixes;
    pipeline.images = e.images;
    pipeline.ebayMasterUrls = e.masterUrls;
    // Keep an applied/edited suggestion on record; replace pending ones.
    if (!pipeline.suggestion || pipeline.suggestion.status === 'pending' || e.suggestion)
      pipeline.suggestion = e.suggestion ?? (pipeline.suggestion?.status === 'pending' ? null : pipeline.suggestion);
    pipeline.visionResult = (e.vision as unknown as Record<string, unknown>) ?? null;
    pipeline.visionFingerprint = e.fingerprint;
    pipeline.checkedAt = new Date();
  }

  /** Persist safe auto-fixes + the eBay master set onto the catalog product. */
  private async applyFixesToProduct(
    product: CatalogProduct,
    e: Evaluation,
    batchId: string | null,
    userId: string | null,
  ) {
    const before = { title: product.title, brand: product.brand, brandSpecific: listingSnapshot(product).brandSpecific };
    const attrs = { ...attr(product) };
    let changed = false;
    if (e.fixed.title && e.fixed.title !== product.title) {
      product.title = e.fixed.title;
      changed = true;
    }
    if (e.fixes.some((f) => f.field === 'brand') && e.fixed.brandSpecific) {
      attrs.brand = e.fixed.brandSpecific;
      if (!product.brand) product.brand = e.fixed.brandSpecific;
      changed = true;
    }
    const set: EbayMasterImageSet = {
      sourceUrls: (product.imageUrls ?? []).map((u) => u.trim()),
      masterUrls: e.masterUrls,
      batchId,
      createdAt: new Date().toISOString(),
    };
    attrs[EBAY_MASTER_IMAGE_SET_KEY] = set;
    // jsonb column; the declared attribute type does not model nested objects.
    product.verticalAttributes = attrs as CatalogProduct['verticalAttributes'];
    await this.productRepo.save(product);
    if (changed)
      await this.audit(product, userId, 'fashion.batch.autofix', 'success', before, {
        title: product.title,
        brand: product.brand,
        brandSpecific: attrs.brand ?? null,
        fixes: e.fixes,
      });
  }

  // -------------------------------------------------------------------------
  // State helpers
  // -------------------------------------------------------------------------

  private async setState(item: FashionPublishBatchItem, pipeline: FashionListingPipeline, state: FashionPipelineState) {
    item.state = state;
    pipeline.state = state;
    item.complianceResult = pipeline.complianceResult;
    item.riskScore = pipeline.riskScore;
    item.issueCodes = [...new Set((pipeline.issues ?? []).filter((i) => i.severity !== 'info').map((i) => i.code))];
    await this.pipelineRepo.save(pipeline);
    await this.itemRepo.save(item);
  }

  private async finish(item: FashionPublishBatchItem, pipeline: FashionListingPipeline, state: FashionPipelineState, error: string | null) {
    pipeline.activeBatchId = null;
    pipeline.lastError = error;
    item.error = error;
    item.finishedAt = new Date();
    await this.setState(item, pipeline, state);
    await this.refreshBatchStatus(item.batchId);
  }

  private async refreshBatchStatus(batchId: string) {
    const open = await this.itemRepo
      .createQueryBuilder('i')
      .where('i.batch_id = :batchId', { batchId })
      .andWhere('i.finished_at IS NULL')
      .getCount();
    if (!open)
      await this.batchRepo.update(
        { id: batchId, status: In(['queued', 'running']) },
        { status: 'completed', completedAt: new Date() },
      );
  }

  private async audit(
    product: CatalogProduct,
    userId: string | null,
    action: string,
    result: string,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
  ) {
    try {
      await this.auditRepo.save(
        this.auditRepo.create({
          organizationId: product.organizationId!,
          catalogProductId: product.id,
          userId,
          action,
          result,
          beforeSnapshot: before ?? null,
          afterSnapshot: after ?? null,
        }),
      );
    } catch (error) {
      this.logger.warn(`Audit write failed for ${product.id}: ${error instanceof Error ? error.message : error}`);
    }
  }

  async config(organizationId: string): Promise<FashionComplianceConfig> {
    const row = await this.configRepo.findOneBy({ organizationId });
    return mergeComplianceConfig(row?.config as Partial<FashionComplianceConfig> | undefined);
  }

  // -------------------------------------------------------------------------
  // Read APIs
  // -------------------------------------------------------------------------

  private async org(user: User, organizationId?: string) {
    return (await this.organizations.resolveOrganizationId(user.id, organizationId)).organizationId;
  }

  async listBatches(user: User, organizationId?: string) {
    const org = await this.org(user, organizationId);
    const batches = await this.batchRepo.find({
      where: { organizationId: org },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    const counts = await this.stateCounts(batches.map((b) => b.id));
    return batches.map((b) => ({ ...b, counts: counts.get(b.id) ?? {} }));
  }

  private async stateCounts(batchIds: string[]) {
    const out = new Map<string, Record<string, number>>();
    if (!batchIds.length) return out;
    const rows: Array<{ batch_id: string; state: string; n: string }> = await this.db.query(
      `SELECT batch_id, state, count(*) n FROM fashion_publish_batch_items WHERE batch_id = ANY($1) GROUP BY 1, 2`,
      [batchIds],
    );
    for (const r of rows) {
      const m = out.get(r.batch_id) ?? {};
      m[r.state] = Number(r.n);
      out.set(r.batch_id, m);
    }
    return out;
  }

  async getBatch(user: User, id: string, organizationId?: string) {
    const org = await this.org(user, organizationId);
    const batch = await this.batchRepo.findOneBy({ id, organizationId: org });
    if (!batch) throw new NotFoundException('Batch not found');
    // Catch up on publish results without waiting for the next sync job.
    const publishing = await this.itemRepo.find({ where: { batchId: id, state: 'PUBLISHING' } });
    for (const item of publishing) await this.syncPublishing(item).catch(() => false);
    const items: Array<Record<string, unknown>> = await this.db.query(
      `SELECT i.id, i.position, i.catalog_product_id AS "catalogProductId", i.state, i.compliance_result AS "complianceResult",
              i.risk_score AS "riskScore", i.issue_codes AS "issueCodes", i.ebay_item_id AS "ebayItemId", i.error,
              i.finished_at AS "finishedAt", p.sku, p.title, p.brand, p.price,
              f.ebay_master_urls AS "ebayMasterUrls", f.images->0->'urls'->>'thumb' AS "thumbUrl"
         FROM fashion_publish_batch_items i
         JOIN catalog_products p ON p.id = i.catalog_product_id
         LEFT JOIN fashion_listing_pipeline f ON f.catalog_product_id = i.catalog_product_id
        WHERE i.batch_id = $1
        ORDER BY i.position`,
      [id],
    );
    const counts = (await this.stateCounts([id])).get(id) ?? {};
    const issueTotals = new Map<string, number>();
    for (const it of items)
      for (const code of (it.issueCodes as string[]) ?? []) issueTotals.set(code, (issueTotals.get(code) ?? 0) + 1);
    return {
      ...batch,
      status: (await this.batchRepo.findOneBy({ id }))!.status,
      counts,
      topIssues: [...issueTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([code, count]) => ({ code, count })),
      items,
    };
  }

  async reportCsv(user: User, id: string, organizationId?: string): Promise<string> {
    const org = await this.org(user, organizationId);
    const batch = await this.batchRepo.findOneBy({ id, organizationId: org });
    if (!batch) throw new NotFoundException('Batch not found');
    const rows: Array<Record<string, unknown>> = await this.db.query(
      `SELECT i.catalog_product_id, p.sku, p.title, i.state, i.compliance_result, i.risk_score,
              f.issues, i.ebay_item_id, f.published_at, i.error
         FROM fashion_publish_batch_items i
         JOIN catalog_products p ON p.id = i.catalog_product_id
         LEFT JOIN fashion_listing_pipeline f ON f.catalog_product_id = i.catalog_product_id
        WHERE i.batch_id = $1 ORDER BY i.position`,
      [id],
    );
    const header = ['listing_id', 'sku', 'title', 'status', 'compliance_result', 'risk_score', 'issues', 'ebay_item_id', 'published_at', 'error'];
    const lines = rows.map((r) => {
      const issues = ((r.issues as ComplianceIssue[]) ?? [])
        .filter((i) => i.severity !== 'info')
        .map((i) => `${i.code}${i.autoFixed ? ' (fixed)' : ''}: ${i.message}`)
        .join(' | ');
      return [r.catalog_product_id, r.sku, r.title, r.state, r.compliance_result, r.risk_score, issues, r.ebay_item_id, r.published_at ? new Date(r.published_at as string).toISOString() : '', r.error]
        .map(csvCell)
        .join(',');
    });
    return [header.join(','), ...lines].join('\r\n') + '\r\n';
  }

  async reviewQueue(user: User, state: 'NEEDS_REVIEW' | 'BLOCKED', organizationId?: string, limit = 100) {
    const org = await this.org(user, organizationId);
    const rows = await this.pipelineRepo.find({
      where: { organizationId: org, state, activeBatchId: IsNull() },
      order: { riskScore: 'DESC', updatedAt: 'ASC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    const products = await this.productRepo.find({ where: { id: In(rows.map((r) => r.catalogProductId)) } });
    const byId = new Map(products.map((p) => [p.id, p]));
    return rows
      .filter((r) => byId.has(r.catalogProductId))
      .map((r) => this.reviewView(r, byId.get(r.catalogProductId)!));
  }

  async reviewItem(user: User, productId: string, organizationId?: string) {
    const { pipeline, product } = await this.loadForReview(user, productId, organizationId);
    return this.reviewView(pipeline, product);
  }

  private reviewView(r: FashionListingPipeline, p: CatalogProduct) {
    const snap = listingSnapshot(p);
    return {
      catalogProductId: r.catalogProductId,
      state: r.state,
      complianceResult: r.complianceResult,
      riskScore: r.riskScore,
      issues: r.issues,
      fixes: r.fixes,
      suggestion: r.suggestion,
      images: r.images.map((i) => ({
        index: i.index,
        thumb: i.urls.small ?? i.urls.thumb ?? null,
        width: i.width,
        height: i.height,
        flags: i.flags,
        excluded: i.excluded,
        error: i.error,
      })),
      ebayMasterUrls: r.ebayMasterUrls,
      checkedAt: r.checkedAt,
      lastError: r.lastError,
      listing: {
        id: p.id,
        sku: p.sku,
        title: p.title,
        description: p.description,
        brand: p.brand,
        brandSpecific: snap.brandSpecific,
        price: p.price,
        categoryName: p.categoryName,
        verticalValidationStatus: p.verticalValidationStatus,
      },
    };
  }

  async auditLog(user: User, productId: string, organizationId?: string) {
    const org = await this.org(user, organizationId);
    return this.auditRepo.find({
      where: { organizationId: org, catalogProductId: productId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  // -------------------------------------------------------------------------
  // Review actions
  // -------------------------------------------------------------------------

  private async loadForReview(user: User, productId: string, organizationId?: string) {
    const org = await this.org(user, organizationId);
    const pipeline = await this.pipelineRepo.findOneBy({ catalogProductId: productId, organizationId: org });
    const product = await this.productRepo.findOneBy({ id: productId, organizationId: org, vertical: 'fashion' });
    if (!pipeline || !product) throw new NotFoundException('Listing is not in the publish pipeline');
    if (pipeline.activeBatchId) throw new ConflictException('A batch is processing this listing right now');
    return { org, pipeline, product };
  }

  /**
   * Apply the AI suggestion (optionally edited by the reviewer), then re-run
   * the check. Text changes go through the same product row the publisher reads.
   */
  async applySuggestion(
    user: User,
    productId: string,
    edits: { title?: string; description?: string | null; brand?: string | null },
    organizationId?: string,
  ) {
    const { org, pipeline, product } = await this.loadForReview(user, productId, organizationId);
    if (!['NEEDS_REVIEW', 'BLOCKED'].includes(pipeline.state))
      throw new ConflictException('Only listings that need review can be fixed here');
    const s = pipeline.suggestion;
    const title = (edits.title ?? s?.after.title ?? product.title).trim();
    if (!title) throw new BadRequestException('Title cannot be blank');
    if (title.length > 80) throw new BadRequestException('eBay titles are limited to 80 characters');
    const description = edits.description !== undefined ? edits.description : (s?.after.description ?? product.description);
    const brand = (edits.brand !== undefined ? edits.brand : (s?.after.brand ?? product.brand))?.trim() || null;

    const before = { title: product.title, description: product.description, brand: product.brand, brandSpecific: listingSnapshot(product).brandSpecific };
    product.title = title;
    product.description = description?.trim() || null;
    product.brand = brand;
    const nextAttrs: Record<string, unknown> = { ...attr(product) };
    if (brand) nextAttrs.brand = brand;
    else delete nextAttrs.brand;
    product.verticalAttributes = nextAttrs as CatalogProduct['verticalAttributes'];
    await this.productRepo.save(product);
    const edited = !!s && (title !== s.after.title || brand !== s.after.brand || (description ?? null) !== (s.after.description ?? null));
    if (s) pipeline.suggestion = { ...s, status: edited ? 'edited' : 'applied' };
    await this.audit(product, user.id, s ? `fashion.review.suggestion.${edited ? 'edited' : 'applied'}` : 'fashion.review.edited', 'success', before, { title, description: product.description, brand });
    await this.pipelineRepo.save(pipeline);
    void org;
    return this.recheck(user, productId, organizationId);
  }

  /** Re-run images (idempotent) + compliance for one listing outside a batch. */
  async recheck(user: User, productId: string, organizationId?: string) {
    const { org, pipeline, product } = await this.loadForReview(user, productId, organizationId);
    const images = await this.imagePipeline.process(product.id, product.imageUrls ?? [], pipeline.images);
    pipeline.images = images.images;
    const evaluation = await this.evaluate(product, pipeline, await this.config(org));
    this.storeEvaluation(pipeline, evaluation);
    pipeline.state = evaluation.decision === 'BLOCKED' ? 'BLOCKED' : evaluation.decision === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW' : 'READY';
    pipeline.lastError = null;
    if (evaluation.decision !== 'BLOCKED') await this.applyFixesToProduct(product, evaluation, null, user.id);
    pipeline.checkedAt = new Date();
    await this.pipelineRepo.save(pipeline);
    await this.audit(product, user.id, 'fashion.batch.compliance.recheck', evaluation.decision.toLowerCase(), undefined, {
      riskScore: evaluation.risk,
      issues: evaluation.issues,
      fixes: evaluation.fixes,
    });
    // READY here means "passes; next live batch will confirm and publish it".
    return this.reviewView(pipeline, product);
  }

  /** Reviewer accepts a NEEDS_REVIEW listing as accurate and authentic. */
  async approve(user: User, productId: string, dto: { authenticityConfirmed: boolean; notes?: string }, organizationId?: string) {
    const { org, pipeline, product } = await this.loadForReview(user, productId, organizationId);
    if (pipeline.state === 'BLOCKED')
      throw new ConflictException('Blocked listings cannot be approved. Fix the listing and re-run the check first');
    if (pipeline.state !== 'NEEDS_REVIEW' && pipeline.state !== 'READY')
      throw new ConflictException(`Listing is ${pipeline.state}; nothing to approve`);
    if (dto.authenticityConfirmed !== true)
      throw new BadRequestException('Explicit authenticity confirmation is required');
    if (!pipeline.ebayMasterUrls.length)
      throw new ConflictException('The listing has no usable eBay photo');
    await this.fashion.review(user, productId, {
      decision: 'approved',
      authenticityConfirmed: true,
      notes: dto.notes?.trim() || `Approved in the compliance review queue (risk ${pipeline.riskScore}).`,
    }, org);
    pipeline.state = 'READY';
    pipeline.approvedByUserId = user.id;
    await this.pipelineRepo.save(pipeline);
    await this.audit(product, user.id, 'fashion.review.approved', 'success', { state: 'NEEDS_REVIEW' }, { state: 'READY', notes: dto.notes ?? null, openIssues: pipeline.issues.filter((i) => !i.autoFixed && i.severity === 'review').map((i) => i.code) });
    return this.reviewView(pipeline, product);
  }

  async reject(user: User, productId: string, dto: { notes: string }, organizationId?: string) {
    const { org, pipeline, product } = await this.loadForReview(user, productId, organizationId);
    if (!dto.notes?.trim()) throw new BadRequestException('Add a reason before rejecting');
    await this.fashion.review(user, productId, { decision: 'rejected', authenticityConfirmed: false, notes: dto.notes.trim() }, org);
    pipeline.state = 'BLOCKED';
    pipeline.lastError = `Rejected by reviewer: ${dto.notes.trim()}`;
    if (pipeline.suggestion?.status === 'pending') pipeline.suggestion = { ...pipeline.suggestion, status: 'rejected' };
    await this.pipelineRepo.save(pipeline);
    await this.audit(product, user.id, 'fashion.review.rejected', 'blocked', undefined, { notes: dto.notes.trim() });
    return this.reviewView(pipeline, product);
  }

  async rejectSuggestion(user: User, productId: string, organizationId?: string) {
    const { pipeline, product } = await this.loadForReview(user, productId, organizationId);
    if (pipeline.suggestion) pipeline.suggestion = { ...pipeline.suggestion, status: 'rejected' };
    await this.pipelineRepo.save(pipeline);
    await this.audit(product, user.id, 'fashion.review.suggestion.rejected', 'success');
    return this.reviewView(pipeline, product);
  }

  /** Re-queue one FAILED item from a batch. Publishing gets a fresh attempt key. */
  async retryItem(user: User, itemId: string, organizationId?: string) {
    const org = await this.org(user, organizationId);
    const item = await this.itemRepo.findOneBy({ id: itemId, organizationId: org });
    if (!item) throw new NotFoundException('Batch item not found');
    if (item.state !== 'FAILED') throw new ConflictException('Only failed items can be retried');
    const pipeline = await this.pipelineRepo.findOneByOrFail({ catalogProductId: item.catalogProductId });
    if (pipeline.activeBatchId && pipeline.activeBatchId !== item.batchId)
      throw new ConflictException('Another batch is processing this listing');
    if (pipeline.state === 'PUBLISHED') throw new ConflictException('Listing is already published');
    // Only bump the attempt when the previous publish job definitely failed.
    if (pipeline.listingJobId) pipeline.publishAttempt += 1;
    pipeline.listingJobId = null;
    pipeline.activeBatchId = item.batchId;
    pipeline.state = 'UNPUBLISHED';
    pipeline.lastError = null;
    item.state = 'UNPUBLISHED';
    item.error = null;
    item.finishedAt = null;
    await this.pipelineRepo.save(pipeline);
    await this.itemRepo.save(item);
    await this.batchRepo.update(item.batchId, { status: 'running', completedAt: null });
    await this.queue.add('process', { kind: 'process', itemId }, { jobId: `fbp-process-${itemId}-retry-${Date.now()}` });
    return { itemId, state: item.state };
  }

  async getConfig(user: User, organizationId?: string) {
    const org = await this.org(user, organizationId);
    const row = await this.configRepo.findOneBy({ organizationId: org });
    return { effective: await this.config(org), override: row?.config ?? {}, updatedAt: row?.updatedAt ?? null };
  }

  async putConfig(user: User, override: Partial<FashionComplianceConfig>, organizationId?: string) {
    const org = await this.org(user, organizationId);
    const allowed: Array<keyof FashionComplianceConfig> = ['blockTerms', 'blockTermExceptions', 'reviewPhrases', 'fillerTerms', 'protectedBrands', 'knownBrands', 'ambiguousBrands', 'authenticityGuarantee'];
    const clean: Record<string, unknown> = {};
    for (const key of allowed) if (Array.isArray(override?.[key])) clean[key] = override[key];
    await this.configRepo.save({ organizationId: org, config: clean, updatedByUserId: user.id });
    return this.getConfig(user, organizationId);
  }
}
