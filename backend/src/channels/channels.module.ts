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
import { ChannelPublishProcessor } from './processors/channel-publish.processor.js';
import { PricingPushService } from './pricing-push.service.js';
import { InventoryRealtimeSyncService } from './inventory-realtime-sync.service.js';
import { PricingRule } from '../settings/entities/pricing-rule.entity.js';
import { FeatureFlagModule } from '../common/feature-flags/feature-flag.module.js';
// ── New eBay API service layer ──
import { EbayAuthService } from './ebay/ebay-auth.service.js';
import { EbayInventoryApiService } from './ebay/ebay-inventory-api.service.js';
import { EbayTaxonomyApiService } from './ebay/ebay-taxonomy-api.service.js';
import { EbayFulfillmentApiService } from './ebay/ebay-fulfillment-api.service.js';
import { EbayBrowseApiService } from './ebay/ebay-browse-api.service.js';
import { EbayPublishService } from './ebay/ebay-publish.service.js';
import { EbayPublishController } from './ebay/ebay-publish.controller.js';

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
      PricingRule,
    ]),
    BullModule.registerQueue({ name: 'channels' }),
    BullModule.registerQueue({ name: 'inventory' }),
    FeatureFlagModule,
  ],
  controllers: [ChannelsController, StoresController, AiEnhancementController, EbayPublishController],
  providers: [
    ChannelsService,
    StoresService,
    AiEnhancementService,
    TokenEncryptionService,
    EbayAdapter,
    ChannelPublishProcessor,
    PricingPushService,
    InventoryRealtimeSyncService,
    // ── New eBay API services ──
    EbayAuthService,
    EbayInventoryApiService,
    EbayTaxonomyApiService,
    EbayFulfillmentApiService,
    EbayBrowseApiService,
    EbayPublishService,
  ],
  exports: [
    ChannelsService,
    StoresService,
    AiEnhancementService,
    PricingPushService,
    InventoryRealtimeSyncService,
    // ── Export new eBay services for use by other modules ──
    EbayAuthService,
    EbayInventoryApiService,
    EbayTaxonomyApiService,
    EbayFulfillmentApiService,
    EbayBrowseApiService,
    EbayPublishService,
    TokenEncryptionService,
  ],
})
export class ChannelsModule {}
