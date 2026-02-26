import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FitmentImportService, type AcesVehicleRow } from '../fitment-import.service.js';

@Processor('fitment', { concurrency: 1 })
export class FitmentImportProcessor extends WorkerHost {
  private readonly logger = new Logger(FitmentImportProcessor.name);
  private static readonly BATCH_SIZE = 1000;

  constructor(private readonly importService: FitmentImportService) {
    super();
  }

  async process(job: Job<{ rows: AcesVehicleRow[]; userId?: string }>): Promise<void> {
    const { rows } = job.data;
    this.logger.log(`Processing ACES import job ${job.id}: ${rows.length} rows`);

    const totalBatches = Math.ceil(rows.length / FitmentImportProcessor.BATCH_SIZE);
    let totalMakes = 0;
    let totalModels = 0;
    let totalSubmodels = 0;
    let totalYears = 0;
    let totalEngines = 0;

    for (let i = 0; i < totalBatches; i++) {
      const start = i * FitmentImportProcessor.BATCH_SIZE;
      const batch = rows.slice(start, start + FitmentImportProcessor.BATCH_SIZE);

      const result = await this.importService.processImportBatch(batch);
      totalMakes += result.makesCreated;
      totalModels += result.modelsCreated;
      totalSubmodels += result.submodelsCreated;
      totalYears += result.yearsCreated;
      totalEngines += result.enginesCreated;

      await job.updateProgress(Math.round(((i + 1) / totalBatches) * 100));
    }

    this.logger.log(
      `ACES import complete: ${totalMakes} makes, ${totalModels} models, ` +
        `${totalSubmodels} submodels, ${totalYears} years, ${totalEngines} engines`,
    );
  }
}
