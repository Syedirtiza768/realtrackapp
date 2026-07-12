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
import { UserStoreAssignment } from './entities/user-store-assignment.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
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
import { StoreAccessService } from './store-access.service.js';
import { StoreAccessController } from './store-access.controller.js';
import { EbayCategoryController } from './ebay/ebay-category.controller.js';
import { FeatureFlagModule } from '../common/feature-flags/feature-flag.module.js';
// ── New eBay API service layer ──
import { EbayAuthService } from './ebay/ebay-auth.service.js';
import { EbayInventoryApiService } from './ebay/ebay-inventory-api.service.js';
import { EbayTaxonomyApiService } from './ebay/ebay-taxonomy-api.service.js';
import { EbayTaxonomyCacheService } from './ebay/ebay-taxonomy-cache.service.js';
import { EbayFulfillmentApiService } from './ebay/ebay-fulfillment-api.service.js';
import { EbayBrowseApiService } from './ebay/ebay-browse-api.service.js';
import { EbayTradingApiService } from './ebay/ebay-trading-api.service.js';
import { EbayPublishService } from './ebay/ebay-publish.service.js';
import { EbayPublishController } from './ebay/ebay-publish.controller.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayAccountMarketplace } from '../integrations/ebay/entities/ebay-account-marketplace.entity.js';
import { EbayBusinessPolicy } from '../integrations/ebay/entities/ebay-business-policy.entity.js';
import { ShippingProfile } from '../settings/entities/shipping-profile.entity.js';
import { SellerpunditModule } from '../integrations/sellerpundit/sellerpundit.module.js';
import { EbayMarketplaceConfigService } from '../integrations/ebay/services/ebay-marketplace-config.service.js';
import { EbaySellAccountApiService } from '../integrations/ebay/services/ebay-sell-account-api.service.js';
import { EbayPaReturnPolicyService } from '../integrations/ebay/services/ebay-pa-return-policy.service.js';
import { EbayCategoryKeywordAuditService } from './ebay/ebay-category-keyword-audit.service.js';
import { EbayCategoryMapping } from '../motors-intelligence/entities/ebay-category-mapping.entity.js';

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
      CatalogProduct,
      PricingRule,
      UserStoreAssignment,
      ConnectedEbayAccount,
      EbayAccountMarketplace,
      EbayBusinessPolicy,
      ShippingProfile,
      EbayCategoryMapping,
    ]),
    SellerpunditModule,
    BullModule.registerQueue({ name: 'channels' }),
    BullModule.registerQueue({ name: 'inventory' }),
    FeatureFlagModule,
  ],
  controllers: [
    ChannelsController,
    StoresController,
    AiEnhancementController,
    EbayPublishController,
    StoreAccessController,
    EbayCategoryController,
  ],
  providers: [
    ChannelsService,
    StoresService,
    AiEnhancementService,
    TokenEncryptionService,
    StoreAccessService,
    EbayAdapter,
    ChannelPublishProcessor,
    PricingPushService,
    InventoryRealtimeSyncService,
    // ── New eBay API services ──
    EbayAuthService,
    EbayInventoryApiService,
    EbayTaxonomyCacheService,
    EbayTaxonomyApiService,
    EbayFulfillmentApiService,
    EbayBrowseApiService,
    EbayTradingApiService,
    EbayPublishService,
    EbayMarketplaceConfigService,
    EbaySellAccountApiService,
    EbayPaReturnPolicyService,
    EbayCategoryKeywordAuditService,
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
    EbayTaxonomyCacheService,
    EbayTaxonomyApiService,
    EbayFulfillmentApiService,
    EbayBrowseApiService,
    EbayTradingApiService,
    EbayPublishService,
    EbayPaReturnPolicyService,
    TokenEncryptionService,
    StoreAccessService,
    EbayCategoryKeywordAuditService,
  ],
})
export class ChannelsModule {}
