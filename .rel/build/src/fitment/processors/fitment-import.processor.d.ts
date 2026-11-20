import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FitmentImportService, type AcesVehicleRow } from '../fitment-import.service.js';
export declare class FitmentImportProcessor extends WorkerHost {
    private readonly importService;
    private readonly logger;
    private static readonly BATCH_SIZE;
    constructor(importService: FitmentImportService);
    process(job: Job<{
        rows: AcesVehicleRow[];
        userId?: string;
    }>): Promise<void>;
}
