import { WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { DashboardService } from '../dashboard.service.js';
import { SalesRecord } from '../entities/sales-record.entity.js';
import { DashboardCache } from '../entities/dashboard-cache.entity.js';
export declare class AggregationProcessor extends WorkerHost {
    private readonly dashboardService;
    private readonly salesRepo;
    private readonly cacheRepo;
    private readonly logger;
    constructor(dashboardService: DashboardService, salesRepo: Repository<SalesRecord>, cacheRepo: Repository<DashboardCache>);
    process(job: Job): Promise<void>;
    private handleDailySalesRollup;
}
