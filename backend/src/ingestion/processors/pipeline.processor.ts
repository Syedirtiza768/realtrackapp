import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job, Queue } from 'bullmq';
import { In, Repository } from 'typeorm';
import { PipelineJob, PipelineJobStatus } from '../entities/pipeline-job.entity.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';
import { ImageAsset } from '../../storage/entities/image-asset.entity.js';
import { extractMakeModelFromTitle } from '../../listings/utils/extract-make-model-from-title.js';
import { PipelineOutputImageService } from '../services/pipeline-output-image.service.js';
import { EbayMvlService } from '../../fitment/ebay-mvl.service.js';
import { ListingGenerationPipeline } from '../../common/openai/pipelines/listing-generation.pipeline.js';
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as XLSX from 'xlsx';

export interface PipelineJobData {
  jobId: string;
  filePath: string;
  originalFilename: string;
}

/**
 * BullMQ processor for the enrichment pipeline queue.
 *
 * Spawns `scripts/ebay-enrichment-pipeline.mjs` as a child process,
 * monitors its stdout for progress, and updates the PipelineJob entity
 * through the lifecycle stages.
 */
const ACTIVE_PIPELINE_STATUSES: PipelineJobStatus[] = [
  'pending',
  'uploading',
  'vin_decode',
  'category_mapping',
  'enrichment',
  'validation',
  'output_generation',
];

@Processor('pipeline', { concurrency: 1, lockDuration: 120 * 60 * 1000 })
export class PipelineProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PipelineProcessor.name);

  // Debounce progress DB writes — accumulate updates and flush periodically
  private pendingUpdate: Partial<PipelineJob> | null = null;
  private pendingStageDetails: Record<string, unknown> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private lastFlushJobId: string | null = null;
  private static readonly FLUSH_INTERVAL_MS = 1500; // flush at most every 1.5s

  constructor(
    @InjectRepository(PipelineJob)
    private readonly jobRepo: Repository<PipelineJob>,
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectRepository(ImageAsset)
    private readonly imageAssetRepo: Repository<ImageAsset>,
    @InjectQueue('pipeline')
    private readonly pipelineQueue: Queue,
    @InjectQueue('listing-optimization')
    private readonly optimizationQueue: Queue,
    private readonly pipelineOutputImages: PipelineOutputImageService,
    private readonly mvlService: EbayMvlService,
    private readonly listingGenPipeline: ListingGenerationPipeline,
  ) {
    super();
  }

  /** Mark DB rows left in-flight after a worker restart (no matching BullMQ job). */
  async onModuleInit(): Promise<void> {
    try {
      const activeJobs = await this.jobRepo.find({
        where: { status: In(ACTIVE_PIPELINE_STATUSES) },
      });
      if (activeJobs.length === 0) return;

      const [queued, active, delayed] = await Promise.all([
        this.pipelineQueue.getWaiting(),
        this.pipelineQueue.getActive(),
        this.pipelineQueue.getDelayed(),
      ]);
      const liveJobIds = new Set(
        [...queued, ...active, ...delayed].map(
          (entry) => (entry.data as PipelineJobData).jobId,
        ),
      );

      for (const job of activeJobs) {
        if (liveJobIds.has(job.id)) continue;
        await this.jobRepo.update(job.id, {
          status: 'failed',
          lastError:
            'Job interrupted (worker restart). Open History and use Retry to run again.',
          completedAt: new Date(),
        });
        this.logger.warn(
          `Recovered orphaned pipeline job ${job.id} (${job.originalFilename})`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to recover orphaned pipeline jobs: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { jobId, filePath } = job.data;
    this.logger.log(`Starting pipeline job=${jobId}`);

    await this.updateStatus(jobId, 'uploading');

    // Resolve paths — PIPELINE_PROJECT_ROOT is set in Docker; falls back to cwd/.. for bare-metal
    const projectRoot = process.env.PIPELINE_PROJECT_ROOT || path.resolve(process.cwd(), '..');
    const scriptPath = path.resolve(projectRoot, 'scripts', 'ebay-enrichment-pipeline.mjs');
    const outputDir = path.resolve(projectRoot, 'output', `pipeline-${jobId.slice(0, 8)}`);

    if (!fs.existsSync(scriptPath)) {
      await this.fail(jobId, `Pipeline script not found: ${scriptPath}`);
      throw new Error(`Pipeline script not found: ${scriptPath}`);
    }

    // Create output directory for this job
    fs.mkdirSync(outputDir, { recursive: true });

    try {
      const dbJob = await this.jobRepo.findOneBy({ id: jobId });
      const forceVision = Boolean(dbJob?.stageDetails?.forceVision);

      // Spawn the pipeline script with environment overrides
      const exitCode = await this.runPipeline(
        jobId,
        scriptPath,
        filePath,
        outputDir,
        projectRoot,
        { forceVision },
      );

      if (exitCode !== 0) {
        await this.fail(jobId, `Pipeline exited with code ${exitCode}`);
        throw new Error(`Pipeline exited with code ${exitCode}`);
      }

      // Scan output directory for generated files
      await this.collectOutputs(jobId, outputDir);

      // Mirror remote listing images to S3 and rewrite output XLSX PicURL columns
      await this.pipelineOutputImages.mirrorImagesInOutputDir(jobId, outputDir);

      // Save enriched listings to catalog_products + listing_records
      await this.saveToCatalog(jobId, outputDir, job.data.originalFilename);

      // Ensure every catalog product has US, AU, and DE listing records.
      // For any missing marketplace, generate marketplace-appropriate AI content
      // (English for US/AU, German for DE) and create the listing record.
      await this.ensureMissingMarketplaceListings(jobId);

      await this.linkUploadedImages(jobId);
      await this.propagateSourceImages(jobId);

      await this.updateStatus(jobId, 'completed');

      await this.jobRepo.update(jobId, {
        optimizationStatus: 'pending',
        optimizationTotal: 0,
        optimizationProcessed: 0,
      } as any);

      // Enqueue mandatory listing optimization for all three marketplaces
      for (const marketplace of ['US', 'AU', 'DE'] as const) {
        await this.optimizationQueue.add(
          'optimize-job',
          { jobId, marketplace },
          {
            attempts: 5,
            backoff: { type: 'exponential', delay: 30_000 },
            removeOnComplete: 50,
            removeOnFail: 100,
          },
        );
      }

      this.logger.log(`Pipeline job=${jobId} enrichment completed; queued mandatory listing optimization for US/AU/DE`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Pipeline job=${jobId} failed: ${message}`);
      await this.fail(jobId, message);
      throw err;
    }
  }

  private runPipeline(
    jobId: string,
    scriptPath: string,
    inputPath: string,
    outputDir: string,
    cwd: string,
    options: { forceVision?: boolean } = {},
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [scriptPath], {
        cwd,
        env: {
          ...process.env,
          PIPELINE_INPUT_FILE: inputPath,
          PIPELINE_OUTPUT_DIR: outputDir,
          PIPELINE_JOB_ID: jobId,
          ...(options.forceVision ? { PIPELINE_FORCE_VISION: '1' } : {}),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        // Parse progress from stdout markers
        this.parseProgress(jobId, text).catch(() => {});
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
        // Keep last 4KB of stderr
        if (stderr.length > 4096) {
          stderr = stderr.slice(-4096);
        }
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (code) => {
        if (code !== 0 && stderr) {
          this.logger.error(`Pipeline stderr: ${stderr.slice(-500)}`);
        }
        // Flush any pending progress before resolving
        this.flushProgress(jobId).then(() => resolve(code ?? 1)).catch(() => resolve(code ?? 1));
      });
    });
  }

  /**
   * Parse stdout for [PROGRESS] markers and debounce DB updates.
   * Stage transitions flush immediately; numeric stats are batched every 1.5s.
   */
  private async parseProgress(jobId: string, text: string): Promise<void> {
    const lines = text.split('\n');
    let hasStageChange = false;

    for (const line of lines) {
      const idx = line.indexOf('[PROGRESS]');
      if (idx === -1) continue;

      const payload = line.slice(idx + '[PROGRESS]'.length).trim();
      const fields: Record<string, string> = {};
      for (const pair of payload.split(/\s+/)) {
        const eq = pair.indexOf('=');
        if (eq > 0) {
          fields[pair.slice(0, eq)] = pair.slice(eq + 1);
        }
      }

      if (!this.pendingUpdate) this.pendingUpdate = {};
      this.lastFlushJobId = jobId;

      // Stage transition
      const validStages: PipelineJobStatus[] = [
        'uploading', 'vin_decode', 'category_mapping',
        'enrichment', 'validation', 'output_generation',
      ];
      if (fields.stage && validStages.includes(fields.stage as PipelineJobStatus)) {
        this.pendingUpdate.status = fields.stage as PipelineJobStatus;
        hasStageChange = true;
      } else if (fields.stage === 'enrichment_done') {
        this.pendingUpdate.status = 'enrichment';
        hasStageChange = true;
      }

      // Numeric stats — accumulate without writing
      if (fields.total_parts) this.pendingUpdate.totalParts = parseInt(fields.total_parts, 10);
      if (fields.processed) this.pendingUpdate.processedParts = parseInt(fields.processed, 10);
      if (fields.enriched) this.pendingUpdate.enrichedCount = parseInt(fields.enriched, 10);
      if (fields.failed) this.pendingUpdate.fallbackCount = parseInt(fields.failed, 10);
      if (fields.tokens) this.pendingUpdate.openaiTokensUsed = parseInt(fields.tokens, 10);
      if (fields.vin_success) this.pendingUpdate.vinDecodeSuccess = parseInt(fields.vin_success, 10);
      if (fields.vin_failed) this.pendingUpdate.vinDecodeFailed = parseInt(fields.vin_failed, 10);
      if (fields.cat_api) this.pendingUpdate.categoryApiCount = parseInt(fields.cat_api, 10);
      if (fields.cat_fallback) this.pendingUpdate.categoryFallbackCount = parseInt(fields.cat_fallback, 10);
      if (fields.cat_taxonomy_backoff === '1') {
        if (!this.pendingStageDetails) this.pendingStageDetails = {};
        this.pendingStageDetails.categoryTaxonomyBackoff = true;
        hasStageChange = true;
      }
      if (fields.enrichment_mode) {
        if (!this.pendingStageDetails) this.pendingStageDetails = {};
        this.pendingStageDetails.enrichmentMode = fields.enrichment_mode;
        hasStageChange = true;
      }
    }

    // Stage changes flush immediately for responsive UI
    if (hasStageChange) {
      await this.flushProgress(jobId);
    } else {
      // Schedule a debounced flush for numeric-only updates
      this.scheduleFlush(jobId);
    }
  }

  /** Flush accumulated progress to DB */
  private async flushProgress(jobId: string): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const update = this.pendingUpdate;
    const stagePatch = this.pendingStageDetails;
    this.pendingUpdate = null;
    this.pendingStageDetails = null;

    if (!update && !stagePatch) return;

    const merged: Partial<PipelineJob> = { ...(update ?? {}) };

    if (stagePatch && Object.keys(stagePatch).length > 0) {
      const job = await this.jobRepo.findOneBy({ id: jobId });
      merged.stageDetails = {
        ...(job?.stageDetails ?? {}),
        ...stagePatch,
      };
    }

    if (Object.keys(merged).length > 0) {
      await this.jobRepo.update(jobId, merged as any);
      if (merged.status) {
        this.logger.log(`Job ${jobId} → ${merged.status} (parts: ${merged.processedParts ?? '?'}/${merged.totalParts ?? '?'})`);
      }
    }
  }

  /** Schedule a flush if one isn't already pending */
  private scheduleFlush(jobId: string): void {
    if (this.flushTimer) return; // already scheduled
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushProgress(jobId).catch(() => {});
    }, PipelineProcessor.FLUSH_INTERVAL_MS);
  }

  /**
   * Scan the output directory and record file paths in the job record.
   */
  private async collectOutputs(jobId: string, outputDir: string): Promise<void> {
    const files = fs.existsSync(outputDir) ? fs.readdirSync(outputDir) : [];
    const update: Partial<PipelineJob> = {};

    for (const file of files) {
      const fullPath = path.join(outputDir, file);
      const lower = file.toLowerCase();

      if (lower.includes('us-motors') || lower.includes('us_motors')) {
        update.outputUsPath = fullPath;
      } else if (lower.startsWith('au-') || lower.startsWith('au_')) {
        update.outputAuPath = fullPath;
      } else if (lower.startsWith('de-') || lower.startsWith('de_')) {
        update.outputDePath = fullPath;
      } else if (lower.includes('report') && lower.endsWith('.json')) {
        update.reportPath = fullPath;

        // Parse report for final stats (only fill in values not already set by progress markers)
        try {
          const report = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          const summary = report.summary ?? report;
          const summaryAny = summary as Record<string, unknown>;
          if (summaryAny.totalInputParts) update.totalParts = summaryAny.totalInputParts as number;
          else if (summaryAny.totalInput) update.totalParts = summaryAny.totalInput as number;
          if (summaryAny.vinDecodeSuccess) update.vinDecodeSuccess = summaryAny.vinDecodeSuccess as number;
          if (summaryAny.vinDecodeFail) update.vinDecodeFailed = summaryAny.vinDecodeFail as number;
          if (report.categoryMapping?.apiMapped != null) {
            update.categoryApiCount = report.categoryMapping.apiMapped;
          }
          if (report.categoryMapping?.fallbackMapped != null) {
            update.categoryFallbackCount = report.categoryMapping.fallbackMapped;
          }
          if (report.openai?.totalTokens) update.openaiTokensUsed = report.openai.totalTokens;
          if (summaryAny.totalAiEnriched != null) {
            update.enrichedCount = summaryAny.totalAiEnriched as number;
          } else if (summaryAny.totalProcessed) {
            update.enrichedCount = summaryAny.totalProcessed as number;
          }
          if (summaryAny.totalFallbackEnrichment != null) {
            update.fallbackCount = summaryAny.totalFallbackEnrichment as number;
          } else if (summaryAny.totalFailedEnrichment != null) {
            update.fallbackCount = summaryAny.totalFailedEnrichment as number;
          }

          const probeErrors = (report.errors ?? []).filter(
            (e: { type?: string }) => e.type === 'openai',
          );
          const taxonomyErrors = (report.categoryMapping?.taxonomyErrors ??
            (report.errors ?? []).filter((e: { type?: string }) => e.type === 'taxonomy')) as Array<{
            type?: string;
            message: string;
            source?: string;
            status?: number | null;
          }>;
          update.stageDetails = {
            enrichmentMode: summaryAny.enrichmentMode ?? null,
            totalAiEnriched: summaryAny.totalAiEnriched ?? summaryAny.totalProcessed ?? 0,
            totalFallbackEnrichment:
              summaryAny.totalFallbackEnrichment ?? summaryAny.totalFailedEnrichment ?? 0,
            totalListingsGenerated: summaryAny.totalListingsGenerated ?? null,
            openRouterModel: report.openai?.defaultModel ?? null,
            openRouterProbeErrors: probeErrors,
            enrichmentErrors: (report.errors ?? []).slice(0, 20),
            localization: report.localization ?? null,
            categoryMapping: {
              apiMapped: report.categoryMapping?.apiMapped ?? 0,
              fallbackMapped: report.categoryMapping?.fallbackMapped ?? 0,
              apiRate: report.categoryMapping?.apiRate ?? '0%',
              apiSkippedReason: report.categoryMapping?.apiSkippedReason ?? null,
              treeCacheHit: report.categoryMapping?.treeCacheHit ?? false,
              treeCacheSource: report.categoryMapping?.treeCacheSource ?? null,
              taxonomyErrors,
            },
          };
          if (
            probeErrors.length > 0 ||
            summaryAny.enrichmentMode === 'fallback' ||
            taxonomyErrors.length > 0
          ) {
            update.errorCount =
              probeErrors.length +
              (summaryAny.enrichmentMode === 'fallback' ? 1 : 0) +
              taxonomyErrors.length;
          }
        } catch {
          // Non-critical
        }
      }
    }

    // Also check parent output dir as fallback (pipeline may write there)
    if (!update.outputUsPath) {
      const parentOutput = path.resolve(outputDir, '..');
      const parentFiles = fs.readdirSync(parentOutput);
      for (const file of parentFiles) {
        const fullPath = path.join(parentOutput, file);
        const lower = file.toLowerCase();
        if (lower.includes('us-motors') && !update.outputUsPath) update.outputUsPath = fullPath;
        if (lower.startsWith('au-') && !update.outputAuPath) update.outputAuPath = fullPath;
        if (lower.startsWith('de-') && !update.outputDePath) update.outputDePath = fullPath;
        if (lower.includes('report') && lower.endsWith('.json') && !update.reportPath) update.reportPath = fullPath;
      }
    }

    if (Object.keys(update).length > 0) {
      const existing = await this.jobRepo.findOneBy({ id: jobId });
      if (update.stageDetails && existing?.stageDetails) {
        update.stageDetails = { ...existing.stageDetails, ...update.stageDetails };
      }
      await this.jobRepo.update(jobId, update as any);
    }
  }

  private async updateStatus(jobId: string, status: PipelineJobStatus): Promise<void> {
    const update: Partial<PipelineJob> = { status };
    if (status === 'uploading') {
      update.startedAt = new Date();
    } else if (status === 'completed') {
      update.completedAt = new Date();
    }
    await this.jobRepo.update(jobId, update as any);
  }

  private async fail(jobId: string, error: string): Promise<void> {
    await this.jobRepo.update(jobId, {
      status: 'failed' as PipelineJobStatus,
      lastError: error.substring(0, 2000),
    });
  }

  /**
   * Link uploaded images (from the Single Listing form) to listing records.
   * Image URLs are propagated to all marketplace rows via {@link propagateSourceImages}.
   */
  private async linkUploadedImages(jobId: string): Promise<void> {
    const job = await this.jobRepo.findOneBy({ id: jobId });
    const assetIds = (job?.stageDetails as Record<string, unknown>)?.uploadedAssetIds as string[] | undefined;
    if (!assetIds || assetIds.length === 0) return;

    const listings = await this.listingRepo.find({
      where: { pipelineJobId: jobId },
      order: { sourceRowNumber: 'ASC' },
    });
    const primaryListing = listings[0];
    if (!primaryListing) {
      this.logger.warn(`Job ${jobId}: Could not find listing record to link uploaded images`);
      return;
    }

    const result = await this.imageAssetRepo
      .createQueryBuilder()
      .update()
      .set({ listingId: primaryListing.id })
      .where('id IN (:...assetIds)', { assetIds })
      .execute();

    this.logger.log(
      `Job ${jobId}: Linked ${result.affected ?? 0} uploaded images to listing ${primaryListing.id}`,
    );
  }

  /**
   * Copy warehouse-intake / upload photos onto catalog_products.image_urls and every
   * marketplace listing_records.itemPhotoUrl for this job when pipeline output omitted them.
   */
  private async propagateSourceImages(jobId: string): Promise<void> {
    const job = await this.jobRepo.findOneBy({ id: jobId });
    const stageDetails = (job?.stageDetails ?? {}) as Record<string, unknown>;
    const sourceListingIds = stageDetails.sourceListingIds as string[] | undefined;
    const uploadedAssetIds = stageDetails.uploadedAssetIds as string[] | undefined;

    const imageUrlSet = new Set<string>();

    const addUrls = (pipe: string | null | undefined): void => {
      for (const url of (pipe ?? '').split('|').map((u) => u.trim()).filter(Boolean)) {
        if (url.startsWith('http')) imageUrlSet.add(url);
      }
    };

    if (sourceListingIds?.length) {
      const sources = await this.listingRepo.find({ where: { id: In(sourceListingIds) } });
      for (const source of sources) {
        addUrls(source.itemPhotoUrl);
      }
    }

    if (uploadedAssetIds?.length) {
      const assets = await this.imageAssetRepo.find({ where: { id: In(uploadedAssetIds) } });
      for (const asset of assets) {
        if (asset.cdnUrl?.startsWith('http')) imageUrlSet.add(asset.cdnUrl);
      }
    }

    const pipelineListings = await this.listingRepo.find({ where: { pipelineJobId: jobId } });
    for (const listing of pipelineListings) {
      addUrls(listing.itemPhotoUrl);
    }

    const skus = [
      ...new Set(
        pipelineListings.map((l) => l.customLabelSku?.trim()).filter((s): s is string => Boolean(s)),
      ),
    ];
    if (skus.length) {
      const intakeListings = await this.listingRepo.find({
        where: {
          customLabelSku: In(skus),
          sourceFileName: 'warehouse-intake',
        },
      });
      for (const intake of intakeListings) {
        addUrls(intake.itemPhotoUrl);
      }

      const intakeIds = intakeListings.map((l) => l.id);
      if (intakeIds.length) {
        const linkedAssets = await this.imageAssetRepo.find({
          where: { listingId: In(intakeIds) },
        });
        for (const asset of linkedAssets) {
          if (asset.cdnUrl?.startsWith('http')) imageUrlSet.add(asset.cdnUrl);
        }
      }
    }

    const imageUrls = [...imageUrlSet].slice(0, 12);
    if (imageUrls.length === 0) {
      this.logger.log(`Job ${jobId}: No source/upload images to propagate`);
      return;
    }

    const photoPipe = imageUrls.join('|');
    let catalogUpdated = 0;
    let listingsUpdated = 0;

    const products = await this.productRepo.find({ where: { pipelineJobId: jobId } });
    for (const product of products) {
      if (!product.imageUrls?.length) {
        product.imageUrls = imageUrls;
        await this.productRepo.save(product);
        catalogUpdated++;
      }
    }

    for (const listing of pipelineListings) {
      if (!listing.itemPhotoUrl?.trim()) {
        listing.itemPhotoUrl = photoPipe;
        await this.listingRepo.save(listing);
        listingsUpdated++;
      }
    }

    this.logger.log(
      `Job ${jobId}: Propagated ${imageUrls.length} source image(s) to ${catalogUpdated} catalog product(s) and ${listingsUpdated} listing row(s)`,
    );
  }

  /**
   * After saveToCatalog completes, ensure every catalog product has listing records
   * for ALL THREE marketplaces (US, AU, DE). For any missing marketplace, generate
   * marketplace-appropriate content via AI and create the listing record.
   *
   * This is the key fix for the "only DE listing was produced" issue — it guarantees
   * that regardless of which marketplace file was imported, the system auto-creates
   * listings for the other two markets with proper localization:
   *  - US: English, eBay US optimized, SEO
   *  - AU: English, eBay AU optimized, SEO
   *  - DE: German (de-DE), native German copywriting, SEO
   */
  private async ensureMissingMarketplaceListings(jobId: string): Promise<void> {
    const MARKETPLACES = ['US', 'AU', 'DE'] as const;

    // 1. Get all catalog products for this job that have a SKU
    const products = await this.productRepo.find({
      where: { pipelineJobId: jobId },
    });
    const productsWithSku = products.filter(p => p.sku?.trim());
    if (productsWithSku.length === 0) return;

    // 2. Get all listing records for this job, indexed by (sku → set of marketplaces)
    const listingRecords = await this.listingRepo.find({
      where: { pipelineJobId: jobId },
    });

    const existingBySku = new Map<string, Set<string>>();
    const templateBySku = new Map<string, Partial<ListingRecord>>();
    for (const lr of listingRecords) {
      if (!lr.customLabelSku) continue;
      if (!existingBySku.has(lr.customLabelSku)) {
        existingBySku.set(lr.customLabelSku, new Set());
      }
      const mkt = (lr as any).marketplace as string;
      if (mkt) existingBySku.get(lr.customLabelSku)!.add(mkt);
      if (!templateBySku.has(lr.customLabelSku)) {
        templateBySku.set(lr.customLabelSku, lr);
      }
    }

    // 3. Collect missing marketplace entries — (product, marketplace, template)
    const missingEntries: Array<{
      product: typeof productsWithSku[number];
      marketplace: 'US' | 'AU' | 'DE';
      template: Partial<ListingRecord>;
    }> = [];

    for (const product of productsWithSku) {
      const sku = product.sku!;
      const existing = existingBySku.get(sku) ?? new Set();
      const template = templateBySku.get(sku);
      if (!template) continue; // no source listing record at all — skip

      for (const mkt of MARKETPLACES) {
        if (!existing.has(mkt)) {
          missingEntries.push({ product, marketplace: mkt, template });
        }
      }
    }

    if (missingEntries.length === 0) {
      this.logger.log(`Job ${jobId}: All 3 marketplaces already have listing records — no action needed`);
      return;
    }

    this.logger.log(
      `Job ${jobId}: Generating ${missingEntries.length} missing marketplace listing record(s) across ${productsWithSku.length} product(s)`,
    );

    // 4. Group missing entries by marketplace for batch AI generation
    const byMarketplace = new Map<'US' | 'AU' | 'DE', typeof missingEntries>();
    for (const entry of missingEntries) {
      if (!byMarketplace.has(entry.marketplace)) byMarketplace.set(entry.marketplace, []);
      byMarketplace.get(entry.marketplace)!.push(entry);
    }

    const newListingRecords: Array<Partial<ListingRecord> & Record<string, unknown>> = [];

    for (const [mkt, entries] of byMarketplace) {
      try {
        const aiItems = entries.map(e => ({
          productData: {
            sku: e.product.sku,
            brand: e.product.brand,
            mpn: e.product.mpn,
            oem_number: e.product.oemPartNumber,
            title: e.product.title,
            part_type: e.product.partType,
            placement: e.product.placement,
            material: e.product.material,
            features: e.product.features,
            image_count: Array.isArray(e.product.imageUrls) ? e.product.imageUrls.length : 0,
          },
          categoryName: e.product.categoryName ?? 'eBay Motors Parts & Accessories',
          condition: e.product.conditionId ?? 'Used',
          options: {
            marketplace: mkt,
            sellerCountry:
              e.product.location?.includes('DE') || String(e.template.location ?? '').includes('DE')
                ? 'DE'
                : 'US',
          },
        }));

        const aiResults = await this.listingGenPipeline.generateBatch(aiItems);

        for (let i = 0; i < entries.length; i++) {
          const { product, template } = entries[i];
          const ai = aiResults[i];
          const sourceSku = product.sku ?? template.customLabelSku ?? 'UNKNOWN';

          newListingRecords.push({
            sourceFileName: `generated-${mkt.toLowerCase()}-${jobId.slice(0, 8)}`,
            sourceFilePath: `pipeline:${jobId}/${mkt}`,
            sheetName: `Pipeline ${jobId.slice(0, 8)}`,
            sourceRowNumber: template.sourceRowNumber,
            action: 'Add',
            customLabelSku: sourceSku,
            categoryId: product.categoryId ?? template.categoryId,
            categoryName: product.categoryName ?? template.categoryName,
            title: ai?.title ?? product.title ?? template.title,
            description: ai?.description ?? product.description ?? template.description,
            startPrice: template.startPrice,
            startPriceNum: template.startPriceNum,
            quantity: template.quantity,
            quantityNum: template.quantityNum,
            itemPhotoUrl: template.itemPhotoUrl,
            conditionId: product.conditionId ?? template.conditionId,
            format: template.format,
            duration: template.duration,
            location: template.location,
            shippingProfileName: template.shippingProfileName,
            returnProfileName: template.returnProfileName,
            paymentProfileName: template.paymentProfileName,
            cBrand: product.brand ?? template.cBrand,
            cType: product.partType ?? template.cType,
            cFeatures: product.features ?? template.cFeatures,
            cManufacturerPartNumber: product.mpn ?? template.cManufacturerPartNumber,
            cOeOemPartNumber: product.oemPartNumber ?? template.cOeOemPartNumber,
            extractedMake: template.extractedMake,
            extractedModel: template.extractedModel,
            pipelineJobId: jobId,
            marketplace: mkt,
            version: 1,
          });
        }

        this.logger.log(
          `Job ${jobId} [${mkt}]: AI-generated ${entries.length} listing(s) ` +
            `cost=${
              aiResults.reduce((s, r) => s + r.rawResponse.estimatedCostUsd, 0).toFixed(4)
            }`,
        );
      } catch (err) {
        this.logger.error(
          `Job ${jobId}: AI generation failed for marketplace ${mkt}: ${err instanceof Error ? err.message : err}`,
        );
        // Fallback: create listing records without AI content — basic data is better than nothing
        for (const { product, template } of entries) {
          const sourceSku = product.sku ?? template.customLabelSku ?? 'UNKNOWN';
          newListingRecords.push({
            sourceFileName: `generated-${mkt.toLowerCase()}-${jobId.slice(0, 8)}`,
            sourceFilePath: `pipeline:${jobId}/${mkt}`,
            sheetName: `Pipeline ${jobId.slice(0, 8)}`,
            sourceRowNumber: template.sourceRowNumber,
            action: 'Add',
            customLabelSku: sourceSku,
            categoryId: product.categoryId ?? template.categoryId,
            categoryName: product.categoryName ?? template.categoryName,
            title: product.title ?? template.title,
            description: product.description ?? template.description,
            startPrice: template.startPrice,
            startPriceNum: template.startPriceNum,
            quantity: template.quantity,
            quantityNum: template.quantityNum,
            itemPhotoUrl: template.itemPhotoUrl,
            conditionId: product.conditionId ?? template.conditionId,
            format: template.format,
            duration: template.duration,
            location: template.location,
            shippingProfileName: template.shippingProfileName,
            returnProfileName: template.returnProfileName,
            paymentProfileName: template.paymentProfileName,
            cBrand: product.brand ?? template.cBrand,
            cType: product.partType ?? template.cType,
            cFeatures: product.features ?? template.cFeatures,
            cManufacturerPartNumber: product.mpn ?? template.cManufacturerPartNumber,
            cOeOemPartNumber: product.oemPartNumber ?? template.cOeOemPartNumber,
            extractedMake: template.extractedMake,
            extractedModel: template.extractedModel,
            pipelineJobId: jobId,
            marketplace: mkt,
            version: 1,
          });
        }
      }
    }

    if (newListingRecords.length === 0) return;

    // 5. Bulk insert new listing records (uses same pattern as saveMarketplaceToCatalog)
    try {
      const CHUNK = 500;
      let totalInserted = 0;

      const PROP_TO_COL: Record<string, string> = {
        sourceFileName: 'sourceFileName',
        sourceFilePath: 'sourceFilePath',
        sheetName: 'sheetName',
        sourceRowNumber: 'sourceRowNumber',
        action: 'action',
        customLabelSku: 'customLabelSku',
        categoryId: 'categoryId',
        categoryName: 'categoryName',
        title: 'title',
        startPrice: 'startPrice',
        startPriceNum: 'startPriceNum',
        quantity: 'quantity',
        quantityNum: 'quantityNum',
        itemPhotoUrl: 'itemPhotoUrl',
        conditionId: 'conditionId',
        description: 'description',
        format: 'format',
        duration: 'duration',
        location: 'location',
        shippingProfileName: 'shippingProfileName',
        returnProfileName: 'returnProfileName',
        paymentProfileName: 'paymentProfileName',
        cBrand: 'cBrand',
        cType: 'cType',
        cFeatures: 'cFeatures',
        cManufacturerPartNumber: 'cManufacturerPartNumber',
        cOeOemPartNumber: 'cOeOemPartNumber',
        extractedMake: 'extractedMake',
        extractedModel: 'extractedModel',
        pipelineJobId: 'pipeline_job_id',
        marketplace: 'marketplace',
        version: 'version',
      };
      const ALL_COLS = Object.values(PROP_TO_COL);
      const updateSet = ALL_COLS.map((c) => {
        if (c === 'itemPhotoUrl') {
          return `"${c}" = COALESCE(NULLIF(EXCLUDED."${c}", ''), listing_records."${c}")`;
        }
        return `"${c}" = EXCLUDED."${c}"`;
      }).join(', ');
      const colList = ALL_COLS.map(c => `"${c}"`).join(', ');

      for (let i = 0; i < newListingRecords.length; i += CHUNK) {
        const batch = newListingRecords.slice(i, i + CHUNK);
        const values: unknown[] = [];
        const rowsSql: string[] = [];
        let paramIdx = 0;
        for (const lr of batch) {
          const rowParams: string[] = [];
          for (const col of ALL_COLS) {
            paramIdx++;
            rowParams.push(`$${paramIdx}`);
            values.push((lr as Record<string, unknown>)[col] ?? null);
          }
          rowsSql.push(`(${rowParams.join(', ')})`);
        }
        const sql = `
          INSERT INTO "listing_records" (${colList})
          VALUES ${rowsSql.join(',\n')}
          ON CONFLICT ("customLabelSku", "marketplace")
          WHERE ("customLabelSku" IS NOT NULL) AND ("deletedAt" IS NULL) AND ("marketplace" IS NOT NULL)
          DO UPDATE SET ${updateSet}
          RETURNING id
        `;
        const result = await this.listingRepo.query(sql, values);
        totalInserted += (result?.length ?? 0);
      }

      this.logger.log(
        `Job ${jobId}: Created ${totalInserted} missing marketplace listing records for ${missingEntries.length} marketplace(s)`,
      );
    } catch (err) {
      this.logger.error(
        `Job ${jobId}: Failed to insert missing marketplace listing records: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Parse all marketplace output XLSX files and save each listing row to catalog_products + listing_records.
   * Catalog master rows are upserted from US output only (AU/DE update listing_records per marketplace).
   */
  private async saveToCatalog(jobId: string, outputDir: string, originalFilename?: string): Promise<void> {
    let catalogUpserted = false;
    for (const marketplace of ['US', 'AU', 'DE'] as const) {
      const didUpsertCatalog = await this.saveMarketplaceToCatalog(
        jobId,
        outputDir,
        marketplace,
        originalFilename,
        !catalogUpserted,
      );
      if (didUpsertCatalog) catalogUpserted = true;
    }
  }

  /**
   * Parse a single marketplace output XLSX and save to both catalog_products and listing_records.
   * Supports US (English headers), AU (English headers, same as US), and DE (German headers).
   */
  private async saveMarketplaceToCatalog(
    jobId: string,
    outputDir: string,
    marketplace: 'US' | 'AU' | 'DE',
    originalFilename?: string,
    upsertCatalogProducts = false,
  ): Promise<boolean> {
    const files = fs.existsSync(outputDir) ? fs.readdirSync(outputDir) : [];
    const mktFile = files.find(f => {
      const lower = f.toLowerCase();
      if (marketplace === 'US') return lower.includes('us-motors') || lower.includes('us_motors');
      if (marketplace === 'AU') return lower.startsWith('au-') || lower.startsWith('au_');
      return lower.startsWith('de-') || lower.startsWith('de_');
    });
    if (!mktFile) {
      this.logger.warn(`Job ${jobId}: No ${marketplace} output file found for catalog save`);
      return false;
    }

    const mktPath = path.join(outputDir, mktFile);
    try {
      const wb = XLSX.readFile(mktPath);
      const ws = wb.Sheets['Listings'];
      if (!ws) {
        this.logger.warn(`Job ${jobId}: No Listings sheet in ${marketplace} output`);
        return false;
      }

      const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      let headerIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        if (row?.some(h => h && /title/i.test(String(h)) && !/info/i.test(String(h)))) {
          headerIdx = i;
          break;
        }
      }
      if (headerIdx === -1) {
        this.logger.warn(`Job ${jobId}: Could not find header row in ${marketplace} output`);
        return false;
      }

      const headers = rows[headerIdx].map(h => String(h ?? '').trim());
      const colIdx = (name: string): number => {
        const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return headers.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '').includes(norm));
      };
      const colExact = (pattern: RegExp): number =>
        headers.findIndex(h => pattern.test(String(h ?? '').trim()));

      // Column indices — US/AU use English headers, DE uses German
      const isDE = marketplace === 'DE';
      const iAction = colIdx('Action');
      const iSku = colIdx('Customlabel');
      const iCategoryId = colIdx('CategoryID');
      const iCategoryName = colIdx('CategoryName');
      const iTitle = colIdx('Title');
      const iPrice = colIdx('Startprice');
      const iQty = colIdx('Quantity');
      const iConditionId = colIdx('ConditionID');
      const iDesc = colIdx('Description');
      const iFormat = colIdx('Format');
      const iDuration = colIdx('Duration');
      const iLocation = colIdx('Location');
      const iPicUrl = headers.findIndex(h => /picurl|item\s*photo\s*url/i.test(h));
      const iShipping = colIdx('Shippingprofilename');
      const iReturn = colIdx('Returnprofilename');
      const iPayment = colIdx('Paymentprofilename');

      // DE column name mappings for custom fields
      const iBrand = !isDE
        ? headers.findIndex(h => /^C:Brand$/i.test(h))
        : headers.findIndex(h => /^C:Hersteller$/i.test(h));
      const iType = !isDE
        ? headers.findIndex(h => /^C:Type$/i.test(h))
        : headers.findIndex(h => /^C:Produktart$/i.test(h));
      const iMpn = !isDE
        ? headers.findIndex(h => /C:Manufacturer\s*Part\s*Number/i.test(h))
        : headers.findIndex(h => /C:Herstellernummer/i.test(h));
      const iOem = !isDE
        ? headers.findIndex(h => /C:OE.*OEM.*Part.*Number/i.test(h))
        : headers.findIndex(h => /C:OE.*OEM.*Referenznummer/i.test(h));
      const iPlacement = !isDE
        ? headers.findIndex(h => /C:Placement/i.test(h))
        : headers.findIndex(h => /C:Einbauposition/i.test(h));
      const iMaterial = !isDE
        ? headers.findIndex(h => /^C:Material$/i.test(h))
        : headers.findIndex(h => /^C:Material$|^C:Material\b/i.test(h));
      const iFeatures = !isDE
        ? headers.findIndex(h => /^C:Features$/i.test(h))
        : headers.findIndex(h => /^C:Merkmale$|^C:Features$/i.test(h));
      const iCountry = !isDE
        ? headers.findIndex(h => /C:Country/i.test(h))
        : headers.findIndex(h => /C:Herstellungsland/i.test(h));
      const iRelationship = colExact(/^Relationship$/i);
      const iRelationshipDetails = colExact(/^Relationship\s*details$/i);

      const get = (row: string[], idx: number): string =>
        idx >= 0 && row[idx] != null ? String(row[idx]).trim() : '';

      const products: Partial<CatalogProduct>[] = [];
      const listingRecords: Partial<ListingRecord>[] = [];
      const compatibilities = new Map<number, Record<string, unknown>[]>();

      let currentProductIdx = -1;
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const relationship = get(row, iRelationship);
        if (relationship === 'Compatibility') {
          if (currentProductIdx >= 0) {
            const details = get(row, iRelationshipDetails);
            if (details) {
              const parts: Record<string, string> = {};
              details.split('|').forEach(pair => {
                const [k, ...v] = pair.split('=');
                if (k && v.length) parts[k.trim()] = v.join('=').trim();
              });
              const make = parts['Make'] || '';
              const model = parts['Model'] || '';
              const year = parts['Year'] || '';
              if (make && model && year) {
                if (!compatibilities.has(currentProductIdx)) compatibilities.set(currentProductIdx, []);
                compatibilities.get(currentProductIdx)!.push({
                  Make: make,
                  Model: model,
                  Year: year,
                  ...(parts['Trim'] ? { Trim: parts['Trim'] } : {}),
                  ...(parts['Engine'] ? { Engine: parts['Engine'] } : {}),
                  ...(parts['Submodel'] ? { Submodel: parts['Submodel'] } : {}),
                });
              }
            }
          }
          continue;
        }

        const action = get(row, iAction).toLowerCase();
        if (!action || action === 'info') continue;

        const title = get(row, iTitle);
        if (!title) continue;

        const sku = get(row, iSku);
        const priceStr = get(row, iPrice);
        const price = priceStr ? parseFloat(priceStr) : null;
        const qtyStr = get(row, iQty);
        const quantity = qtyStr ? parseInt(qtyStr, 10) : null;
        const picUrl = get(row, iPicUrl);
        const imageUrls = picUrl ? picUrl.split('|').filter(Boolean) : [];
        for (let ai = 0; ai <= 7; ai++) {
          const colName = ai === 0 ? 'AdditionalPicURL' : `AdditionalPicURL${ai}`;
          const addIdx = headers.indexOf(colName);
          if (addIdx >= 0) {
            const url = get(row, addIdx);
            if (url) imageUrls.push(url);
          }
        }

        const brand = get(row, iBrand);
        const mpn = get(row, iMpn);

        const { make: extractedMake, model: extractedModel } =
          extractMakeModelFromTitle(title || null);

        currentProductIdx = products.length;

        products.push({
          sku: sku || null,
          title,
          description: get(row, iDesc) || null,
          brand: brand || null,
          brandNormalized: brand ? brand.toLowerCase().trim() : null,
          mpn: mpn || null,
          mpnNormalized: mpn ? mpn.toLowerCase().replace(/[\s\-]/g, '') : null,
          partType: get(row, iType) || null,
          placement: get(row, iPlacement) || null,
          material: get(row, iMaterial) || null,
          features: get(row, iFeatures) || null,
          countryOfOrigin: get(row, iCountry) || null,
          oemPartNumber: get(row, iOem) || null,
          price,
          quantity,
          conditionId: get(row, iConditionId) || null,
          categoryId: get(row, iCategoryId) || null,
          categoryName: get(row, iCategoryName) || null,
          imageUrls,
          location: get(row, iLocation) || null,
          format: get(row, iFormat) || null,
          duration: get(row, iDuration) || null,
          shippingProfile: get(row, iShipping) || null,
          returnProfile: get(row, iReturn) || null,
          paymentProfile: get(row, iPayment) || null,
          sourceFile: originalFilename ?? mktFile,
          sourceRow: i,
          pipelineJobId: jobId,
        });

        listingRecords.push({
          sourceFileName: mktFile,
          sourceFilePath: mktPath,
          sheetName: `Pipeline ${jobId.slice(0, 8)}`,
          sourceRowNumber: i,
          action: 'Add',
          customLabelSku: sku || null,
          categoryId: get(row, iCategoryId) || null,
          categoryName: get(row, iCategoryName) || null,
          title,
          startPrice: priceStr || null,
          startPriceNum: price,
          quantity: qtyStr || null,
          quantityNum: quantity,
          itemPhotoUrl: imageUrls.join('|') || null,
          conditionId: get(row, iConditionId) || null,
          description: get(row, iDesc) || null,
          format: get(row, iFormat) || null,
          duration: get(row, iDuration) || null,
          location: get(row, iLocation) || null,
          shippingProfileName: get(row, iShipping) || null,
          returnProfileName: get(row, iReturn) || null,
          paymentProfileName: get(row, iPayment) || null,
          cBrand: brand || null,
          cType: get(row, iType) || null,
          cFeatures: get(row, iFeatures) || null,
          cManufacturerPartNumber: mpn || null,
          cOeOemPartNumber: get(row, iOem) || null,
          extractedMake,
          extractedModel,
        } satisfies Partial<ListingRecord> & { marketplace?: string });
      }

      // Set marketplace + pipelineJobId on each listing record
      for (const lr of listingRecords) {
        (lr as any).pipelineJobId = jobId;
        (lr as any).marketplace = marketplace;
        (lr as any).version = 1;
      }

      for (const [idx, fitments] of compatibilities) {
        if (products[idx]) {
          products[idx].fitmentData = fitments as Record<string, unknown>[];
        }
      }

      let mvlRejectedTotal = 0;
      let mvlValidatedTotal = 0;
      for (const product of products) {
        const rawFitment = product.fitmentData as Record<string, unknown>[] | undefined;
        if (!Array.isArray(rawFitment) || rawFitment.length === 0) continue;

        const categoryId =
          product.categoryId?.trim() || EbayMvlService.MOTORS_PARTS_CATEGORY;
        try {
          const mvlResult = await this.mvlService.validateFitmentData(rawFitment, categoryId);
          product.fitmentData = mvlResult.accepted;
          mvlRejectedTotal += mvlResult.rejectedCount;
          mvlValidatedTotal += mvlResult.validCount;
          if (mvlResult.apiUnavailable) {
            this.logger.warn(
              `Job ${jobId} [${marketplace}]: eBay MVL API unavailable — fitment kept as needs_review where possible`,
            );
          }
        } catch (err) {
          this.logger.warn(
            `Job ${jobId} [${marketplace}]: MVL validation failed for SKU ${product.sku ?? '?'}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }

      if (mvlRejectedTotal > 0 || mvlValidatedTotal > 0) {
        this.logger.log(
          `Job ${jobId} [${marketplace}]: MVL validation — ${mvlValidatedTotal} valid, ${mvlRejectedTotal} rejected`,
        );
      }

      this.logger.log(
        `Job ${jobId} [${marketplace}]: Parsed ${products.length} products, ${listingRecords.length} listing records from ${mktFile}`,
      );

      if (products.length > 0 && upsertCatalogProducts) {
        const withFitment = products.filter(
          (p) => Array.isArray(p.fitmentData) && (p.fitmentData as unknown[]).length > 0,
        ).length;
        const CHUNK = 500;

        const skusToMerge = products.map((p) => p.sku?.trim()).filter((s): s is string => Boolean(s));
        if (skusToMerge.length > 0) {
          const existingProducts = await this.productRepo.find({ where: { sku: In(skusToMerge) } });
          const existingBySku = new Map(existingProducts.map((p) => [p.sku!, p]));
          for (const product of products) {
            if ((!product.imageUrls || product.imageUrls.length === 0) && product.sku) {
              const existing = existingBySku.get(product.sku);
              if (existing?.imageUrls?.length) {
                product.imageUrls = existing.imageUrls;
              }
            }
          }
        }

        // PostgreSQL column names (snake_case) — orUpdate uses DB names, not entity property names
        const upsertColumns = [
          'title', 'description', 'brand', 'brand_normalized', 'mpn', 'mpn_normalized',
          'part_type', 'placement', 'material', 'features', 'country_of_origin', 'oem_part_number',
          'price', 'quantity', 'condition_id', 'category_id', 'category_name', 'image_urls',
          'location', 'format', 'duration', 'shipping_profile', 'return_profile', 'payment_profile',
          'source_file', 'source_row', 'pipeline_job_id', 'fitment_data',
        ] as const;

        for (let i = 0; i < products.length; i += CHUNK) {
          const batch = products.slice(i, i + CHUNK);
          const withSku = batch.filter((p) => p.sku?.trim());
          const withoutSku = batch.filter((p) => !p.sku?.trim());

          if (withSku.length > 0) {
            await this.productRepo
              .createQueryBuilder()
              .insert()
              .into(CatalogProduct)
              .values(withSku as any)
              .orUpdate([...upsertColumns], ['sku'])
              .execute();
          }
          if (withoutSku.length > 0) {
            await this.productRepo
              .createQueryBuilder()
              .insert()
              .into(CatalogProduct)
              .values(withoutSku as any)
              .orIgnore()
              .execute();
          }
        }
        this.logger.log(
          `Job ${jobId} [${marketplace}]: Saved ${products.length} products to catalog (${withFitment} with fitment rows)`,
        );
      } else if (products.length > 0) {
        this.logger.log(
          `Job ${jobId} [${marketplace}]: Skipped catalog_products upsert (master catalog uses US output only)`,
        );
      }

      if (listingRecords.length > 0) {
        const CHUNK = 500;
        let totalInserted = 0;
        // Map entity property names → DB column names (pipeline_job_id uses explicit name)
        const PROP_TO_COL: Record<string, string> = {
          sourceFileName: 'sourceFileName',
          sourceFilePath: 'sourceFilePath',
          sheetName: 'sheetName',
          sourceRowNumber: 'sourceRowNumber',
          action: 'action',
          customLabelSku: 'customLabelSku',
          categoryId: 'categoryId',
          categoryName: 'categoryName',
          title: 'title',
          startPrice: 'startPrice',
          startPriceNum: 'startPriceNum',
          quantity: 'quantity',
          quantityNum: 'quantityNum',
          itemPhotoUrl: 'itemPhotoUrl',
          conditionId: 'conditionId',
          description: 'description',
          format: 'format',
          duration: 'duration',
          location: 'location',
          shippingProfileName: 'shippingProfileName',
          returnProfileName: 'returnProfileName',
          paymentProfileName: 'paymentProfileName',
          cBrand: 'cBrand',
          cType: 'cType',
          cFeatures: 'cFeatures',
          cManufacturerPartNumber: 'cManufacturerPartNumber',
          cOeOemPartNumber: 'cOeOemPartNumber',
          extractedMake: 'extractedMake',
          extractedModel: 'extractedModel',
          pipelineJobId: 'pipeline_job_id',
          marketplace: 'marketplace',
          version: 'version',
        };
        const ALL_COLS = Object.values(PROP_TO_COL); // all columns for INSERT / UPDATE on conflict

        for (let i = 0; i < listingRecords.length; i += CHUNK) {
          try {
            const batch = listingRecords.slice(i, i + CHUNK);
            // Build parameterised INSERT … ON CONFLICT DO UPDATE
            const values: unknown[] = [];
            const rowsSql: string[] = [];
            let paramIdx = 0;
            for (const lr of batch) {
              const rowParams: string[] = [];
              for (const [prop, col] of Object.entries(PROP_TO_COL)) {
                paramIdx++;
                rowParams.push(`$${paramIdx}`);
                values.push((lr as Record<string, unknown>)[prop] ?? null);
              }
              rowsSql.push(`(${rowParams.join(', ')})`);
            }
            const colList = ALL_COLS.map(c => `"${c}"`).join(', ');
            const updateSet = ALL_COLS.map((c) => {
              if (c === 'itemPhotoUrl') {
                return `"${c}" = COALESCE(NULLIF(EXCLUDED."${c}", ''), listing_records."${c}")`;
              }
              return `"${c}" = EXCLUDED."${c}"`;
            }).join(', ');
            const sql = `
              INSERT INTO "listing_records" (${colList})
              VALUES ${rowsSql.join(',\n')}
              ON CONFLICT ("customLabelSku", "marketplace")
              WHERE ("customLabelSku" IS NOT NULL) AND ("deletedAt" IS NULL) AND ("marketplace" IS NOT NULL)
              DO UPDATE SET ${updateSet}
              RETURNING id
            `;
            const result = await this.listingRepo.query(sql, values);
            totalInserted += (result?.length ?? 0);
          } catch (insertErr) {
            this.logger.error(
              `Job ${jobId} [${marketplace}]: Listing batch upsert failed (offset ${i}): ${insertErr instanceof Error ? insertErr.message : insertErr}`,
            );
          }
        }
        this.logger.log(
          `Job ${jobId} [${marketplace}]: Attempted ${listingRecords.length} listing records, upserted ${totalInserted}`,
        );
      } else {
        this.logger.warn(`Job ${jobId} [${marketplace}]: No listing records to insert (0 valid rows parsed)`);
      }

      return upsertCatalogProducts && products.length > 0;
    } catch (err) {
      this.logger.error(`Job ${jobId} [${marketplace}]: Failed to save to catalog: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }
}
