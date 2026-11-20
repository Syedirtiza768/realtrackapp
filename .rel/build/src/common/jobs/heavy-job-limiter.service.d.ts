import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { CatalogImport } from '../../catalog-import/entities/catalog-import.entity.js';
import { PipelineJob } from '../../ingestion/entities/pipeline-job.entity.js';
export declare class HeavyJobLimiterService {
    private readonly pipelineJobRepo;
    private readonly importRepo;
    private readonly pipelineQueue;
    private readonly config;
    private readonly logger;
    constructor(pipelineJobRepo: Repository<PipelineJob>, importRepo: Repository<CatalogImport>, pipelineQueue: Queue, config: ConfigService);
    assertPipelineSlotAvailable(): Promise<void>;
    private recoverStalePipelineJobs;
    assertCatalogImportSlotAvailable(): Promise<void>;
}
