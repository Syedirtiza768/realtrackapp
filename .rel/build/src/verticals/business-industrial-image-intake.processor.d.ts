import { WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { BusinessIndustrialImageIntakeService } from './business-industrial-image-intake.service.js';
export declare class BusinessIndustrialImageIntakeProcessor extends WorkerHost {
    private readonly intake;
    constructor(intake: BusinessIndustrialImageIntakeService);
    process(job: Job<{
        jobId: string;
        maxItems?: number;
        autoCreateDrafts?: boolean;
        skipFolderNames?: string[];
    }>): Promise<{
        jobId: string;
    }>;
}
