import { WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { FashionIntakeService, type FashionIntakeJob } from './fashion-intake.service.js';
export declare class FashionIntakeProcessor extends WorkerHost {
    private readonly intake;
    constructor(intake: FashionIntakeService);
    process(job: Job<FashionIntakeJob>): Promise<{
        skipped: string;
        status?: undefined;
    } | {
        status: string;
        skipped?: undefined;
    }>;
}
