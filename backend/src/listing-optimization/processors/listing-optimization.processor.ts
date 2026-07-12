import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
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

  /**
   * The try/catch in process() only fires when enqueueJobOptimization itself
   * throws. BullMQ's own stalled-job watchdog can also permanently fail a
   * job from outside any process() call — e.g. "job stalled more than
   * allowable limit" once maxStalledCount is exceeded — without ever
   * re-invoking process(). That path bypasses the try/catch entirely and
   * left optimization_status stuck at 'running' in production even though
   * the job was already dead (job 572e96dd, 2026-07-12). This event fires
   * for every failure path BullMQ has, including that one.
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<ListingOptimizationJobData> | undefined): Promise<void> {
    if (!job) return;
    // BullMQ emits 'failed' on every failed attempt, not just the final one
    // — an in-progress retry (attempts remaining) will often succeed moments
    // later. Only mark the job dead once BullMQ has actually given up.
    const maxAttempts = job.opts?.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) return;

    const { jobId, marketplace = 'US' } = job.data;
    this.logger.error(
      `Listing optimization for pipeline job ${jobId} [${marketplace}] permanently failed after ${job.attemptsMade} attempts: ${job.failedReason}`,
    );
    await this.optimization
      .markJobOptimizationFailed(jobId, marketplace)
      .catch(() => {});
  }
}
