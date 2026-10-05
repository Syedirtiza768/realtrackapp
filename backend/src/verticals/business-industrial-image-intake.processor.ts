import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { BusinessIndustrialImageIntakeService } from './business-industrial-image-intake.service.js';

@Processor('business-industrial-image-intake', { concurrency: 1 })
export class BusinessIndustrialImageIntakeProcessor extends WorkerHost {
  constructor(private readonly intake: BusinessIndustrialImageIntakeService) {
    super();
  }
  async process(
    job: Job<{
      jobId: string;
      maxItems?: number;
      autoCreateDrafts?: boolean;
      skipFolderNames?: string[];
    }>,
  ) {
    if (job.name === 'import-drive')
      await this.intake.processDriveJob(
        job.data.jobId,
        job.data.maxItems ?? 20,
        job.data.autoCreateDrafts ?? true,
        job.data.skipFolderNames ?? [],
      );
    else await this.intake.processJob(job.data.jobId);
    return { jobId: job.data.jobId };
  }
}
