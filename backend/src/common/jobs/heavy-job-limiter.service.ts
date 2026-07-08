import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { In, LessThan, Repository } from 'typeorm';
import { CatalogImport } from '../../catalog-import/entities/catalog-import.entity.js';
import {
  PipelineJob,
  type PipelineJobStatus,
} from '../../ingestion/entities/pipeline-job.entity.js';

/** Jobs actively consuming a worker — excludes `pending` (queued, not yet started). */
const PIPELINE_SLOT_STATUSES: PipelineJobStatus[] = [
  'uploading',
  'vin_decode',
  'category_mapping',
  'enrichment',
  'validation',
  'output_generation',
];

const ACTIVE_IMPORT_STATUSES = ['validating', 'processing', 'paused'] as const;

@Injectable()
export class HeavyJobLimiterService {
  private readonly logger = new Logger(HeavyJobLimiterService.name);

  constructor(
    @InjectRepository(PipelineJob)
    private readonly pipelineJobRepo: Repository<PipelineJob>,
    @InjectRepository(CatalogImport)
    private readonly importRepo: Repository<CatalogImport>,
    @InjectQueue('pipeline')
    private readonly pipelineQueue: Queue,
    private readonly config: ConfigService,
  ) {}

  async assertPipelineSlotAvailable(): Promise<void> {
    const max = Number(
      this.config.get<string>('MAX_CONCURRENT_PIPELINE_JOBS', '2'),
    );
    if (max <= 0) return;

    await this.recoverStalePipelineJobs();

    const active = await this.pipelineJobRepo.count({
      where: { status: In(PIPELINE_SLOT_STATUSES) },
    });
    if (active >= max) {
      throw new ServiceUnavailableException(
        `Pipeline capacity reached (${active}/${max} jobs processing). Cancel a running job from History or wait for it to finish.`,
      );
    }
  }

  /**
   * Fail jobs stuck in a processing stage with no progress for too long
   * (e.g. worker hung during post-process) so uploads are not blocked forever.
   */
  private async recoverStalePipelineJobs(): Promise<void> {
    const staleMinutes = Number(
      this.config.get<string>('PIPELINE_JOB_STALE_MINUTES', '360'),
    );
    if (staleMinutes <= 0) return;

    const cutoff = new Date(Date.now() - staleMinutes * 60_000);
    const stale = await this.pipelineJobRepo.find({
      where: {
        status: In(PIPELINE_SLOT_STATUSES),
        updatedAt: LessThan(cutoff),
      },
      select: ['id', 'originalFilename', 'status', 'updatedAt'],
      take: 20,
    });
    if (stale.length === 0) return;

    for (const job of stale) {
      await this.pipelineJobRepo.update(job.id, {
        status: 'failed',
        lastError: `Job timed out (no progress for ${staleMinutes} minutes). Retry from History.`,
        completedAt: new Date(),
      });
      this.logger.warn(
        `Marked stale pipeline job ${job.id} (${job.originalFilename}) as failed`,
      );
    }

    // Best-effort: drop matching BullMQ entries so workers do not keep running
    try {
      const [queued, active, delayed] = await Promise.all([
        this.pipelineQueue.getWaiting(),
        this.pipelineQueue.getActive(),
        this.pipelineQueue.getDelayed(),
      ]);
      const staleIds = new Set(stale.map((j) => j.id));
      for (const entry of [...queued, ...active, ...delayed]) {
        const jobId = (entry.data as { jobId?: string }).jobId;
        if (jobId && staleIds.has(jobId)) {
          await entry.remove().catch(() => {});
        }
      }
    } catch (err) {
      this.logger.warn(
        `Could not remove stale jobs from BullMQ: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async assertCatalogImportSlotAvailable(): Promise<void> {
    const max = Number(
      this.config.get<string>('MAX_CONCURRENT_CATALOG_IMPORTS', '2'),
    );
    if (max <= 0) return;

    const active = await this.importRepo.count({
      where: { status: In([...ACTIVE_IMPORT_STATUSES]) },
    });
    if (active >= max) {
      throw new ServiceUnavailableException(
        `Catalog import capacity reached (${active}/${max} jobs running). Try again shortly.`,
      );
    }
  }
}
