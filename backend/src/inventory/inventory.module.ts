import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { InventoryLedger } from './entities/inventory-ledger.entity.js';
import { InventoryEvent } from './entities/inventory-event.entity.js';
import { StoreInventoryAllocation } from './entities/store-inventory-allocation.entity.js';
import { ImageAsset } from '../storage/entities/image-asset.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { PartFitment } from '../fitment/entities/part-fitment.entity.js';
import { PipelineJob } from '../ingestion/entities/pipeline-job.entity.js';
import { InventoryService } from './inventory.service.js';
import { InventoryWorkbenchService } from './inventory-workbench.service.js';
import { InventoryController } from './inventory.controller.js';
import { InventorySyncProcessor } from './processors/inventory-sync.processor.js';
import { FeatureFlagModule } from '../common/feature-flags/feature-flag.module.js';
import { IngestionModule } from '../ingestion/ingestion.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryLedger, InventoryEvent, StoreInventoryAllocation, ListingRecord, PartFitment, PipelineJob, ImageAsset]),
    BullModule.registerQueue({ name: 'inventory' }),
    FeatureFlagModule,
    IngestionModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryWorkbenchService, InventorySyncProcessor],
  exports: [InventoryService, InventoryWorkbenchService],
})
export class InventoryModule {}
