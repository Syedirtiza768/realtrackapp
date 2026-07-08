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
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { Store } from '../channels/entities/store.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayAccountMarketplace } from '../integrations/ebay/entities/ebay-account-marketplace.entity.js';
import { EbayBusinessPolicy } from '../integrations/ebay/entities/ebay-business-policy.entity.js';
import { EbayListingChannel } from '../integrations/ebay/entities/ebay-listing-channel.entity.js';
import { ListingStoreOverride } from '../integrations/ebay/entities/listing-store-override.entity.js';
import { InventoryService } from './inventory.service.js';
import { InventoryWorkbenchService } from './inventory-workbench.service.js';
import { InventoryAutoTriggerService } from './inventory-auto-trigger.service.js';
import { InventoryEditorService } from './inventory-editor.service.js';
import { InventoryPublishService } from './inventory-publish.service.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryEditorController } from './inventory-editor.controller.js';
import { InventorySyncProcessor } from './processors/inventory-sync.processor.js';
import { FeatureFlagModule } from '../common/feature-flags/feature-flag.module.js';
import { IngestionModule } from '../ingestion/ingestion.module.js';
import { ChannelsModule } from '../channels/channels.module.js';
import { EbayIntegrationsModule } from '../integrations/ebay/ebay-integrations.module.js';

import { ListingOptimizationModule } from '../listing-optimization/listing-optimization.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryLedger,
      InventoryEvent,
      StoreInventoryAllocation,
      ListingRecord,
      PartFitment,
      PipelineJob,
      ImageAsset,
      CatalogProduct,
      Store,
      ConnectedEbayAccount,
      EbayAccountMarketplace,
      EbayBusinessPolicy,
      EbayListingChannel,
      ListingStoreOverride,
    ]),
    BullModule.registerQueue({ name: 'inventory' }),
    FeatureFlagModule,
    IngestionModule,
    ChannelsModule,
    EbayIntegrationsModule,
    ListingOptimizationModule,
  ],
  controllers: [InventoryController, InventoryEditorController],
  providers: [
    InventoryService,
    InventoryWorkbenchService,
    InventoryAutoTriggerService,
    InventoryEditorService,
    InventoryPublishService,
    InventorySyncProcessor,
  ],
  exports: [InventoryService, InventoryWorkbenchService],
})
export class InventoryModule {}
