import { WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IngestionJob } from '../entities/ingestion-job.entity.js';
import { AiResult } from '../entities/ai-result.entity.js';
import { ImageAsset } from '../../storage/entities/image-asset.entity.js';
import { AiService } from '../ai/ai.service.js';
import { StorageService } from '../../storage/storage.service.js';
export interface IngestionJobData {
    jobId: string;
    assetIds: string[];
    mode: 'single' | 'bulk' | 'bundle';
    preferredProvider: 'openai' | 'google';
}
export declare class IngestionProcessor extends WorkerHost {
    private readonly jobRepo;
    private readonly aiResultRepo;
    private readonly assetRepo;
    private readonly aiService;
    private readonly storageService;
    private readonly eventEmitter;
    private readonly logger;
    constructor(jobRepo: Repository<IngestionJob>, aiResultRepo: Repository<AiResult>, assetRepo: Repository<ImageAsset>, aiService: AiService, storageService: StorageService, eventEmitter: EventEmitter2);
    process(job: Job<IngestionJobData>): Promise<void>;
}
