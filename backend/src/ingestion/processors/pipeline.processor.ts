import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job, Queue } from 'bullmq';
import { In, Repository } from 'typeorm';
import {
  PipelineJob,
  PipelineJobStatus,
} from '../entities/pipeline-job.entity.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';
import { ImageAsset } from '../../storage/entities/image-asset.entity.js';
import { extractMakeModelFromTitle } from '../../listings/utils/extract-make-model-from-title.js';
import { PipelineOutputImageService } from '../services/pipeline-output-image.service.js';
import { EnterpriseListingIntelligenceService } from '../enterprise-listing-intelligence.service.js';
import { EbayMvlService } from '../../fitment/ebay-mvl.service.js';
import { EbayMvlStoreService } from '../../fitment/ebay-mvl-store.service.js';
import { resolveCategoryTreeId } from '../../channels/ebay/ebay-marketplace-tree.util.js';
import {
  isPipelineMarketplaceCode,
  resolveJobOutputMarketplaces,
  shouldApplyJobProfilesToCatalogMaster,
  shouldApplyJobProfilesToOutput,
  type PipelineMarketplaceCode,
} from '../../common/marketplaces/pipeline-marketplaces.js';
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

/** Align BullMQ worker concurrency with admission cap (see HeavyJobLimiterService). */
const PIPELINE_WORKER_CONCURRENCY = Math.max(
  1,
  Number(process.env.MAX_CONCURRENT_PIPELINE_JOBS ?? '2') || 2,
);

interface JobProgressState {
  pendingUpdate: Partial<PipelineJob> | null;
  pendingStageDetails: Record<string, unknown> | null;
  flushTimer: ReturnType<typeof setTimeout> | null;
}

type CatalogImportPhase = 'parsing' | 'mvl' | 'saving';

interface CatalogImportProgress {
  phase: CatalogImportPhase;
  marketplace: string;
  processed: number;
  total: number;
}

@Processor('pipeline', {
  concurrency: PIPELINE_WORKER_CONCURRENCY,
  lockDuration: 120 * 60 * 1000,
})
export class PipelineProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PipelineProcessor.name);

  // Per-job debounced progress writes (safe when concurrency > 1)
  private readonly progressByJob = new Map<string, JobProgressState>();
  private readonly catalogImportByJob = new Map<
    string,
    CatalogImportProgress
  >();
  private readonly catalogImportFlushTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private static readonly FLUSH_INTERVAL_MS = 1500; // flush at most every 1.5s
  private static readonly CATALOG_IMPORT_FLUSH_MS = 2000;

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
    private readonly pipelineOutputImages: PipelineOutputImageService,
    private readonly mvlService: EbayMvlService,
    private readonly mvlStore: EbayMvlStoreService,
    private readonly enterpriseListingIntelligence: EnterpriseListingIntelligenceService,
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
    const { jobId } = job.data;

    if (job.name === 'resume-import') {
      await this.runResumeImport(jobId);
      return;
    }

    const { filePath } = job.data;
    this.logger.log(
      `Starting pipeline job=${jobId} (worker concurrency=${PIPELINE_WORKER_CONCURRENCY})`,
    );

    await this.updateStatus(jobId, 'uploading');

    // Resolve paths — PIPELINE_PROJECT_ROOT is set in Docker; falls back to cwd/.. for bare-metal
    const projectRoot =
      process.env.PIPELINE_PROJECT_ROOT || path.resolve(process.cwd(), '..');
    const scriptPath = path.resolve(
      projectRoot,
      'scripts',
      'ebay-enrichment-pipeline.mjs',
    );
    const outputDir = path.resolve(
      projectRoot,
      'output',
      `pipeline-${jobId.slice(0, 8)}`,
    );

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
        {
          forceVision,
          shippingProfile: dbJob?.shippingProfileName ?? undefined,
          returnProfile: dbJob?.returnProfileName ?? undefined,
          paymentProfile: dbJob?.paymentProfileName ?? undefined,
          marketplace: dbJob?.marketplace ?? undefined,
          storeId: dbJob?.storeId ?? undefined,
        },
      );

      if (exitCode !== 0) {
        await this.fail(jobId, `Pipeline exited with code ${exitCode}`);
        throw new Error(`Pipeline exited with code ${exitCode}`);
      }

      await this.runPostEnrichmentImport(
        jobId,
        outputDir,
        job.data.originalFilename,
      );

      this.logger.log(`Pipeline job=${jobId} enrichment completed`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Pipeline job=${jobId} failed: ${message}`);
      await this.fail(jobId, message);
      throw err;
    } finally {
      this.clearJobProgress(jobId);
    }
  }

  /**
   * Resume a job that completed enrichment + output generation but got stuck
   * during catalog import (e.g. slow MVL validation on a worker without the
   * batched lookup optimization). Reuses the on-disk output XLSX files and
   * runs only the post-enrichment import phase with the current (optimized)
   * validation code. Safe to call when output files already exist.
   */
  private async runResumeImport(jobId: string): Promise<void> {
    this.logger.log(`Resuming catalog import for job=${jobId}`);

    const projectRoot =
      process.env.PIPELINE_PROJECT_ROOT || path.resolve(process.cwd(), '..');
    const outputDir = path.resolve(
      projectRoot,
      'output',
      `pipeline-${jobId.slice(0, 8)}`,
    );

    if (!fs.existsSync(outputDir)) {
      await this.fail(
        jobId,
        `Cannot resume — output directory not found: ${outputDir}`,
      );
      throw new Error(
        `Cannot resume — output directory not found: ${outputDir}`,
      );
    }

    const dbJob = await this.jobRepo.findOneBy({ id: jobId });
    if (!dbJob) {
      throw new Error(`Cannot resume — job not found: ${jobId}`);
    }

    // Clear any stale error from a prior interruption
    await this.jobRepo.update(jobId, {
      status: 'output_generation' as PipelineJobStatus,
      lastError: null,
      completedAt: null,
    } as any);

    try {
      await this.runPostEnrichmentImport(
        jobId,
        outputDir,
        dbJob.originalFilename,
      );
      this.logger.log(`Resume import completed for job=${jobId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Resume import failed for job=${jobId}: ${message}`);
      await this.fail(jobId, message);
      throw err;
    } finally {
      this.clearJobProgress(jobId);
    }
  }

  /**
   * Post-enrichment import phase: collect outputs → mirror images →
   * catalog import (MVL validation + upsert) → link/propagate images → completed.
   * Shared by the full pipeline run and the resume-import path.
   */
  private async runPostEnrichmentImport(
    jobId: string,
    outputDir: string,
    originalFilename?: string,
  ): Promise<void> {
    // Scan output directory for generated files
    await this.collectOutputs(jobId, outputDir);
    await this.touchSubStage(jobId, 'writing_done');

    // Mirror remote listing images to S3 and rewrite output XLSX PicURL columns
    await this.touchSubStage(jobId, 'mirror_images');
    await this.pipelineOutputImages.mirrorImagesInOutputDir(jobId, outputDir);

    // Import output XLSX rows into catalog (target marketplace only when job specified one)
    await this.touchSubStage(jobId, 'catalog_import');
    await this.saveToCatalog(jobId, outputDir, originalFilename);

    await this.touchSubStage(jobId, 'finalizing');
    await this.linkUploadedImages(jobId);
    await this.propagateSourceImages(jobId);

    await this.updateStatus(jobId, 'completed');
  }

  private getJobProgress(jobId: string): JobProgressState {
    let state = this.progressByJob.get(jobId);
    if (!state) {
      state = {
        pendingUpdate: null,
        pendingStageDetails: null,
        flushTimer: null,
      };
      this.progressByJob.set(jobId, state);
    }
    return state;
  }

  /** Re-validate fitment on import using local MVL when imported; API fallback otherwise. */
  private async shouldSkipMvlOnImport(): Promise<boolean> {
    const raw = process.env.PIPELINE_SKIP_MVL_ON_IMPORT;
    if (raw != null && String(raw).trim() !== '') {
      return /^(1|true|yes|on)$/i.test(String(raw).trim());
    }
    return !(await this.mvlStore.hasAnyActiveRelease());
  }

  private async touchSubStage(jobId: string, subStage: string): Promise<void> {
    const job = await this.jobRepo.findOneBy({ id: jobId });
    await this.jobRepo.update(jobId, {
      stageDetails: {
        ...(job?.stageDetails ?? {}),
        subStage,
      },
    } as any);
  }

  private catalogImportSubStage(phase: CatalogImportPhase): string {
    switch (phase) {
      case 'parsing':
        return 'catalog_parsing';
      case 'mvl':
        return 'mvl_validation';
      case 'saving':
        return 'catalog_saving';
    }
  }

  /** Debounced DB + log updates during catalog import / MVL validation. */
  private scheduleCatalogImportProgress(
    jobId: string,
    progress: CatalogImportProgress,
    immediate = false,
  ): void {
    this.catalogImportByJob.set(jobId, progress);
    if (immediate) {
      this.flushCatalogImportProgress(jobId).catch(() => {});
      return;
    }
    if (this.catalogImportFlushTimers.has(jobId)) return;
    this.catalogImportFlushTimers.set(
      jobId,
      setTimeout(() => {
        this.catalogImportFlushTimers.delete(jobId);
        this.flushCatalogImportProgress(jobId).catch(() => {});
      }, PipelineProcessor.CATALOG_IMPORT_FLUSH_MS),
    );
  }

  private async flushCatalogImportProgress(jobId: string): Promise<void> {
    const progress = this.catalogImportByJob.get(jobId);
    if (!progress) return;

    const timer = this.catalogImportFlushTimers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.catalogImportFlushTimers.delete(jobId);
    }

    const job = await this.jobRepo.findOneBy({ id: jobId });
    await this.jobRepo.update(jobId, {
      stageDetails: {
        ...(job?.stageDetails ?? {}),
        subStage: this.catalogImportSubStage(progress.phase),
        catalogImport: progress,
      },
    } as any);

    this.logger.log(
      `Job ${jobId}: catalog import [${progress.marketplace}] ${progress.phase} ${progress.processed}/${progress.total}`,
    );
  }

  private clearCatalogImportProgress(jobId: string): void {
    const timer = this.catalogImportFlushTimers.get(jobId);
    if (timer) clearTimeout(timer);
    this.catalogImportFlushTimers.delete(jobId);
    this.catalogImportByJob.delete(jobId);
  }

  private clearJobProgress(jobId: string): void {
    const state = this.progressByJob.get(jobId);
    if (state?.flushTimer) {
      clearTimeout(state.flushTimer);
    }
    this.progressByJob.delete(jobId);
    this.clearCatalogImportProgress(jobId);
  }

  private runPipeline(
    jobId: string,
    scriptPath: string,
    inputPath: string,
    outputDir: string,
    cwd: string,
    options: {
      forceVision?: boolean;
      shippingProfile?: string;
      returnProfile?: string;
      paymentProfile?: string;
      marketplace?: string;
      storeId?: string;
    } = {},
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
          ...(options.shippingProfile
            ? { PIPELINE_SHIPPING_PROFILE: options.shippingProfile }
            : {}),
          ...(options.returnProfile
            ? { PIPELINE_RETURN_PROFILE: options.returnProfile }
            : {}),
          ...(options.paymentProfile
            ? { PIPELINE_PAYMENT_PROFILE: options.paymentProfile }
            : {}),
          ...(options.marketplace
            ? { PIPELINE_TARGET_MARKETPLACE: options.marketplace }
            : {}),
          ...(options.storeId ? { PIPELINE_STORE_ID: options.storeId } : {}),
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
        this.flushProgress(jobId)
          .then(() => resolve(code ?? 1))
          .catch(() => resolve(code ?? 1));
      });
    });
  }

  /**
   * Parse stdout for [PROGRESS] markers and debounce DB updates.
   * Stage transitions flush immediately; numeric stats are batched every 1.5s.
   */
  private async parseProgress(jobId: string, text: string): Promise<void> {
    const state = this.getJobProgress(jobId);
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

      if (!state.pendingUpdate) state.pendingUpdate = {};

      // Stage transition
      const validStages: PipelineJobStatus[] = [
        'uploading',
        'vin_decode',
        'category_mapping',
        'enrichment',
        'validation',
        'output_generation',
      ];
      if (
        fields.stage &&
        validStages.includes(fields.stage as PipelineJobStatus)
      ) {
        state.pendingUpdate.status = fields.stage as PipelineJobStatus;
        hasStageChange = true;
      } else if (fields.stage === 'enrichment_done') {
        state.pendingUpdate.status = 'enrichment';
        hasStageChange = true;
      }

      // Numeric stats — accumulate without writing
      if (fields.total_parts)
        state.pendingUpdate.totalParts = parseInt(fields.total_parts, 10);
      if (fields.processed)
        state.pendingUpdate.processedParts = parseInt(fields.processed, 10);
      if (fields.enriched)
        state.pendingUpdate.enrichedCount = parseInt(fields.enriched, 10);
      if (fields.failed)
        state.pendingUpdate.fallbackCount = parseInt(fields.failed, 10);
      if (fields.tokens)
        state.pendingUpdate.openaiTokensUsed = parseInt(fields.tokens, 10);
      if (fields.vin_success)
        state.pendingUpdate.vinDecodeSuccess = parseInt(fields.vin_success, 10);
      if (fields.vin_failed)
        state.pendingUpdate.vinDecodeFailed = parseInt(fields.vin_failed, 10);
      if (fields.cat_api)
        state.pendingUpdate.categoryApiCount = parseInt(fields.cat_api, 10);
      if (fields.cat_fallback)
        state.pendingUpdate.categoryFallbackCount = parseInt(
          fields.cat_fallback,
          10,
        );
      if (fields.cat_ai) {
        if (!state.pendingStageDetails) state.pendingStageDetails = {};
        state.pendingStageDetails.categoryAiCount = parseInt(fields.cat_ai, 10);
        hasStageChange = true;
      }
      if (fields.cat_taxonomy_backoff === '1') {
        if (!state.pendingStageDetails) state.pendingStageDetails = {};
        state.pendingStageDetails.categoryTaxonomyBackoff = true;
        hasStageChange = true;
      }
      if (fields.enrichment_mode) {
        if (!state.pendingStageDetails) state.pendingStageDetails = {};
        state.pendingStageDetails.enrichmentMode = fields.enrichment_mode;
        hasStageChange = true;
      }
      if (fields.sub_stage) {
        if (!state.pendingStageDetails) state.pendingStageDetails = {};
        state.pendingStageDetails.subStage = fields.sub_stage;
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
    const state = this.getJobProgress(jobId);
    if (state.flushTimer) {
      clearTimeout(state.flushTimer);
      state.flushTimer = null;
    }

    const update = state.pendingUpdate;
    const stagePatch = state.pendingStageDetails;
    state.pendingUpdate = null;
    state.pendingStageDetails = null;

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
        this.logger.log(
          `Job ${jobId} → ${merged.status} (parts: ${merged.processedParts ?? '?'}/${merged.totalParts ?? '?'})`,
        );
      }
    }
  }

  /** Schedule a flush if one isn't already pending */
  private scheduleFlush(jobId: string): void {
    const state = this.getJobProgress(jobId);
    if (state.flushTimer) return; // already scheduled
    state.flushTimer = setTimeout(() => {
      state.flushTimer = null;
      this.flushProgress(jobId).catch(() => {});
    }, PipelineProcessor.FLUSH_INTERVAL_MS);
  }

  /**
   * Scan the output directory and record file paths in the job record.
   */
  private async collectOutputs(
    jobId: string,
    outputDir: string,
  ): Promise<void> {
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
      } else if (lower.startsWith('uk-') || lower.startsWith('uk_')) {
        update.outputUkPath = fullPath;
      } else if (lower.includes('report') && lower.endsWith('.json')) {
        update.reportPath = fullPath;

        // Parse report for final stats (only fill in values not already set by progress markers)
        try {
          const report = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          const summary = report.summary ?? report;
          const summaryAny = summary as Record<string, unknown>;
          if (summaryAny.totalInputParts)
            update.totalParts = summaryAny.totalInputParts as number;
          else if (summaryAny.totalInput)
            update.totalParts = summaryAny.totalInput as number;
          if (summaryAny.vinDecodeSuccess)
            update.vinDecodeSuccess = summaryAny.vinDecodeSuccess as number;
          if (summaryAny.vinDecodeFail)
            update.vinDecodeFailed = summaryAny.vinDecodeFail as number;
          if (report.categoryMapping?.apiMapped != null) {
            update.categoryApiCount = report.categoryMapping.apiMapped;
          }
          if (report.categoryMapping?.fallbackMapped != null) {
            update.categoryFallbackCount =
              report.categoryMapping.fallbackMapped;
          }
          if (report.openai?.totalTokens)
            update.openaiTokensUsed = report.openai.totalTokens;
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
            (report.errors ?? []).filter(
              (e: { type?: string }) => e.type === 'taxonomy',
            )) as Array<{
            type?: string;
            message: string;
            source?: string;
            status?: number | null;
          }>;
          update.stageDetails = {
            enrichmentMode: summaryAny.enrichmentMode ?? null,
            totalAiEnriched:
              summaryAny.totalAiEnriched ?? summaryAny.totalProcessed ?? 0,
            totalFallbackEnrichment:
              summaryAny.totalFallbackEnrichment ??
              summaryAny.totalFailedEnrichment ??
              0,
            totalListingsGenerated: summaryAny.totalListingsGenerated ?? null,
            openRouterModel: report.openai?.defaultModel ?? null,
            openRouterProbeErrors: probeErrors,
            enrichmentErrors: (report.errors ?? []).slice(0, 20),
            localization: report.localization ?? null,
            categoryMapping: {
              apiMapped: report.categoryMapping?.apiMapped ?? 0,
              aiMapped: report.categoryMapping?.aiMapped ?? 0,
              fallbackMapped: report.categoryMapping?.fallbackMapped ?? 0,
              apiRate: report.categoryMapping?.apiRate ?? '0%',
              categoryMode: report.categoryMapping?.categoryMode ?? null,
              aiModel: report.categoryMapping?.aiModel ?? null,
              apiSkippedReason:
                report.categoryMapping?.apiSkippedReason ?? null,
              treeCacheHit: report.categoryMapping?.treeCacheHit ?? false,
              treeCacheSource: report.categoryMapping?.treeCacheSource ?? null,
              aiCacheHits: report.categoryMapping?.aiCacheHits ?? 0,
              aiApiCalls: report.categoryMapping?.aiApiCalls ?? 0,
              aiTokensUsed: report.categoryMapping?.aiTokensUsed ?? 0,
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
        if (lower.includes('us-motors') && !update.outputUsPath)
          update.outputUsPath = fullPath;
        if (lower.startsWith('au-') && !update.outputAuPath)
          update.outputAuPath = fullPath;
        if (lower.startsWith('de-') && !update.outputDePath)
          update.outputDePath = fullPath;
        if (lower.startsWith('uk-') && !update.outputUkPath)
          update.outputUkPath = fullPath;
        if (
          lower.includes('report') &&
          lower.endsWith('.json') &&
          !update.reportPath
        )
          update.reportPath = fullPath;
      }
    }

    if (Object.keys(update).length > 0) {
      const existing = await this.jobRepo.findOneBy({ id: jobId });
      if (update.stageDetails && existing?.stageDetails) {
        update.stageDetails = {
          ...existing.stageDetails,
          ...update.stageDetails,
        };
      }
      await this.jobRepo.update(jobId, update as any);
    }
  }

  private async updateStatus(
    jobId: string,
    status: PipelineJobStatus,
  ): Promise<void> {
    const update: Partial<PipelineJob> = { status };
    if (status === 'uploading') {
      update.startedAt = new Date();
    } else if (status === 'completed') {
      update.completedAt = new Date();
      const job = await this.jobRepo.findOneBy({ id: jobId });
      update.stageDetails = {
        ...(job?.stageDetails ?? {}),
        subStage: 'done',
      };
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
    const assetIds = (job?.stageDetails as Record<string, unknown>)
      ?.uploadedAssetIds as string[] | undefined;
    if (!assetIds || assetIds.length === 0) return;

    const listings = await this.listingRepo.find({
      where: { pipelineJobId: jobId },
      order: { sourceRowNumber: 'ASC' },
    });
    const primaryListing = listings[0];
    if (!primaryListing) {
      this.logger.warn(
        `Job ${jobId}: Could not find listing record to link uploaded images`,
      );
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
    const stageDetails = job?.stageDetails ?? {};
    const sourceListingIds = stageDetails.sourceListingIds as
      | string[]
      | undefined;
    const uploadedAssetIds = stageDetails.uploadedAssetIds as
      | string[]
      | undefined;

    const imageUrlSet = new Set<string>();

    const addUrls = (pipe: string | null | undefined): void => {
      for (const url of (pipe ?? '')
        .split('|')
        .map((u) => u.trim())
        .filter(Boolean)) {
        if (url.startsWith('http')) imageUrlSet.add(url);
      }
    };

    if (sourceListingIds?.length) {
      const sources = await this.listingRepo.find({
        where: { id: In(sourceListingIds) },
      });
      for (const source of sources) {
        addUrls(source.itemPhotoUrl);
      }
    }

    if (uploadedAssetIds?.length) {
      const assets = await this.imageAssetRepo.find({
        where: { id: In(uploadedAssetIds) },
      });
      for (const asset of assets) {
        if (asset.cdnUrl?.startsWith('http')) imageUrlSet.add(asset.cdnUrl);
      }
    }

    const pipelineListings = await this.listingRepo.find({
      where: { pipelineJobId: jobId },
    });
    for (const listing of pipelineListings) {
      addUrls(listing.itemPhotoUrl);
    }

    const skus = [
      ...new Set(
        pipelineListings
          .map((l) => l.customLabelSku?.trim())
          .filter((s): s is string => Boolean(s)),
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

    const imageUrls = [...imageUrlSet].slice(0, 24);
    if (imageUrls.length === 0) {
      this.logger.log(`Job ${jobId}: No source/upload images to propagate`);
      return;
    }

    const photoPipe = imageUrls.join('|');
    let catalogUpdated = 0;
    let listingsUpdated = 0;

    const products = await this.productRepo.find({
      where: { pipelineJobId: jobId },
    });
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
   * Parse marketplace output XLSX files and save each listing row to catalog_products + listing_records.
   * When the job has a target marketplace, only that file is imported.
   */
  private async saveToCatalog(
    jobId: string,
    outputDir: string,
    originalFilename?: string,
  ): Promise<void> {
    const dbJob = await this.jobRepo.findOneBy({ id: jobId });
    const jobMarketplace = isPipelineMarketplaceCode(dbJob?.marketplace ?? '')
      ? (dbJob!.marketplace as PipelineMarketplaceCode)
      : null;
    const marketplaces = resolveJobOutputMarketplaces(jobMarketplace);

    let catalogUpserted = false;
    for (const marketplace of marketplaces) {
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
    marketplace: 'US' | 'UK' | 'AU' | 'DE',
    originalFilename?: string,
    upsertCatalogProducts = false,
  ): Promise<boolean> {
    const dbJob = await this.jobRepo.findOneBy({ id: jobId });
    const jobTeamId = dbJob?.teamId ?? null;
    const uploadConditionLabel = dbJob?.conditionLabel ?? null;
    const jobMarketplace = isPipelineMarketplaceCode(dbJob?.marketplace ?? '')
      ? (dbJob!.marketplace as PipelineMarketplaceCode)
      : null;
    const jobProfiles = {
      shipping: dbJob?.shippingProfileName?.trim() || null,
      return: dbJob?.returnProfileName?.trim() || null,
      payment: dbJob?.paymentProfileName?.trim() || null,
    };
    const applyToOutput = shouldApplyJobProfilesToOutput(
      marketplace,
      jobMarketplace,
    );
    const applyToCatalogMaster =
      upsertCatalogProducts &&
      shouldApplyJobProfilesToCatalogMaster(jobMarketplace, marketplace);

    const resolveProfile = (
      rowValue: string | null,
      jobDefault: string | null,
      applyDefault: boolean,
    ): string | null => {
      const trimmed = rowValue?.trim();
      if (trimmed) return trimmed;
      if (applyDefault && jobDefault) return jobDefault;
      return null;
    };

    const uploadConditionId = uploadConditionLabel
      ? ((
          { Used: '3000', New: '1000', Refurbished: '2500' } as Record<
            string,
            string
          >
        )[uploadConditionLabel] ?? null)
      : null;

    const files = fs.existsSync(outputDir) ? fs.readdirSync(outputDir) : [];
    const mktFile = files.find((f) => {
      const lower = f.toLowerCase();
      if (marketplace === 'US')
        return lower.includes('us-motors') || lower.includes('us_motors');
      if (marketplace === 'UK')
        return lower.startsWith('uk-') || lower.startsWith('uk_');
      if (marketplace === 'AU')
        return lower.startsWith('au-') || lower.startsWith('au_');
      return lower.startsWith('de-') || lower.startsWith('de_');
    });
    if (!mktFile) {
      this.logger.warn(
        `Job ${jobId}: No ${marketplace} output file found for catalog save`,
      );
      return false;
    }

    const mktPath = path.join(outputDir, mktFile);
    try {
      this.scheduleCatalogImportProgress(
        jobId,
        { phase: 'parsing', marketplace, processed: 0, total: 1 },
        true,
      );

      const wb = XLSX.readFile(mktPath);
      const ws = wb.Sheets['Listings'];
      if (!ws) {
        this.logger.warn(
          `Job ${jobId}: No Listings sheet in ${marketplace} output`,
        );
        return false;
      }

      const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      let headerIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        if (
          row?.some(
            (h) => h && /title/i.test(String(h)) && !/info/i.test(String(h)),
          )
        ) {
          headerIdx = i;
          break;
        }
      }
      if (headerIdx === -1) {
        this.logger.warn(
          `Job ${jobId}: Could not find header row in ${marketplace} output`,
        );
        return false;
      }

      const headers = rows[headerIdx].map((h) => String(h ?? '').trim());
      const colIdx = (name: string): number => {
        const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return headers.findIndex((h) =>
          h
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .includes(norm),
        );
      };
      const colExact = (pattern: RegExp): number =>
        headers.findIndex((h) => pattern.test(String(h ?? '').trim()));

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
      const iPicUrl = headers.findIndex((h) =>
        /picurl|item\s*photo\s*url/i.test(h),
      );
      const iShipping = colIdx('Shippingprofilename');
      const iReturn = colIdx('Returnprofilename');
      const iPayment = colIdx('Paymentprofilename');

      // DE column name mappings for custom fields
      const iBrand = !isDE
        ? headers.findIndex((h) => /^C:Brand$/i.test(h))
        : headers.findIndex((h) => /^C:Hersteller$/i.test(h));
      const iType = !isDE
        ? headers.findIndex((h) => /^C:Type$/i.test(h))
        : headers.findIndex((h) => /^C:Produktart$/i.test(h));
      const iMpn = !isDE
        ? headers.findIndex((h) => /C:Manufacturer\s*Part\s*Number/i.test(h))
        : headers.findIndex((h) => /C:Herstellernummer/i.test(h));
      const iOem = !isDE
        ? headers.findIndex((h) => /C:OE.*OEM.*Part.*Number/i.test(h))
        : headers.findIndex((h) => /C:OE.*OEM.*Referenznummer/i.test(h));
      const iPlacement = !isDE
        ? headers.findIndex((h) => /C:Placement/i.test(h))
        : headers.findIndex((h) => /C:Einbauposition/i.test(h));
      const iMaterial = !isDE
        ? headers.findIndex((h) => /^C:Material$/i.test(h))
        : headers.findIndex((h) => /^C:Material$|^C:Material\b/i.test(h));
      const iFeatures = !isDE
        ? headers.findIndex((h) => /^C:Features$/i.test(h))
        : headers.findIndex((h) => /^C:Merkmale$|^C:Features$/i.test(h));
      const iCountry = !isDE
        ? headers.findIndex((h) => /C:Country/i.test(h))
        : headers.findIndex((h) => /C:Herstellungsland/i.test(h));
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
              details.split('|').forEach((pair) => {
                const [k, ...v] = pair.split('=');
                if (k && v.length) parts[k.trim()] = v.join('=').trim();
              });
              const make = parts['Make'] || '';
              const model = parts['Model'] || '';
              const year = parts['Year'] || '';
              if (make && model && year) {
                if (!compatibilities.has(currentProductIdx))
                  compatibilities.set(currentProductIdx, []);
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
        for (let ai = 0; ai <= 22; ai++) {
          const colName =
            ai === 0 ? 'AdditionalPicURL' : `AdditionalPicURL${ai}`;
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
          conditionId: get(row, iConditionId) || uploadConditionId || null,
          conditionLabel: uploadConditionLabel || null,
          categoryId: get(row, iCategoryId) || null,
          categoryName: get(row, iCategoryName) || null,
          imageUrls,
          location: get(row, iLocation) || null,
          format: get(row, iFormat) || null,
          duration: get(row, iDuration) || null,
          shippingProfile: resolveProfile(
            get(row, iShipping),
            jobProfiles.shipping,
            applyToOutput || applyToCatalogMaster,
          ),
          returnProfile: resolveProfile(
            get(row, iReturn),
            jobProfiles.return,
            applyToOutput || applyToCatalogMaster,
          ),
          paymentProfile: resolveProfile(
            get(row, iPayment),
            jobProfiles.payment,
            applyToOutput || applyToCatalogMaster,
          ),
          sourceFile: originalFilename ?? mktFile,
          sourceRow: i,
          pipelineJobId: jobId,
          teamId: jobTeamId,
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
          conditionId: get(row, iConditionId) || uploadConditionId || null,
          description: get(row, iDesc) || null,
          format: get(row, iFormat) || null,
          duration: get(row, iDuration) || null,
          location: get(row, iLocation) || null,
          shippingProfileName: resolveProfile(
            get(row, iShipping),
            jobProfiles.shipping,
            applyToOutput || applyToCatalogMaster,
          ),
          returnProfileName: resolveProfile(
            get(row, iReturn),
            jobProfiles.return,
            applyToOutput || applyToCatalogMaster,
          ),
          paymentProfileName: resolveProfile(
            get(row, iPayment),
            jobProfiles.payment,
            applyToOutput || applyToCatalogMaster,
          ),
          cBrand: brand || null,
          cType: get(row, iType) || null,
          cFeatures: get(row, iFeatures) || null,
          cManufacturerPartNumber: mpn || null,
          cOeOemPartNumber: get(row, iOem) || null,
          extractedMake,
          extractedModel,
        } satisfies Partial<ListingRecord> & { marketplace?: string });
      }

      // Set marketplace + pipelineJobId + team on each listing record
      for (const lr of listingRecords) {
        (lr as any).pipelineJobId = jobId;
        (lr as any).marketplace = marketplace;
        (lr as any).teamId = jobTeamId;
        (lr as any).version = 1;
      }

      for (const [idx, fitments] of compatibilities) {
        if (products[idx]) {
          products[idx].fitmentData = fitments;
        }
      }

      const importTotal = Math.max(products.length, listingRecords.length);
      this.scheduleCatalogImportProgress(
        jobId,
        {
          phase: 'parsing',
          marketplace,
          processed: importTotal,
          total: importTotal,
        },
        true,
      );

      // Category output from the enrichment script is untrusted. Normalize it
      // before either table is persisted so parent, missing, and unrelated
      // taxonomy IDs cannot bypass the optional optimization stage.
      const categoryConcurrency = Math.max(
        1,
        Number(process.env.PIPELINE_CATEGORY_GUARD_CONCURRENCY ?? '8') || 8,
      );
      let categoryCorrections = 0;
      await this.mapWithConcurrency(
        products,
        categoryConcurrency,
        async (product, index) => {
          const resolved =
            await this.enterpriseListingIntelligence.resolvePublishableCategory(
              product as CatalogProduct,
            );
          const changed =
            product.categoryId !== resolved.categoryId ||
            product.categoryName !== resolved.categoryName;
          product.categoryId = resolved.categoryId;
          product.categoryName = resolved.categoryName;
          if (listingRecords[index]) {
            listingRecords[index].categoryId = resolved.categoryId;
            listingRecords[index].categoryName = resolved.categoryName;
          }
          if (changed) categoryCorrections++;
        },
      );
      if (categoryCorrections > 0) {
        this.logger.warn(
          `Job ${jobId} [${marketplace}]: category guard corrected ${categoryCorrections}/${products.length} rows before persistence`,
        );
      }

      let mvlRejectedTotal = 0;
      let mvlValidatedTotal = 0;
      const skipMvlOnImport = await this.shouldSkipMvlOnImport();
      if (!skipMvlOnImport) {
        let mvlProcessed = 0;
        const mvlConcurrency = Math.max(
          1,
          Number(process.env.PIPELINE_MVL_IMPORT_CONCURRENCY ?? '8') || 8,
        );
        const treeId = resolveCategoryTreeId(marketplace);

        await this.mapWithConcurrency(
          products,
          mvlConcurrency,
          async (product) => {
            const rawFitment = product.fitmentData as
              | Record<string, unknown>[]
              | undefined;
            if (Array.isArray(rawFitment) && rawFitment.length > 0) {
              const categoryId =
                product.categoryId?.trim() ||
                EbayMvlService.MOTORS_PARTS_CATEGORY;
              try {
                const mvlResult = await this.mvlService.validateFitmentData(
                  rawFitment,
                  categoryId,
                  { treeId },
                );
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
            mvlProcessed++;
            if (mvlProcessed % 10 === 0 || mvlProcessed === products.length) {
              this.scheduleCatalogImportProgress(jobId, {
                phase: 'mvl',
                marketplace,
                processed: mvlProcessed,
                total: products.length,
              });
            }
          },
        );
      } else {
        this.logger.log(
          `Job ${jobId} [${marketplace}]: PIPELINE_SKIP_MVL_ON_IMPORT — using fitment from pipeline output as-is`,
        );
        if (products.length > 0) {
          this.scheduleCatalogImportProgress(
            jobId,
            {
              phase: 'mvl',
              marketplace,
              processed: products.length,
              total: products.length,
            },
            true,
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
        const CHUNK = 500;

        const skusToMerge = products
          .map((p) => p.sku?.trim())
          .filter((s): s is string => Boolean(s));
        if (skusToMerge.length > 0) {
          const existingProducts = await this.productRepo.find({
            where: { sku: In(skusToMerge) },
          });
          const existingBySku = new Map(
            existingProducts.map((p) => [p.sku!, p]),
          );
          for (const product of products) {
            if (
              (!product.imageUrls || product.imageUrls.length === 0) &&
              product.sku
            ) {
              const existing = existingBySku.get(product.sku);
              if (existing?.imageUrls?.length) {
                product.imageUrls = existing.imageUrls;
              }
            }
          }
        }

        // PostgreSQL column names (snake_case) — orUpdate uses DB names, not entity property names
        const upsertColumns = [
          'title',
          'description',
          'brand',
          'brand_normalized',
          'mpn',
          'mpn_normalized',
          'part_type',
          'placement',
          'material',
          'features',
          'country_of_origin',
          'oem_part_number',
          'price',
          'quantity',
          'condition_id',
          'category_id',
          'category_name',
          'image_urls',
          'location',
          'format',
          'duration',
          'shipping_profile',
          'return_profile',
          'payment_profile',
          'source_file',
          'source_row',
          'pipeline_job_id',
          'fitment_data',
        ] as const;

        // Deduplicate products by SKU (keep last occurrence) to prevent
        // "ON CONFLICT DO UPDATE command cannot affect row a second time"
        const dedupedProductMap = new Map<string, (typeof products)[0]>();
        const productsNoSku: typeof products = [];
        for (const p of products) {
          const s = p.sku?.trim();
          if (s) dedupedProductMap.set(s, p);
          else productsNoSku.push(p);
        }
        const dedupedProducts = [
          ...dedupedProductMap.values(),
          ...productsNoSku,
        ];
        if (dedupedProducts.length < products.length) {
          this.logger.warn(
            `Job ${jobId} [${marketplace}]: Deduplicated ${products.length} → ${dedupedProducts.length} catalog products by SKU`,
          );
        }

        const withFitment = dedupedProducts.filter(
          (p) =>
            Array.isArray(p.fitmentData) &&
            (p.fitmentData as unknown[]).length > 0,
        ).length;

        for (let i = 0; i < dedupedProducts.length; i += CHUNK) {
          const batch = dedupedProducts.slice(i, i + CHUNK);
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

          this.scheduleCatalogImportProgress(jobId, {
            phase: 'saving',
            marketplace,
            processed: Math.min(i + batch.length, dedupedProducts.length),
            total: importTotal,
          });
        }
        this.logger.log(
          `Job ${jobId} [${marketplace}]: Saved ${dedupedProducts.length} products to catalog (${withFitment} with fitment rows)`,
        );
      } else if (products.length > 0) {
        this.logger.log(
          `Job ${jobId} [${marketplace}]: Skipped catalog_products upsert (master catalog uses US output only)`,
        );
      }

      if (listingRecords.length > 0) {
        if (!(products.length > 0 && upsertCatalogProducts)) {
          this.scheduleCatalogImportProgress(
            jobId,
            {
              phase: 'saving',
              marketplace,
              processed: 0,
              total: importTotal,
            },
            true,
          );
        }
        // Deduplicate listing records by customLabelSku (keep last occurrence) to prevent
        // "ON CONFLICT DO UPDATE command cannot affect row a second time"
        const dedupedLrMap = new Map<string, (typeof listingRecords)[0]>();
        const lrNoSku: typeof listingRecords = [];
        for (const lr of listingRecords) {
          const s = lr.customLabelSku?.trim();
          if (s) dedupedLrMap.set(s, lr);
          else lrNoSku.push(lr);
        }
        const dedupedListingRecords = [...dedupedLrMap.values(), ...lrNoSku];
        if (dedupedListingRecords.length < listingRecords.length) {
          this.logger.warn(
            `Job ${jobId} [${marketplace}]: Deduplicated ${listingRecords.length} → ${dedupedListingRecords.length} listing records by SKU`,
          );
        }

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
          teamId: 'team_id',
          version: 'version',
        };
        const ALL_COLS = Object.values(PROP_TO_COL); // all columns for INSERT / UPDATE on conflict

        for (let i = 0; i < dedupedListingRecords.length; i += CHUNK) {
          try {
            const batch = dedupedListingRecords.slice(i, i + CHUNK);
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
            const colList = ALL_COLS.map((c) => `"${c}"`).join(', ');
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
            totalInserted += result?.length ?? 0;
          } catch (insertErr) {
            this.logger.error(
              `Job ${jobId} [${marketplace}]: Listing batch upsert failed (offset ${i}): ${insertErr instanceof Error ? insertErr.message : insertErr}`,
            );
          }

          this.scheduleCatalogImportProgress(jobId, {
            phase: 'saving',
            marketplace,
            processed: Math.min(i + CHUNK, dedupedListingRecords.length),
            total: importTotal,
          });
        }
        this.logger.log(
          `Job ${jobId} [${marketplace}]: Attempted ${dedupedListingRecords.length} listing records, upserted ${totalInserted}`,
        );
      } else {
        this.logger.warn(
          `Job ${jobId} [${marketplace}]: No listing records to insert (0 valid rows parsed)`,
        );
      }

      if (importTotal > 0) {
        this.scheduleCatalogImportProgress(
          jobId,
          {
            phase: 'saving',
            marketplace,
            processed: importTotal,
            total: importTotal,
          },
          true,
        );
      }

      return upsertCatalogProducts && products.length > 0;
    } catch (err) {
      this.logger.error(
        `Job ${jobId} [${marketplace}]: Failed to save to catalog: ${err instanceof Error ? err.message : err}`,
      );
      return false;
    }
  }

  /** Run an async mapper over items with bounded concurrency, preserving order. */
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
