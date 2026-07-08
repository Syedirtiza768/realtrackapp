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
import { EbayMvlRelease } from './entities/ebay-mvl-release.entity.js';
import { EbayMvlEntry } from './entities/ebay-mvl-entry.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { FitmentService } from './fitment.service.js';
import { FitmentMatcherService } from './fitment-matcher.service.js';
import { FitmentImportService } from './fitment-import.service.js';
import { FitmentImportProcessor } from './processors/fitment-import.processor.js';
import { FitmentController } from './fitment.controller.js';
import { EbayMvlService } from './ebay-mvl.service.js';
import { EbayMvlStoreService } from './ebay-mvl-store.service.js';
import { EbayMvlImportService } from './ebay-mvl-import.service.js';
import { VinDecodeService } from './vin-decode.service.js';
import { MvlFitmentExpanderService } from './mvl-fitment-expander.service.js';
import { VinExportService } from './vin-export.service.js';
import { VinDbExportService } from './vin-db-export.service.js';
import { EbayVinSearchService } from './ebay-vin-search.service.js';
import { BrandVinDecoderRegistry } from './vin-decoders/brand-decoder.registry.js';
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
      ListingRecord,
      EbayMvlRelease,
      EbayMvlEntry,
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
    EbayMvlStoreService,
    EbayMvlImportService,
    MvlFitmentExpanderService,
    VinDecodeService,
    VinExportService,
    VinDbExportService,
    EbayVinSearchService,
    BrandVinDecoderRegistry,
  ],
  exports: [
    FitmentService,
    FitmentMatcherService,
    EbayMvlService,
    EbayMvlStoreService,
    EbayMvlImportService,
    MvlFitmentExpanderService,
    VinDecodeService,
    VinExportService,
    VinDbExportService,
    EbayVinSearchService,
    BrandVinDecoderRegistry,
  ],
})
export class FitmentModule {}
