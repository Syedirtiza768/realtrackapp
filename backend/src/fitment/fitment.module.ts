import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { FitmentMake } from './entities/fitment-make.entity.js';
import { FitmentModel } from './entities/fitment-model.entity.js';
import { FitmentSubmodel } from './entities/fitment-submodel.entity.js';
import { FitmentYear } from './entities/fitment-year.entity.js';
import { FitmentEngine } from './entities/fitment-engine.entity.js';
import { PartFitment } from './entities/part-fitment.entity.js';
import { FitmentService } from './fitment.service.js';
import { FitmentMatcherService } from './fitment-matcher.service.js';
import { FitmentImportService } from './fitment-import.service.js';
import { FitmentImportProcessor } from './processors/fitment-import.processor.js';
import { FitmentController } from './fitment.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FitmentMake,
      FitmentModel,
      FitmentSubmodel,
      FitmentYear,
      FitmentEngine,
      PartFitment,
    ]),
    BullModule.registerQueue({ name: 'fitment' }),
  ],
  controllers: [FitmentController],
  providers: [
    FitmentService,
    FitmentMatcherService,
    FitmentImportService,
    FitmentImportProcessor,
  ],
  exports: [FitmentService, FitmentMatcherService],
})
export class FitmentModule {}
