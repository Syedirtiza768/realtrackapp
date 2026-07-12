import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { ListingOptimizationService } from '../listing-optimization.service.js';

export interface ListingOptimizationJobData {
  jobId: string;
  marketplace?: 'US' | 'DE' | 'AU';
}

// Multiple pipeline jobs' optimizations can run side by side — each job/
// marketplace pair is independent, and the OpenAI calls they make already
// self-throttle on provider rate-limit headers (see OpenAiService.chat).
// Previously hardcoded to 1, which serialized every job in the system
// behind whichever one happened to be running.
const CONCURRENCY = Math.max(
  1,
  Number(process.env.LISTING_OPTIMIZATION_CONCURRENCY ?? '3') || 3,
);

@Processor('listing-optimization', {
  concurrency: CONCURRENCY,
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
