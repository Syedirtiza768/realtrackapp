import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  FASHION_BATCH_QUEUE,
  FashionBatchPublishService,
  type FashionBatchJob,
} from './fashion-batch-publish.service.js';

/**
 * Fashion batch worker. Concurrency is kept low: each item downloads photos,
 * renders variants with sharp and makes one vision call; the eBay publish
 * itself runs on the existing listing-publish queue with its own rate guard.
 * Per-item errors are caught inside the service so one bad listing never
 * stops the batch.
 */
@Processor(FASHION_BATCH_QUEUE, {
  concurrency: Number(process.env.FASHION_BATCH_CONCURRENCY ?? 3),
})
export class FashionBatchPublishProcessor extends WorkerHost {
  constructor(private readonly batches: FashionBatchPublishService) {
    super();
  }

  async process(job: Job<FashionBatchJob>) {
    if (job.data.kind === 'sync')
      return this.batches.syncItem(job.data.itemId, job.data.attempt);
    return this.batches.processItem(job.data.itemId);
  }
}
