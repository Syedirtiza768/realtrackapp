import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job, Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { PipelineJob, PipelineJobStatus } from '../entities/pipeline-job.entity.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';
import { extractMakeModelFromTitle } from '../../listings/utils/extract-make-model-from-title.js';
import { PipelineOutputImageService } from '../services/pipeline-output-image.service.js';
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
@Processor('pipeline', { concurrency: 1 })
export class PipelineProcessor extends WorkerHost {
  private readonly logger = new Logger(PipelineProcessor.name);

  // Debounce progress DB writes — accumulate updates and flush periodically
  private pendingUpdate: Partial<PipelineJob> | null = null;
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
    @InjectQueue('listing-optimization')
    private readonly optimizationQueue: Queue,
    private readonly pipelineOutputImages: PipelineOutputImageService,
  ) {
    super();
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
      // Spawn the pipeline script with environment overrides
      const exitCode = await this.runPipeline(jobId, scriptPath, filePath, outputDir, projectRoot);

      if (exitCode !== 0) {
        await this.fail(jobId, `Pipeline exited with code ${exitCode}`);
        throw new Error(`Pipeline exited with code ${exitCode}`);
      }

      // Scan output directory for generated files
      await this.collectOutputs(jobId, outputDir);

      // Mirror remote listing images to S3 and rewrite output XLSX PicURL columns
      await this.pipelineOutputImages.mirrorImagesInOutputDir(jobId, outputDir);

      // Save enriched listings to catalog_products + listing_records
      await this.saveToCatalog(jobId, outputDir);

      await this.updateStatus(jobId, 'completed');

      await this.jobRepo.update(jobId, {
        optimizationStatus: 'pending',
        optimizationTotal: 0,
        optimizationProcessed: 0,
      } as any);

      await this.optimizationQueue.add(
        'optimize-job',
        { jobId, marketplace: 'US' },
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      );

      this.logger.log(`Pipeline job=${jobId} enrichment completed; queued mandatory listing optimization`);
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
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [scriptPath], {
        cwd,
        env: {
          ...process.env,
          PIPELINE_INPUT_FILE: inputPath,
          PIPELINE_OUTPUT_DIR: outputDir,
          PIPELINE_JOB_ID: jobId,
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
    this.pendingUpdate = null;

    if (update && Object.keys(update).length > 0) {
      await this.jobRepo.update(jobId, update as any);
      if (update.status) {
        this.logger.log(`Job ${jobId} → ${update.status} (parts: ${update.processedParts ?? '?'}/${update.totalParts ?? '?'})`);
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
          if (summary.totalInput) update.totalParts = summary.totalInput;
          if (summary.vinDecodeSuccess) update.vinDecodeSuccess = summary.vinDecodeSuccess;
          if (summary.vinDecodeFail) update.vinDecodeFailed = summary.vinDecodeFail;
          if (summary.categoryMappingApi) update.categoryApiCount = summary.categoryMappingApi;
          if (summary.categoryMappingFallback) update.categoryFallbackCount = summary.categoryMappingFallback;
          if (summary.openaiTokensUsed) update.openaiTokensUsed = summary.openaiTokensUsed;
          if (summary.totalProcessed) update.enrichedCount = summary.totalProcessed;
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
   * Parse the US output XLSX and save each listing row to catalog_products + listing_records.
   */
  private async saveToCatalog(jobId: string, outputDir: string): Promise<void> {
    const files = fs.existsSync(outputDir) ? fs.readdirSync(outputDir) : [];
    const usFile = files.find(f => {
      const lower = f.toLowerCase();
      return lower.includes('us-motors') || lower.includes('us_motors');
    });
    if (!usFile) {
      this.logger.warn(`Job ${jobId}: No US output file found for catalog save`);
      return;
    }

    const usPath = path.join(outputDir, usFile);
    try {
      const wb = XLSX.readFile(usPath);
      const ws = wb.Sheets['Listings'];
      if (!ws) {
        this.logger.warn(`Job ${jobId}: No Listings sheet in US output`);
        return;
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
        this.logger.warn(`Job ${jobId}: Could not find header row in US output`);
        return;
      }

      const headers = rows[headerIdx].map(h => String(h ?? '').trim());
      const colIdx = (name: string): number => {
        const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return headers.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '').includes(norm));
      };
      /** Exact match — avoids colIdx('Relationship') matching "Relationship details". */
      const colExact = (pattern: RegExp): number =>
        headers.findIndex(h => pattern.test(String(h ?? '').trim()));

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
      const iBrand = headers.findIndex(h => /^C:Brand$/i.test(h));
      const iType = headers.findIndex(h => /^C:Type$/i.test(h));
      const iMpn = headers.findIndex(h => /C:Manufacturer\s*Part\s*Number/i.test(h));
      const iOem = headers.findIndex(h => /C:OE.*OEM.*Part.*Number/i.test(h));
      const iPlacement = headers.findIndex(h => /C:Placement/i.test(h));
      const iMaterial = headers.findIndex(h => /^C:Material$/i.test(h));
      const iFeatures = headers.findIndex(h => /^C:Features$/i.test(h));
      const iCountry = headers.findIndex(h => /C:Country/i.test(h));
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
          sourceFile: usFile,
          sourceRow: i,
          pipelineJobId: jobId,
        });

        listingRecords.push({
          sourceFileName: usFile,
          sourceFilePath: usPath,
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
        });
      }

      for (const [idx, fitments] of compatibilities) {
        if (products[idx]) {
          products[idx].fitmentData = fitments as Record<string, unknown>[];
        }
      }

      if (products.length > 0) {
        const withFitment = products.filter(
          (p) => Array.isArray(p.fitmentData) && (p.fitmentData as unknown[]).length > 0,
        ).length;
        const CHUNK = 500;
        const upsertColumns = [
          'title',
          'description',
          'brand',
          'brandNormalized',
          'mpn',
          'mpnNormalized',
          'partType',
          'placement',
          'material',
          'features',
          'countryOfOrigin',
          'oemPartNumber',
          'price',
          'quantity',
          'conditionId',
          'categoryId',
          'categoryName',
          'imageUrls',
          'location',
          'format',
          'duration',
          'shippingProfile',
          'returnProfile',
          'paymentProfile',
          'sourceFile',
          'sourceRow',
          'pipelineJobId',
          'fitmentData',
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
          `Job ${jobId}: Saved ${products.length} products to catalog (${withFitment} with fitment rows)`,
        );
      }

      if (listingRecords.length > 0) {
        const CHUNK = 500;
        for (let i = 0; i < listingRecords.length; i += CHUNK) {
          await this.listingRepo
            .createQueryBuilder()
            .insert()
            .into(ListingRecord)
            .values(listingRecords.slice(i, i + CHUNK))
            .orIgnore()
            .execute();
        }
        this.logger.log(`Job ${jobId}: Saved ${listingRecords.length} listing records`);
      }
    } catch (err) {
      this.logger.error(`Job ${jobId}: Failed to save to catalog: ${err instanceof Error ? err.message : err}`);
    }
  }
}
