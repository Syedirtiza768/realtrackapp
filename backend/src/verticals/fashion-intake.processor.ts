import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  FASHION_INTAKE_QUEUE,
  FashionIntakeService,
  type FashionIntakeJob,
} from './fashion-intake.service.js';

/** Background photo identification for Fashion quick-capture drafts. */
@Processor(FASHION_INTAKE_QUEUE, { concurrency: 2 })
export class FashionIntakeProcessor extends WorkerHost {
  constructor(private readonly intake: FashionIntakeService) {
    super();
  }

  async process(job: Job<FashionIntakeJob>) {
    return this.intake.processIdentification(job.data);
  }
}
