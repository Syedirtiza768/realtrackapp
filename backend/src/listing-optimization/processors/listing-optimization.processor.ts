import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { ListingOptimizationService } from '../listing-optimization.service.js';

export interface ListingOptimizationJobData {
  /** Pipeline-job-scoped optimization: optimizes every product in the job. */
  jobId?: string;
  /** Single-product optimization (e.g. warehouse-intake parts, which have no pipelineJobId). */
  productId?: string;
  marketplace?: 'US' | 'DE' | 'AU';
  /** Regenerate even if already optimizationStatus='completed' with a matching source data hash. */
  force?: boolean;
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
    const { jobId, productId, marketplace = 'US', force = false } = job.data;

    if (productId) {
      this.logger.log(
        `Starting single-product listing optimization for product ${productId} [${marketplace}]${force ? ' (force)' : ''}`,
      );
      try {
        await this.optimization.optimizeProduct(productId, marketplace, {
          force,
        });
        this.logger.log(
          `Completed listing optimization for product ${productId} [${marketplace}]`,
        );
      } catch (err) {
        this.logger.error(
          `Listing optimization crashed for product ${productId} [${marketplace}]: ${String(err)}`,
        );
        // Same rationale as the job-scoped path below: without this, a crash
        // leaves optimization_status stuck at 'running' forever.
        await this.optimization
          .markProductOptimizationFailed(productId, String(err))
          .catch(() => {});
        throw err;
      }
      return;
    }

    if (!jobId) {
      this.logger.error(
        `Listing optimization job has neither jobId nor productId: ${JSON.stringify(job.data)}`,
      );
      return;
    }

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

    const { jobId, productId, marketplace = 'US' } = job.data;

    if (productId) {
      this.logger.error(
        `Listing optimization for product ${productId} [${marketplace}] permanently failed after ${job.attemptsMade} attempts: ${job.failedReason}`,
      );
      await this.optimization
        .markProductOptimizationFailed(
          productId,
          job.failedReason ?? 'Optimization failed',
        )
        .catch(() => {});
      return;
    }

    if (!jobId) return;

    this.logger.error(
      `Listing optimization for pipeline job ${jobId} [${marketplace}] permanently failed after ${job.attemptsMade} attempts: ${job.failedReason}`,
    );
    await this.optimization
      .markJobOptimizationFailed(jobId, marketplace)
      .catch(() => {});
  }
}
