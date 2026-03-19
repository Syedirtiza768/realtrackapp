import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OpenAiService } from './openai.service.js';
import type {
  OpenAiQueueJob,
  OpenAiQueueResult,
  OpenAiJobPriority,
} from './openai.types.js';

/** BullMQ priority mapping (lower = higher priority) */
const PRIORITY_MAP: Record<OpenAiJobPriority, number> = {
  critical: 1,
  high: 3,
  normal: 5,
  low: 10,
};

/**
 * OpenAiQueueService — BullMQ-backed prompt queue for OpenAI calls.
 *
 * Provides:
 *  - Priority-based job scheduling (critical > high > normal > low)
 *  - Automatic retry with configurable max retries
 *  - EventEmitter2 callbacks on completion
 *  - Concurrency control (default 3 concurrent OpenAI calls)
 *  - Job deduplication by jobId
 *
 * Use this for non-blocking AI operations (enrichment pipelines,
 * batch listing generation, competitive analysis).
 * For real-time AI calls (user-facing), use OpenAiService.chat() directly.
 */
@Injectable()
export class OpenAiQueueService implements OnModuleInit {
  private readonly logger = new Logger(OpenAiQueueService.name);

  constructor(
    @InjectQueue('openai') private readonly queue: Queue,
  ) {}

  onModuleInit() {
    this.logger.log('OpenAI queue service initialized');
  }

  /**
   * Enqueue an OpenAI chat completion job.
   */
  async enqueue(job: OpenAiQueueJob): Promise<string> {
    const bullJob = await this.queue.add('openai-chat', job, {
      jobId: job.jobId,
      priority: PRIORITY_MAP[job.priority] ?? PRIORITY_MAP.normal,
      attempts: job.maxRetries ?? 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 200 },
    });

    this.logger.debug(
      `Enqueued OpenAI job ${job.jobId} (priority=${job.priority}, caller=${job.callerContext ?? 'unknown'})`,
    );
    return bullJob.id!;
  }

  /**
   * Get queue health metrics.
   */
  async getQueueHealth() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Drain (clear) the queue.
   */
  async drain(): Promise<void> {
    await this.queue.drain();
    this.logger.warn('OpenAI queue drained');
  }
}

/**
 * OpenAiQueueProcessor — BullMQ worker that processes OpenAI queue jobs.
 */
@Processor('openai', { concurrency: 3 })
export class OpenAiQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(OpenAiQueueProcessor.name);

  constructor(
    private readonly openai: OpenAiService,
    private readonly events: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<OpenAiQueueJob>): Promise<OpenAiQueueResult> {
    const { jobId, request, callbackEvent, callerContext } = job.data;
    this.logger.debug(
      `Processing OpenAI job ${jobId} (attempt ${job.attemptsMade + 1}, caller=${callerContext ?? 'unknown'})`,
    );

    try {
      const response = await this.openai.chat(request);

      const result: OpenAiQueueResult = {
        jobId,
        success: true,
        response,
        retryCount: job.attemptsMade,
      };

      // Emit result event if a callback was specified
      if (callbackEvent) {
        this.events.emit(callbackEvent, result);
      }

      return result;
    } catch (err: any) {
      this.logger.error(
        `OpenAI job ${jobId} failed: ${err.message}`,
        err.stack,
      );

      const result: OpenAiQueueResult = {
        jobId,
        success: false,
        error: err.message,
        retryCount: job.attemptsMade,
      };

      if (callbackEvent) {
        this.events.emit(`${callbackEvent}.error`, result);
      }

      throw err; // Re-throw so BullMQ handles retry
    }
  }
}
