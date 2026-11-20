import type { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { ImageAsset } from '../storage/entities/image-asset.entity.js';
import { IngestionJob } from './entities/ingestion-job.entity.js';
import { AiResult } from './entities/ai-result.entity.js';
import type { CreateJobDto } from './dto/create-job.dto.js';
import type { IngestionJobData } from './processors/ingestion.processor.js';
export declare class IngestionService {
    private readonly jobRepo;
    private readonly aiResultRepo;
    private readonly assetRepo;
    private readonly ingestionQueue;
    private readonly logger;
    constructor(jobRepo: Repository<IngestionJob>, aiResultRepo: Repository<AiResult>, assetRepo: Repository<ImageAsset>, ingestionQueue: Queue<IngestionJobData>);
    createJob(dto: CreateJobDto, userId?: string): Promise<IngestionJob>;
    listJobs(status?: string, limit?: number, offset?: number, viewerId?: string, viewAll?: boolean): Promise<{
        jobs: IngestionJob[];
        total: number;
    }>;
    getJob(id: string, viewerId?: string, viewAll?: boolean): Promise<{
        job: IngestionJob;
        aiResult: AiResult | null;
        images: ImageAsset[];
    }>;
    retryJob(id: string, actorId?: string, viewAll?: boolean): Promise<IngestionJob>;
    cancelJob(id: string, actorId?: string, viewAll?: boolean): Promise<IngestionJob>;
    getStats(): Promise<Record<string, number>>;
}
