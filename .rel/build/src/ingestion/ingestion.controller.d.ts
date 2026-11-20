import { IngestionService } from './ingestion.service.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { User } from '../auth/entities/user.entity.js';
import { RbacService } from '../rbac/rbac.service.js';
export declare class IngestionController {
    private readonly ingestionService;
    private readonly rbac;
    constructor(ingestionService: IngestionService, rbac: RbacService);
    createJob(dto: CreateJobDto, user: User): Promise<{
        job: import("./entities/ingestion-job.entity.js").IngestionJob;
    }>;
    listJobs(user: User, status?: string, limit?: number, offset?: number): Promise<{
        jobs: import("./entities/ingestion-job.entity.js").IngestionJob[];
        total: number;
    }>;
    getJob(id: string, user: User): Promise<{
        job: import("./entities/ingestion-job.entity.js").IngestionJob;
        aiResult: import("./entities/ai-result.entity.js").AiResult | null;
        images: import("../storage/entities/image-asset.entity.js").ImageAsset[];
    }>;
    retryJob(id: string, user: User): Promise<{
        job: import("./entities/ingestion-job.entity.js").IngestionJob;
    }>;
    cancelJob(id: string, user: User): Promise<{
        job: import("./entities/ingestion-job.entity.js").IngestionJob;
    }>;
    getStats(): Promise<{
        stats: Record<string, number>;
    }>;
}
