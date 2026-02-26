import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { FitmentMake } from './entities/fitment-make.entity.js';
import { FitmentModel } from './entities/fitment-model.entity.js';
import { FitmentSubmodel } from './entities/fitment-submodel.entity.js';
import { FitmentYear } from './entities/fitment-year.entity.js';
import { FitmentEngine } from './entities/fitment-engine.entity.js';

export interface AcesVehicleRow {
  makeId?: number;
  makeName: string;
  modelName: string;
  submodelName?: string;
  yearStart: number;
  yearEnd: number;
  engineCode?: string;
  displacementL?: number;
  cylinders?: number;
  fuelType?: string;
  aspiration?: string;
}

@Injectable()
export class FitmentImportService {
  private readonly logger = new Logger(FitmentImportService.name);

  constructor(
    @InjectRepository(FitmentMake)
    private readonly makeRepo: Repository<FitmentMake>,
    @InjectRepository(FitmentModel)
    private readonly modelRepo: Repository<FitmentModel>,
    @InjectRepository(FitmentSubmodel)
    private readonly submodelRepo: Repository<FitmentSubmodel>,
    @InjectRepository(FitmentYear)
    private readonly yearRepo: Repository<FitmentYear>,
    @InjectRepository(FitmentEngine)
    private readonly engineRepo: Repository<FitmentEngine>,
    @InjectQueue('fitment')
    private readonly fitmentQueue: Queue,
  ) {}

  /**
   * Enqueue a bulk import of ACES reference data.
   * Accepts an array of vehicle rows parsed from ACES XML/CSV.
   */
  async enqueueBulkImport(
    rows: AcesVehicleRow[],
    userId?: string,
  ): Promise<{ jobId: string; rowCount: number }> {
    const job = await this.fitmentQueue.add(
      'aces-import',
      { rows, userId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    this.logger.log(`Enqueued ACES import job ${job.id} with ${rows.length} rows`);
    return { jobId: job.id!, rowCount: rows.length };
  }

  /**
   * Process a batch of ACES vehicle rows, creating reference data.
   * Called by the BullMQ processor.
   */
  async processImportBatch(rows: AcesVehicleRow[]): Promise<{
    makesCreated: number;
    modelsCreated: number;
    submodelsCreated: number;
    yearsCreated: number;
    enginesCreated: number;
  }> {
    let makesCreated = 0;
    let modelsCreated = 0;
    let submodelsCreated = 0;
    let yearsCreated = 0;
    let enginesCreated = 0;

    for (const row of rows) {
      // 1. Upsert make
      const makeSlug = this.slugify(row.makeName);
      let make = await this.makeRepo.findOne({ where: { slug: makeSlug } });
      if (!make) {
        make = await this.makeRepo.save(
          this.makeRepo.create({ name: row.makeName, slug: makeSlug }),
        );
        makesCreated++;
      }

      // 2. Upsert model
      const modelSlug = this.slugify(row.modelName);
      let model = await this.modelRepo.findOne({
        where: { makeId: make.id, slug: modelSlug },
      });
      if (!model) {
        model = await this.modelRepo.save(
          this.modelRepo.create({ makeId: make.id, name: row.modelName, slug: modelSlug }),
        );
        modelsCreated++;
      }

      // 3. Upsert submodel
      if (row.submodelName) {
        const existing = await this.submodelRepo.findOne({
          where: { modelId: model.id, name: row.submodelName },
        });
        if (!existing) {
          await this.submodelRepo.save(
            this.submodelRepo.create({ modelId: model.id, name: row.submodelName }),
          );
          submodelsCreated++;
        }
      }

      // 4. Upsert years
      for (let y = row.yearStart; y <= row.yearEnd; y++) {
        const existingYear = await this.yearRepo.findOne({ where: { year: y } });
        if (!existingYear) {
          await this.yearRepo.save(this.yearRepo.create({ year: y }));
          yearsCreated++;
        }
      }

      // 5. Upsert engine
      if (row.engineCode) {
        const existing = await this.engineRepo.findOne({ where: { code: row.engineCode } });
        if (!existing) {
          await this.engineRepo.save(
            this.engineRepo.create({
              code: row.engineCode,
              displacementL: row.displacementL ?? null,
              cylinders: row.cylinders ?? null,
              fuelType: row.fuelType ?? null,
              aspiration: row.aspiration ?? null,
            }),
          );
          enginesCreated++;
        }
      }
    }

    this.logger.log(
      `Import batch: ${makesCreated} makes, ${modelsCreated} models, ` +
        `${submodelsCreated} submodels, ${yearsCreated} years, ${enginesCreated} engines`,
    );

    return { makesCreated, modelsCreated, submodelsCreated, yearsCreated, enginesCreated };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
