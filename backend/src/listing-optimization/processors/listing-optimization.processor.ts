import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { ListingOptimizationService } from '../listing-optimization.service.js';

export interface ListingOptimizationJobData {
  jobId: string;
  marketplace?: 'US' | 'DE' | 'AU';
}

@Processor('listing-optimization', {
  concurrency: 1,
  lockDuration: 120 * 60 * 1000, // 2 hour lock — handles large pipeline jobs with 500+ products
  maxStalledCount: 2,
  stalledInterval: 30_000,
})
export class ListingOptimizationProcessor extends WorkerHost {
  private readonly logger = new Logger(ListingOptimizationProcessor.name);

  constructor(private readonly optimization: ListingOptimizationService) {
    super();
  }

  async process(job: Job<ListingOptimizationJobData>): Promise<void> {
    const { jobId, marketplace = 'US' } = job.data;
    this.logger.log(
      `Starting mandatory listing optimization for pipeline job ${jobId} [${marketplace}]`,
    );
    await this.optimization.enqueueJobOptimization(jobId, marketplace, job);
    this.logger.log(
      `Completed listing optimization for pipeline job ${jobId} [${marketplace}]`,
    );
  }
}
