import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ChannelConnection } from './entities/channel-connection.entity.js';
import { ChannelListing } from './entities/channel-listing.entity.js';
import { ChannelWebhookLog } from './entities/channel-webhook-log.entity.js';
import { Store } from './entities/store.entity.js';
import { ListingChannelInstance } from './entities/listing-channel-instance.entity.js';
import { AiEnhancement } from './entities/ai-enhancement.entity.js';
import { DemoSimulationLog } from './entities/demo-simulation-log.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { ChannelsService } from './channels.service.js';
import { ChannelsController } from './channels.controller.js';
import { StoresService } from './stores.service.js';
import { StoresController } from './stores.controller.js';
import { AiEnhancementService } from './ai-enhancement.service.js';
import { AiEnhancementController } from './ai-enhancement.controller.js';
import { TokenEncryptionService } from './token-encryption.service.js';
import { EbayAdapter } from './adapters/ebay/ebay.adapter.js';
import { ShopifyAdapter } from './adapters/shopify/shopify.adapter.js';
import { ChannelPublishProcessor } from './processors/channel-publish.processor.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChannelConnection,
      ChannelListing,
      ChannelWebhookLog,
      Store,
      ListingChannelInstance,
      AiEnhancement,
      DemoSimulationLog,
      ListingRecord,
    ]),
    BullModule.registerQueue({ name: 'channels' }),
  ],
  controllers: [ChannelsController, StoresController, AiEnhancementController],
  providers: [
    ChannelsService,
    StoresService,
    AiEnhancementService,
    TokenEncryptionService,
    EbayAdapter,
    ShopifyAdapter,
    ChannelPublishProcessor,
  ],
  exports: [ChannelsService, StoresService, AiEnhancementService],
})
export class ChannelsModule {}
