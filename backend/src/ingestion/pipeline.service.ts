import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { Repository, In } from 'typeorm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PipelineJob } from './entities/pipeline-job.entity.js';
import type { PipelineJobData } from './processors/pipeline.processor.js';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';
import { EnterpriseListingIntelligenceService } from './enterprise-listing-intelligence.service.js';
import type { ListingQualityProfile } from './enterprise-listing-intelligence.service.js';
import { ListingOptimizationService } from '../listing-optimization/listing-optimization.service.js';
import type { JobOptimizationStatus } from '../listing-optimization/listing-optimization.types.js';
import {
  applyCreatedByVisibility,
  canViewJob,
  withCreatedByBackfill,
} from '../common/utils/job-visibility.js';
import { HeavyJobLimiterService } from '../common/jobs/heavy-job-limiter.service.js';
import { SingleListingFormService } from './services/single-listing-form.service.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { TeamsService } from '../teams/teams.service.js';
import { User } from '../auth/entities/user.entity.js';
import { StoresService } from '../channels/stores.service.js';
import {
  isPipelineMarketplaceCode,
  storeMatchesPipelineMarketplace,
  type PipelineMarketplaceCode,
} from '../common/marketplaces/pipeline-marketplaces.js';
import {
  PIPELINE_CONDITION_OPTIONS,
  mapPipelineDisplayStatus,
  type PipelineDisplayStatus,
} from './pipeline.constants.js';

const SINGLE_LISTING_DEFAULT_PRICE = 100;
const SINGLE_LISTING_DEFAULT_QUANTITY = 1;

export {
  PIPELINE_CONDITION_OPTIONS,
  mapPipelineDisplayStatus,
  type PipelineDisplayStatus,
} from './pipeline.constants.js';

export interface PipelineJobListItem {
  id: string;
  uploadCode: string | null;
  status: string;
  displayStatus: PipelineDisplayStatus;
  originalFilename: string;
  totalParts: number;
  conditionLabel: string | null;
  marketplace: string | null;
  store: { id: string; storeName: string } | null;
  shippingProfileName: string | null;
  returnProfileName: string | null;
  paymentProfileName: string | null;
  team: { id: string; name: string; color: string } | null;
  uploadedBy: { id: string; name: string } | null;
  createdAt: Date;
  fileSizeBytes: number | null;
}

export interface PipelineUploadProfileOptions {
  marketplace: PipelineMarketplaceCode;
  storeId: string;
  shippingProfileName: string;
  returnProfileName: string;
  paymentProfileName: string;
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
}

export interface CreatePipelineJobDto {
  originalFilename: string;
  storedFilePath: string;
  fileSizeBytes?: number;
}

export interface CreateSingleListingDto {
  sku?: string;
  brand?: string;
  model?: string;
  vin?: string;
  category?: string;
  partNumber?: string;
  partName?: string;
  note?: string;
  price?: number;
  quantity?: number;
  imageUrls?: string;
  uploadedAssetIds?: string[];
}

export interface PipelineJobSummary {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  byStatus: Record<string, number>;
  totalPartsProcessed: number;
  totalEnriched: number;
  totalTokens: number;
}

export interface CombinedOptimizationResult {
  job: PipelineJob;
  enterprise: EnterpriseOptimizationResult;
}

export type EnterpriseOptimizationResult = Awaited<
  ReturnType<EnterpriseListingIntelligenceService['generateForPipelineJob']>
>;

/**
 * PipelineService — manages enrichment pipeline jobs.
 *
 * This is an ADDITIVE service that wraps the existing ebay-enrichment-pipeline.mjs
 * as a backend-managed BullMQ job. It does NOT modify any existing ingestion logic.
 */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    @InjectRepository(PipelineJob)
    private readonly jobRepo: Repository<PipelineJob>,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectQueue('pipeline')
    private readonly pipelineQueue: Queue,
    private readonly featureFlagService: FeatureFlagService,
    private readonly enterpriseListingIntelligence: EnterpriseListingIntelligenceService,
    private readonly listingOptimization: ListingOptimizationService,
    private readonly heavyJobLimiter: HeavyJobLimiterService,
    private readonly singleListingForm: SingleListingFormService,
    private readonly teamsService: TeamsService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly storesService: StoresService,
  ) {}

  private async nextUploadCode(): Promise<string> {
    const rows = await this.jobRepo.query(
      `SELECT nextval('pipeline_upload_seq') AS n`,
    );
    const n = Number(rows[0]?.n ?? 1);
    const year = new Date().getFullYear();
    return `UPL-${year}-${String(n).padStart(6, '0')}`;
  }

  private pipelineUploadRoot(): string {
    const projectRoot =
      process.env.PIPELINE_PROJECT_ROOT || path.resolve(process.cwd(), '..');
    return path.resolve(projectRoot, 'uploads', 'pipeline');
  }

  private ensureJobUploadDir(jobId: string): string {
    const dir = path.join(this.pipelineUploadRoot(), jobId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /**
   * Upload buffer to a job-scoped directory, persist the job row, and enqueue processing.
   */
  async createJobFromUpload(
    originalFilename: string,
    fileBuffer: Buffer,
    userId?: string,
    teamId?: string,
    conditionLabel?: string,
    manageAllTeams = false,
    profileOptions?: PipelineUploadProfileOptions,
    user?: User,
  ): Promise<PipelineJob> {
    await this.heavyJobLimiter.assertPipelineSlotAvailable();

    const enabled = await this.featureFlagService.isEnabled(
      'pipeline_enrichment',
    );
    if (!enabled) {
      throw new ServiceUnavailableException(
        'Pipeline enrichment feature is not enabled. Enable the "pipeline_enrichment" feature flag.',
      );
    }

    if (!teamId) {
      throw new BadRequestException('teamId is required');
    }
    if (!conditionLabel?.trim()) {
      throw new BadRequestException('conditionLabel is required');
    }
    if (!PIPELINE_CONDITION_OPTIONS[conditionLabel.trim()]) {
      throw new BadRequestException(
        `Invalid conditionLabel. Allowed: ${Object.keys(PIPELINE_CONDITION_OPTIONS).join(', ')}`,
      );
    }
    if (userId) {
      await this.teamsService.assertUserCanAccessTeam(
        userId,
        teamId,
        manageAllTeams,
      );
    }

    if (!profileOptions) {
      throw new BadRequestException(
        'marketplace, storeId, and shipping/return/payment profiles are required',
      );
    }
    const {
      marketplace,
      storeId,
      shippingProfileName,
      returnProfileName,
      paymentProfileName,
      fulfillmentPolicyId,
      paymentPolicyId,
      returnPolicyId,
    } = profileOptions;

    if (!isPipelineMarketplaceCode(marketplace)) {
      throw new BadRequestException(
        `Invalid marketplace. Allowed: US, UK, AU, DE`,
      );
    }
    if (
      !shippingProfileName?.trim() ||
      !returnProfileName?.trim() ||
      !paymentProfileName?.trim()
    ) {
      throw new BadRequestException(
        'shippingProfileName, returnProfileName, and paymentProfileName are required',
      );
    }

    const store = await this.storesService.getStore(storeId);
    if (store.channel !== 'ebay' || store.status !== 'active') {
      throw new BadRequestException('storeId must be an active eBay store');
    }
    if (
      !storeMatchesPipelineMarketplace(store.ebayMarketplaceId, marketplace)
    ) {
      throw new BadRequestException(
        `Store "${store.storeName}" does not belong to marketplace ${marketplace}`,
      );
    }
    if (user) {
      const accessible = await this.storesService.getStoresByChannel(
        'ebay',
        user,
      );
      if (!accessible.some((s) => s.id === storeId)) {
        throw new ForbiddenException(
          'You do not have access to the selected store',
        );
      }
    }

    const uploadCode = await this.nextUploadCode();

    const placeholder = await this.jobRepo.save(
      this.jobRepo.create({
        originalFilename,
        storedFilePath: 'pending',
        fileSizeBytes: fileBuffer.length,
        status: 'pending',
        createdBy: userId ?? null,
        teamId,
        conditionLabel: conditionLabel.trim(),
        marketplace,
        storeId,
        shippingProfileName: shippingProfileName.trim(),
        returnProfileName: returnProfileName.trim(),
        paymentProfileName: paymentProfileName.trim(),
        fulfillmentPolicyId: fulfillmentPolicyId?.trim() || null,
        paymentPolicyId: paymentPolicyId?.trim() || null,
        returnPolicyId: returnPolicyId?.trim() || null,
        uploadCode,
      }),
    );

    const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedPath = path.join(
      this.ensureJobUploadDir(placeholder.id),
      `${Date.now()}_${safeName}`,
    );
    fs.writeFileSync(storedPath, fileBuffer);

    await this.jobRepo.update(placeholder.id, { storedFilePath: storedPath });
    const saved = await this.jobRepo.findOneByOrFail({ id: placeholder.id });
    return this.enqueuePipelineJob(saved, storedPath, originalFilename);
  }

  /**
   * Create a new enrichment pipeline job and enqueue for processing.
   */
  async createJob(
    dto: CreatePipelineJobDto,
    userId?: string,
  ): Promise<PipelineJob> {
    await this.heavyJobLimiter.assertPipelineSlotAvailable();
    const enabled = await this.featureFlagService.isEnabled(
      'pipeline_enrichment',
    );
    if (!enabled) {
      throw new ServiceUnavailableException(
        'Pipeline enrichment feature is not enabled. Enable the "pipeline_enrichment" feature flag.',
      );
    }

    const job = this.jobRepo.create({
      originalFilename: dto.originalFilename,
      storedFilePath: dto.storedFilePath,
      fileSizeBytes: dto.fileSizeBytes ?? null,
      status: 'pending',
      createdBy: userId ?? null,
    });

    let saved: PipelineJob;
    try {
      saved = await this.jobRepo.save(job);
    } catch (err) {
      this.logger.error(
        `Failed to save pipeline job: ${err instanceof Error ? err.message : err}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new InternalServerErrorException(
        'Failed to create pipeline job. Database may be unreachable or schema is out of date.',
      );
    }

    return this.enqueuePipelineJob(
      saved,
      dto.storedFilePath,
      dto.originalFilename,
    );
  }

  private async enqueuePipelineJob(
    saved: PipelineJob,
    filePath: string,
    originalFilename: string,
  ): Promise<PipelineJob> {
    try {
      await this.pipelineQueue.add(
        'run-pipeline',
        {
          jobId: saved.id,
          filePath,
          originalFilename,
        },
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      );
    } catch (err) {
      this.logger.error(
        `Failed to enqueue pipeline job ${saved.id}: ${err instanceof Error ? err.message : err}`,
        err instanceof Error ? err.stack : undefined,
      );
      await this.jobRepo.update(saved.id, {
        status: 'failed',
        lastError:
          'Failed to enqueue job. Redis may be unavailable. Try again.',
      } as any);
      throw new ServiceUnavailableException(
        'Pipeline job created but could not be queued for processing. Redis may be unavailable. Try again.',
      );
    }

    this.logger.log(
      `Created pipeline job ${saved.id} for file: ${originalFilename}`,
    );
    return saved;
  }

  /**
   * Create a pipeline job from a single listing's form data.
   * Generates a single-row CSV and feeds it into the existing pipeline.
   */
  async createSingleJob(
    dto: CreateSingleListingDto,
    userId?: string,
  ): Promise<PipelineJob> {
    if (!dto.partNumber?.trim()) {
      throw new BadRequestException('partNumber is required');
    }

    const price =
      dto.price != null && !Number.isNaN(dto.price)
        ? dto.price
        : SINGLE_LISTING_DEFAULT_PRICE;
    const quantity =
      dto.quantity != null && !Number.isNaN(dto.quantity)
        ? dto.quantity
        : SINGLE_LISTING_DEFAULT_QUANTITY;

    let sku = dto.sku?.trim();
    if (!sku) {
      sku = await this.singleListingForm.allocateSku();
    }

    const escapeCsv = (val: unknown): string => {
      const s = val == null ? '' : String(val);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const headers = [
      'sku',
      'brand',
      'model',
      'vin',
      'category',
      'part number',
      'part name',
      'note',
      'price',
      'quantity',
      'image urls',
    ];
    const row = [
      sku,
      dto.brand ?? '',
      dto.model ?? '',
      dto.vin ?? '',
      dto.category ?? '',
      dto.partNumber ?? '',
      dto.partName ?? '',
      dto.note ?? '',
      price,
      quantity,
      dto.imageUrls ?? '',
    ]
      .map(escapeCsv)
      .join(',');

    const csv = `${headers.join(',')}\n${row}\n`;
    const csvBuffer = Buffer.from(csv, 'utf8');
    const displayName =
      dto.partName || dto.partNumber || dto.sku || 'Unknown Part';
    const originalFilename = `Single Listing - ${displayName}`;

    await this.heavyJobLimiter.assertPipelineSlotAvailable();
    const enabled = await this.featureFlagService.isEnabled(
      'pipeline_enrichment',
    );
    if (!enabled) {
      throw new ServiceUnavailableException(
        'Pipeline enrichment feature is not enabled. Enable the "pipeline_enrichment" feature flag.',
      );
    }

    const placeholder = await this.jobRepo.save(
      this.jobRepo.create({
        originalFilename,
        storedFilePath: 'pending',
        fileSizeBytes: csvBuffer.length,
        status: 'pending',
        createdBy: userId ?? null,
      }),
    );

    const storedPath = path.join(
      this.ensureJobUploadDir(placeholder.id),
      `single_${Date.now()}.csv`,
    );
    fs.writeFileSync(storedPath, csvBuffer);
    await this.jobRepo.update(placeholder.id, { storedFilePath: storedPath });

    const job = await this.enqueuePipelineJob(
      await this.jobRepo.findOneByOrFail({ id: placeholder.id }),
      storedPath,
      originalFilename,
    );

    // Store uploaded asset IDs so the processor can link them after listing creation
    if (dto.uploadedAssetIds && dto.uploadedAssetIds.length > 0) {
      await this.jobRepo.update(job.id, {
        stageDetails: {
          ...(job.stageDetails ?? {}),
          uploadedAssetIds: dto.uploadedAssetIds,
        },
      } as any);
    }

    return job;
  }

  /**
   * Create one pipeline job from multiple existing listing records (inventory batch enrich).
   */
  async createBatchJobFromListings(
    listingIds: string[],
    userId?: string,
    options?: { source?: string; forceVision?: boolean },
  ): Promise<PipelineJob> {
    const uniqueIds = [...new Set(listingIds)];
    if (uniqueIds.length === 0) {
      throw new BadRequestException('listingIds must not be empty');
    }

    const listings = await this.listingRepo.find({
      where: { id: In(uniqueIds) },
    });

    if (listings.length !== uniqueIds.length) {
      throw new BadRequestException('One or more listings were not found');
    }

    const escapeCsv = (val: unknown): string => {
      const s = val == null ? '' : String(val);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const headers = [
      'sku',
      'brand',
      'model',
      'vin',
      'category',
      'part number',
      'part name',
      'note',
      'price',
      'quantity',
      'image urls',
    ];

    const rows = listings.map((listing) => {
      const partNumber =
        listing.cOeOemPartNumber?.trim() ||
        listing.cManufacturerPartNumber?.trim() ||
        '';
      const price =
        listing.startPriceNum ??
        (listing.startPrice
          ? parseFloat(listing.startPrice)
          : SINGLE_LISTING_DEFAULT_PRICE);
      const quantity =
        listing.quantityNum ??
        (listing.quantity
          ? parseInt(listing.quantity, 10)
          : SINGLE_LISTING_DEFAULT_QUANTITY);
      const imageUrls = (listing.itemPhotoUrl ?? '')
        .split('|')
        .map((u) => u.trim())
        .filter(Boolean)
        .join('|');

      return [
        listing.customLabelSku ?? '',
        listing.cBrand ?? '',
        listing.extractedModel ?? '',
        '',
        listing.categoryName ?? '',
        partNumber,
        listing.title ?? '',
        listing.description ?? '',
        price,
        quantity,
        imageUrls,
      ]
        .map(escapeCsv)
        .join(',');
    });

    const csv = `${headers.join(',')}\n${rows.join('\n')}\n`;
    const csvBuffer = Buffer.from(csv, 'utf8');
    const originalFilename = `Inventory Batch - ${listings.length} parts`;

    await this.heavyJobLimiter.assertPipelineSlotAvailable();
    const enabled = await this.featureFlagService.isEnabled(
      'pipeline_enrichment',
    );
    if (!enabled) {
      throw new ServiceUnavailableException(
        'Pipeline enrichment feature is not enabled. Enable the "pipeline_enrichment" feature flag.',
      );
    }

    const placeholder = await this.jobRepo.save(
      this.jobRepo.create({
        originalFilename,
        storedFilePath: 'pending',
        fileSizeBytes: csvBuffer.length,
        status: 'pending',
        createdBy: userId ?? null,
      }),
    );

    const storedPath = path.join(
      this.ensureJobUploadDir(placeholder.id),
      `batch_${Date.now()}.csv`,
    );
    fs.writeFileSync(storedPath, csvBuffer);
    await this.jobRepo.update(placeholder.id, { storedFilePath: storedPath });

    const job = await this.enqueuePipelineJob(
      await this.jobRepo.findOneByOrFail({ id: placeholder.id }),
      storedPath,
      originalFilename,
    );

    await this.jobRepo.update(job.id, {
      stageDetails: {
        ...(job.stageDetails ?? {}),
        sourceListingIds: uniqueIds,
        source: options?.source ?? 'inventory',
        forceVision: options?.forceVision ?? false,
      },
    } as any);

    await this.listingRepo.update(
      { id: In(uniqueIds) },
      { pipelineJobId: job.id },
    );

    this.logger.log(
      `Created batch pipeline job ${job.id} for ${uniqueIds.length} inventory listing(s)`,
    );

    return job;
  }

  /**
   * List pipeline jobs with optional status filter.
   */
  async listJobs(
    status?: string,
    limit = 20,
    offset = 0,
    viewerId?: string,
    viewAll = true,
    displayStatus?: string,
    teamIds?: string[],
  ): Promise<{ jobs: PipelineJobListItem[]; total: number }> {
    const qb = this.jobRepo
      .createQueryBuilder('j')
      .orderBy('j.createdAt', 'DESC');
    if (status) qb.andWhere('j.status = :status', { status });
    if (viewerId) {
      applyCreatedByVisibility(qb, 'j', viewerId, viewAll);
    }
    if (!viewAll && viewerId) {
      const accessible = await this.teamsService.getUserTeamIds(viewerId);
      if (accessible.length === 0) {
        qb.andWhere('1 = 0');
      } else {
        qb.andWhere(
          '(j.team_id IN (:...accessibleTeams) OR j.team_id IS NULL)',
          {
            accessibleTeams: accessible,
          },
        );
      }
    }
    if (teamIds?.length) {
      qb.andWhere('j.team_id IN (:...filterTeamIds)', {
        filterTeamIds: teamIds,
      });
    }
    if (displayStatus) {
      switch (displayStatus) {
        case 'queued':
          qb.andWhere('j.status = :queuedStatus', { queuedStatus: 'pending' });
          break;
        case 'uploaded':
          qb.andWhere('j.status = :uploadedStatus', {
            uploadedStatus: 'completed',
          });
          break;
        case 'failed':
          qb.andWhere('j.status IN (:...failedStatuses)', {
            failedStatuses: ['failed', 'cancelled'],
          });
          break;
        case 'processing':
          qb.andWhere('j.status NOT IN (:...terminalStatuses)', {
            terminalStatuses: ['pending', 'completed', 'failed', 'cancelled'],
          });
          break;
        default:
          break;
      }
    }
    qb.take(limit).skip(offset);
    const [jobs, total] = await qb.getManyAndCount();
    return { jobs: await this.enrichJobList(jobs), total };
  }

  private async enrichJobList(
    jobs: PipelineJob[],
  ): Promise<PipelineJobListItem[]> {
    if (jobs.length === 0) return [];

    const teamIds = [
      ...new Set(jobs.map((j) => j.teamId).filter(Boolean)),
    ] as string[];
    const userIds = [
      ...new Set(jobs.map((j) => j.createdBy).filter(Boolean)),
    ] as string[];
    const storeIds = [
      ...new Set(jobs.map((j) => j.storeId).filter(Boolean)),
    ] as string[];

    const teamMap = await this.teamsService.findTeamsByIds(teamIds);
    const users = userIds.length
      ? await this.userRepo.find({
          where: { id: In(userIds) },
          select: ['id', 'name', 'email'],
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    const stores = storeIds.length
      ? await Promise.all(
          storeIds.map((id) =>
            this.storesService.getStore(id).catch(() => null),
          ),
        )
      : [];
    const storeMap = new Map(
      stores
        .filter(Boolean)
        .map((s) => [s!.id, { id: s!.id, storeName: s!.storeName }]),
    );

    return jobs.map((job) => {
      const team = job.teamId ? teamMap.get(job.teamId) : undefined;
      const user = job.createdBy ? userMap.get(job.createdBy) : undefined;
      const store = job.storeId ? storeMap.get(job.storeId) : undefined;
      return {
        id: job.id,
        uploadCode: job.uploadCode,
        status: job.status,
        displayStatus: mapPipelineDisplayStatus(job.status),
        originalFilename: job.originalFilename,
        totalParts: job.totalParts,
        conditionLabel: job.conditionLabel,
        marketplace: job.marketplace,
        store: store ?? null,
        shippingProfileName: job.shippingProfileName,
        returnProfileName: job.returnProfileName,
        paymentProfileName: job.paymentProfileName,
        team: team ? { id: team.id, name: team.name, color: team.color } : null,
        uploadedBy: user
          ? { id: user.id, name: user.name || user.email }
          : null,
        createdAt: job.createdAt,
        fileSizeBytes: job.fileSizeBytes,
      };
    });
  }

  /**
   * Get a single pipeline job by ID.
   */
  async getJob(
    id: string,
    viewerId?: string,
    viewAll = true,
  ): Promise<PipelineJob> {
    const job = await this.jobRepo.findOneBy({ id });
    if (!job) throw new NotFoundException(`Pipeline job ${id} not found`);
    if (viewerId && !canViewJob(job.createdBy, viewerId, viewAll)) {
      throw new ForbiddenException(
        'You do not have access to this pipeline job',
      );
    }
    return job;
  }

  /**
   * Update job progress (called from the BullMQ processor).
   */
  async updateProgress(
    id: string,
    update: Partial<PipelineJob>,
  ): Promise<PipelineJob> {
    await this.jobRepo.update(id, update as any);
    return this.getJob(id);
  }

  /**
   * Cancel a pending/processing pipeline job.
   */
  async cancelJob(
    id: string,
    actorId?: string,
    viewAll = true,
  ): Promise<PipelineJob> {
    const job = await this.getJob(id, actorId, viewAll);
    if (job.status === 'completed' || job.status === 'cancelled') {
      throw new BadRequestException(
        `Job ${id} cannot be cancelled (current: ${job.status})`,
      );
    }

    job.status = 'cancelled';
    job.completedAt = new Date();
    job.createdBy = withCreatedByBackfill(job.createdBy, actorId);
    return this.jobRepo.save(job);
  }

  /**
   * Retry a failed pipeline job.
   */
  async retryJob(
    id: string,
    actorId?: string,
    viewAll = true,
  ): Promise<PipelineJob> {
    const job = await this.getJob(id, actorId, viewAll);
    if (job.status !== 'failed') {
      throw new BadRequestException(
        `Job ${id} is not in failed state (current: ${job.status})`,
      );
    }

    job.status = 'pending';
    job.lastError = null;
    job.errorCount = 0;
    job.startedAt = null;
    job.completedAt = null;
    job.createdBy = withCreatedByBackfill(job.createdBy, actorId);
    await this.jobRepo.save(job);

    await this.pipelineQueue.add(
      'run-pipeline',
      {
        jobId: id,
        filePath: job.storedFilePath,
        originalFilename: job.originalFilename,
      },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 60_000 },
      },
    );

    this.logger.log(`Retrying pipeline job ${id}`);
    return job;
  }

  /**
   * Resume catalog import for a job that finished enrichment + output
   * generation but got stuck during the import phase. Reuses on-disk output
   * XLSX files and runs only the post-enrichment import with the current
   * (batched/optimized) MVL validation. Does NOT re-run enrichment.
   */
  async resumeImport(
    id: string,
    actorId?: string,
    viewAll = true,
  ): Promise<PipelineJob> {
    const job = await this.getJob(id, actorId, viewAll);

    // Allow resume from any non-completed state — the typical case is a job
    // stuck in output_generation/catalog_import, or marked failed after a
    // worker restart. Guard against double-resume of an already-completed job.
    if (job.status === 'completed') {
      throw new BadRequestException(`Job ${id} is already completed`);
    }

    const projectRoot =
      process.env.PIPELINE_PROJECT_ROOT || path.resolve(process.cwd(), '..');
    const outputDir = path.resolve(
      projectRoot,
      'output',
      `pipeline-${id.slice(0, 8)}`,
    );
    if (!fs.existsSync(outputDir)) {
      throw new BadRequestException(
        `Cannot resume — output directory not found: ${outputDir}. Enrichment output is required.`,
      );
    }

    // Remove any leftover BullMQ job for this pipeline job so the worker
    // doesn't double-process (the old job may still hold an active lock).
    try {
      const existing = await this.pipelineQueue.getJobs([
        'wait',
        'active',
        'delayed',
        'paused',
      ]);
      for (const entry of existing) {
        if ((entry.data as PipelineJobData).jobId === id) {
          await entry.remove();
          this.logger.log(
            `Removed stale BullMQ job ${entry.id} for ${id} before resume`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `Could not clean stale BullMQ jobs for ${id}: ${err instanceof Error ? err.message : err}`,
      );
    }

    await this.pipelineQueue.add(
      'resume-import',
      {
        jobId: id,
        filePath: job.storedFilePath ?? '',
        originalFilename: job.originalFilename,
      } satisfies PipelineJobData,
      {
        attempts: 1,
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );

    this.logger.log(
      `Resuming catalog import for job ${id} (output: ${outputDir})`,
    );
    return job;
  }

  /**
   * Get aggregate stats for pipeline jobs using a single DB query.
   */
  async getStats(): Promise<PipelineJobSummary> {
    const result = await this.jobRepo
      .createQueryBuilder('job')
      .select('job.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(job.processedParts), 0)', 'totalPartsProcessed')
      .addSelect('COALESCE(SUM(job.enrichedCount), 0)', 'totalEnriched')
      .addSelect('COALESCE(SUM(job.openaiTokensUsed), 0)', 'totalTokens')
      .groupBy('job.status')
      .getRawMany<{
        status: string;
        count: string;
        totalPartsProcessed: string;
        totalEnriched: string;
        totalTokens: string;
      }>();

    const byStatus: Record<string, number> = {};
    let total = 0;
    let totalPartsProcessed = 0;
    let totalEnriched = 0;
    let totalTokens = 0;

    for (const row of result) {
      const count = parseInt(row.count, 10);
      byStatus[row.status] = count;
      total += count;
      totalPartsProcessed += parseInt(row.totalPartsProcessed, 10) || 0;
      totalEnriched += parseInt(row.totalEnriched, 10) || 0;
      totalTokens += parseInt(row.totalTokens, 10) || 0;
    }

    const pending = byStatus.pending ?? 0;
    const completed = byStatus.completed ?? 0;
    const failed = byStatus.failed ?? 0;
    const cancelled = byStatus.cancelled ?? 0;
    const processing = Object.entries(byStatus)
      .filter(
        ([status]) =>
          !['completed', 'failed', 'cancelled', 'pending'].includes(status),
      )
      .reduce((sum, [, count]) => sum + count, 0);

    return {
      total,
      pending,
      processing,
      completed,
      failed,
      cancelled,
      byStatus,
      totalPartsProcessed,
      totalEnriched,
      totalTokens,
    };
  }

  async generateEnterpriseOptimization(
    jobId: string,
    options?: {
      marketplace?: 'US' | 'DE' | 'AU';
      limit?: number;
      aiBudgetListings?: number;
      listingQualityProfile?: ListingQualityProfile;
    },
  ): Promise<EnterpriseOptimizationResult> {
    const enterpriseDefaults = this.normalizeEnterpriseOptions(options);
    return this.enterpriseListingIntelligence.generateForPipelineJob(
      jobId,
      enterpriseDefaults,
    );
  }

  async runCombinedOptimization(
    jobId: string,
    options?: {
      marketplace?: 'US' | 'DE' | 'AU';
      limit?: number;
      aiBudgetListings?: number;
      listingQualityProfile?: ListingQualityProfile;
    },
  ): Promise<CombinedOptimizationResult> {
    const job = await this.getJob(jobId);
    if (job.status !== 'completed') {
      throw new BadRequestException(
        `Pipeline job ${jobId} is ${job.status}. Wait until enrichment pipeline completes.`,
      );
    }

    const marketplace = options?.marketplace ?? 'US';
    await this.listingOptimization.enqueueJobOptimization(jobId, marketplace);

    const status = await this.getOptimizationStatus(jobId);
    const refreshedJob = await this.getJob(jobId);
    return {
      job: refreshedJob,
      enterprise: this.optimizationStatusToEnterpriseResult(
        jobId,
        status,
        marketplace,
      ),
    };
  }

  async getOptimizationStatus(
    jobId: string,
    marketplace?: string,
  ): Promise<JobOptimizationStatus> {
    return this.listingOptimization.getJobOptimizationStatus(
      jobId,
      marketplace,
    );
  }

  async getProductOptimization(productId: string) {
    return this.listingOptimization.getProductOptimization(productId);
  }

  async rerunProductOptimization(
    productId: string,
    marketplace: 'US' | 'DE' | 'AU' = 'US',
  ) {
    return this.listingOptimization.optimizeProduct(productId, marketplace, {
      force: true,
    });
  }

  async markProductManualReview(productId: string, enabled = true) {
    return this.listingOptimization.markManualReview(productId, enabled);
  }

  async bypassJobOptimization(jobId: string) {
    return this.listingOptimization.bypassJobOptimization(jobId);
  }

  private optimizationStatusToEnterpriseResult(
    jobId: string,
    status: JobOptimizationStatus,
    marketplace: 'US' | 'DE' | 'AU',
  ): EnterpriseOptimizationResult {
    return {
      jobId,
      marketplace,
      totalProducts: status.total,
      aiGeneratedCount: status.processed,
      blockedCount: status.blockCount,
      reviewCount: status.reviewCount,
      passCount: status.passCount,
      averageUploadReadiness:
        status.products.length > 0
          ? Math.round(
              (status.products.reduce((s, p) => s + p.uploadReadinessScore, 0) /
                status.products.length) *
                100,
            ) / 100
          : 0,
      listings: status.products.map((p) => ({
        productId: p.productId,
        sku: p.sku,
        optimizedTitle: p.optimizedTitle ?? '',
        validationStatus: p.validationStatus,
        uploadReadinessScore: p.uploadReadinessScore,
        complianceWarnings: [...p.errors, ...p.warnings],
        missingDataReport: p.missingDataReport,
        finalUploadPayload: {},
      })) as EnterpriseOptimizationResult['listings'],
    };
  }

  private normalizeEnterpriseOptions(options?: {
    marketplace?: 'US' | 'DE' | 'AU';
    limit?: number;
    aiBudgetListings?: number;
    listingQualityProfile?: ListingQualityProfile;
  }): {
    marketplace?: 'US' | 'DE' | 'AU';
    limit?: number;
    aiBudgetListings?: number;
    listingQualityProfile?: ListingQualityProfile;
  } {
    const limit = options?.limit;
    return {
      marketplace: options?.marketplace,
      limit,
      // Enforce full enterprise AI optimization coverage for all selected rows.
      aiBudgetListings: limit,
      listingQualityProfile:
        options?.listingQualityProfile ?? 'max_seo_comprehensive',
    };
  }
}
