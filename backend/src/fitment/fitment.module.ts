import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { FitmentMake } from './entities/fitment-make.entity.js';
import { FitmentModel } from './entities/fitment-model.entity.js';
import { FitmentSubmodel } from './entities/fitment-submodel.entity.js';
import { FitmentYear } from './entities/fitment-year.entity.js';
import { FitmentEngine } from './entities/fitment-engine.entity.js';
import { PartFitment } from './entities/part-fitment.entity.js';
import { VinCache } from './entities/vin-cache.entity.js';
import { FitmentService } from './fitment.service.js';
import { FitmentMatcherService } from './fitment-matcher.service.js';
import { FitmentImportService } from './fitment-import.service.js';
import { FitmentImportProcessor } from './processors/fitment-import.processor.js';
import { FitmentController } from './fitment.controller.js';
import { EbayMvlService } from './ebay-mvl.service.js';
import { VinDecodeService } from './vin-decode.service.js';
import { ChannelsModule } from '../channels/channels.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FitmentMake,
      FitmentModel,
      FitmentSubmodel,
      FitmentYear,
      FitmentEngine,
      PartFitment,
      VinCache,
    ]),
    BullModule.registerQueue({ name: 'fitment' }),
    ChannelsModule,
  ],
  controllers: [FitmentController],
  providers: [
    FitmentService,
    FitmentMatcherService,
    FitmentImportService,
    FitmentImportProcessor,
    EbayMvlService,
    VinDecodeService,
  ],
  exports: [FitmentService, FitmentMatcherService, EbayMvlService, VinDecodeService],
})
export class FitmentModule {}
