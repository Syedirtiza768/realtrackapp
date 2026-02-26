import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { DashboardService } from '../dashboard.service.js';

@Processor('dashboard', { concurrency: 1 })
export class AggregationProcessor extends WorkerHost {
  private readonly logger = new Logger(AggregationProcessor.name);

  constructor(private readonly dashboardService: DashboardService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'recompute-summary':
        this.logger.log('Recomputing dashboard summary...');
        await this.dashboardService.getSummary();
        await this.dashboardService.getKpis();
        this.logger.log('Dashboard summary recomputed.');
        break;

      case 'daily-sales-rollup':
        this.logger.log('Running daily sales rollup...');
        // Future: aggregate daily sales into a summary table
        this.logger.log('Daily sales rollup complete.');
        break;

      default:
        this.logger.warn(`Unknown job: ${job.name}`);
    }
  }
}
