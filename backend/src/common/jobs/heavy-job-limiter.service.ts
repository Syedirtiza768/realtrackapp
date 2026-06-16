import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CatalogImport } from '../../catalog-import/entities/catalog-import.entity.js';
import { PipelineJob, type PipelineJobStatus } from '../../ingestion/entities/pipeline-job.entity.js';

const ACTIVE_PIPELINE_STATUSES: PipelineJobStatus[] = [
  'pending',
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
  constructor(
    @InjectRepository(PipelineJob)
    private readonly pipelineJobRepo: Repository<PipelineJob>,
    @InjectRepository(CatalogImport)
    private readonly importRepo: Repository<CatalogImport>,
    private readonly config: ConfigService,
  ) {}

  async assertPipelineSlotAvailable(): Promise<void> {
    const max = Number(this.config.get<string>('MAX_CONCURRENT_PIPELINE_JOBS', '2'));
    if (max <= 0) return;

    const active = await this.pipelineJobRepo.count({
      where: { status: In(ACTIVE_PIPELINE_STATUSES) },
    });
    if (active >= max) {
      throw new ServiceUnavailableException(
        `Pipeline capacity reached (${active}/${max} jobs running). Try again shortly.`,
      );
    }
  }

  async assertCatalogImportSlotAvailable(): Promise<void> {
    const max = Number(this.config.get<string>('MAX_CONCURRENT_CATALOG_IMPORTS', '2'));
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
