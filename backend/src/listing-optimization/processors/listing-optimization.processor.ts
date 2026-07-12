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
    try {
      await this.optimization.enqueueJobOptimization(jobId, marketplace, job);
      this.logger.log(
        `Completed listing optimization for pipeline job ${jobId} [${marketplace}]`,
      );
    } catch (err) {
      this.logger.error(
        `Listing optimization crashed for pipeline job ${jobId} [${marketplace}]: ${String(err)}`,
      );
      // Without this, a mid-loop crash leaves optimization_status stuck at
      // 'running' forever in the DB even though BullMQ has already given up
      // on the job — the UI polls that field and shows "stuck" indefinitely.
      await this.optimization
        .markJobOptimizationFailed(jobId, marketplace)
        .catch(() => {});
      throw err;
    }
  }
}
