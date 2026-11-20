"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const channel_connection_entity_js_1 = require("./entities/channel-connection.entity.js");
const channel_listing_entity_js_1 = require("./entities/channel-listing.entity.js");
const channel_webhook_log_entity_js_1 = require("./entities/channel-webhook-log.entity.js");
const store_entity_js_1 = require("./entities/store.entity.js");
const listing_channel_instance_entity_js_1 = require("./entities/listing-channel-instance.entity.js");
const ai_enhancement_entity_js_1 = require("./entities/ai-enhancement.entity.js");
const demo_simulation_log_entity_js_1 = require("./entities/demo-simulation-log.entity.js");
const user_store_assignment_entity_js_1 = require("./entities/user-store-assignment.entity.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const channels_service_js_1 = require("./channels.service.js");
const channels_controller_js_1 = require("./channels.controller.js");
const stores_service_js_1 = require("./stores.service.js");
const stores_controller_js_1 = require("./stores.controller.js");
const ai_enhancement_service_js_1 = require("./ai-enhancement.service.js");
const ai_enhancement_controller_js_1 = require("./ai-enhancement.controller.js");
const token_encryption_service_js_1 = require("./token-encryption.service.js");
const ebay_adapter_js_1 = require("./adapters/ebay/ebay.adapter.js");
const channel_publish_processor_js_1 = require("./processors/channel-publish.processor.js");
const pricing_push_service_js_1 = require("./pricing-push.service.js");
const inventory_realtime_sync_service_js_1 = require("./inventory-realtime-sync.service.js");
const pricing_rule_entity_js_1 = require("../settings/entities/pricing-rule.entity.js");
const store_access_service_js_1 = require("./store-access.service.js");
const store_access_controller_js_1 = require("./store-access.controller.js");
const ebay_category_controller_js_1 = require("./ebay/ebay-category.controller.js");
const feature_flag_module_js_1 = require("../common/feature-flags/feature-flag.module.js");
const ebay_auth_service_js_1 = require("./ebay/ebay-auth.service.js");
const ebay_inventory_api_service_js_1 = require("./ebay/ebay-inventory-api.service.js");
const ebay_taxonomy_api_service_js_1 = require("./ebay/ebay-taxonomy-api.service.js");
const ebay_taxonomy_cache_service_js_1 = require("./ebay/ebay-taxonomy-cache.service.js");
const ebay_selling_metadata_service_js_1 = require("./ebay/ebay-selling-metadata.service.js");
const ebay_fulfillment_api_service_js_1 = require("./ebay/ebay-fulfillment-api.service.js");
const ebay_browse_api_service_js_1 = require("./ebay/ebay-browse-api.service.js");
const ebay_trading_api_service_js_1 = require("./ebay/ebay-trading-api.service.js");
const ebay_media_api_service_js_1 = require("./ebay/ebay-media-api.service.js");
const ebay_compatibility_reconciliation_service_js_1 = require("./ebay/ebay-compatibility-reconciliation.service.js");
const ebay_publish_service_js_1 = require("./ebay/ebay-publish.service.js");
const ebay_publish_controller_js_1 = require("./ebay/ebay-publish.controller.js");
const connected_ebay_account_entity_js_1 = require("../integrations/ebay/entities/connected-ebay-account.entity.js");
const ebay_account_marketplace_entity_js_1 = require("../integrations/ebay/entities/ebay-account-marketplace.entity.js");
const ebay_business_policy_entity_js_1 = require("../integrations/ebay/entities/ebay-business-policy.entity.js");
const shipping_profile_entity_js_1 = require("../settings/entities/shipping-profile.entity.js");
const sellerpundit_module_js_1 = require("../integrations/sellerpundit/sellerpundit.module.js");
const ebay_marketplace_config_service_js_1 = require("../integrations/ebay/services/ebay-marketplace-config.service.js");
const ebay_sell_account_api_service_js_1 = require("../integrations/ebay/services/ebay-sell-account-api.service.js");
const ebay_pa_return_policy_service_js_1 = require("../integrations/ebay/services/ebay-pa-return-policy.service.js");
const ebay_category_keyword_audit_service_js_1 = require("./ebay/ebay-category-keyword-audit.service.js");
const ebay_category_mapping_entity_js_1 = require("../motors-intelligence/entities/ebay-category-mapping.entity.js");
const ebay_category_entity_js_1 = require("../listings/entities/ebay-category.entity.js");
const ebay_hosted_image_entity_js_1 = require("../integrations/ebay/entities/ebay-hosted-image.entity.js");
const ebay_listing_channel_entity_js_1 = require("../integrations/ebay/entities/ebay-listing-channel.entity.js");
const fitment_module_js_1 = require("../fitment/fitment.module.js");
const storage_module_js_1 = require("../storage/storage.module.js");
const partsbazar360_client_js_1 = require("./partsbazar360/partsbazar360.client.js");
const partsbazar360_controller_js_1 = require("./partsbazar360/partsbazar360.controller.js");
const partsbazar360_service_js_1 = require("./partsbazar360/partsbazar360.service.js");
let ChannelsModule = class ChannelsModule {
};
exports.ChannelsModule = ChannelsModule;
exports.ChannelsModule = ChannelsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                channel_connection_entity_js_1.ChannelConnection,
                channel_listing_entity_js_1.ChannelListing,
                channel_webhook_log_entity_js_1.ChannelWebhookLog,
                store_entity_js_1.Store,
                listing_channel_instance_entity_js_1.ListingChannelInstance,
                ai_enhancement_entity_js_1.AiEnhancement,
                demo_simulation_log_entity_js_1.DemoSimulationLog,
                listing_record_entity_js_1.ListingRecord,
                catalog_product_entity_js_1.CatalogProduct,
                pricing_rule_entity_js_1.PricingRule,
                user_store_assignment_entity_js_1.UserStoreAssignment,
                connected_ebay_account_entity_js_1.ConnectedEbayAccount,
                ebay_account_marketplace_entity_js_1.EbayAccountMarketplace,
                ebay_business_policy_entity_js_1.EbayBusinessPolicy,
                shipping_profile_entity_js_1.ShippingProfile,
                ebay_category_mapping_entity_js_1.EbayCategoryMapping,
                ebay_category_entity_js_1.EbayCategory,
                ebay_hosted_image_entity_js_1.EbayHostedImage,
                ebay_listing_channel_entity_js_1.EbayListingChannel,
            ]),
            sellerpundit_module_js_1.SellerpunditModule,
            bullmq_1.BullModule.registerQueue({ name: 'channels' }),
            bullmq_1.BullModule.registerQueue({ name: 'inventory' }),
            feature_flag_module_js_1.FeatureFlagModule,
            (0, common_1.forwardRef)(() => fitment_module_js_1.FitmentModule),
            storage_module_js_1.StorageModule,
        ],
        controllers: [
            channels_controller_js_1.ChannelsController,
            stores_controller_js_1.StoresController,
            ai_enhancement_controller_js_1.AiEnhancementController,
            ebay_publish_controller_js_1.EbayPublishController,
            store_access_controller_js_1.StoreAccessController,
            ebay_category_controller_js_1.EbayCategoryController,
            partsbazar360_controller_js_1.PartsBazar360Controller,
        ],
        providers: [
            channels_service_js_1.ChannelsService,
            stores_service_js_1.StoresService,
            ai_enhancement_service_js_1.AiEnhancementService,
            token_encryption_service_js_1.TokenEncryptionService,
            store_access_service_js_1.StoreAccessService,
            ebay_adapter_js_1.EbayAdapter,
            channel_publish_processor_js_1.ChannelPublishProcessor,
            pricing_push_service_js_1.PricingPushService,
            inventory_realtime_sync_service_js_1.InventoryRealtimeSyncService,
            ebay_auth_service_js_1.EbayAuthService,
            ebay_inventory_api_service_js_1.EbayInventoryApiService,
            ebay_taxonomy_cache_service_js_1.EbayTaxonomyCacheService,
            ebay_selling_metadata_service_js_1.EbaySellingMetadataService,
            ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService,
            ebay_fulfillment_api_service_js_1.EbayFulfillmentApiService,
            ebay_browse_api_service_js_1.EbayBrowseApiService,
            ebay_trading_api_service_js_1.EbayTradingApiService,
            ebay_media_api_service_js_1.EbayMediaApiService,
            ebay_compatibility_reconciliation_service_js_1.EbayCompatibilityReconciliationService,
            ebay_publish_service_js_1.EbayPublishService,
            ebay_marketplace_config_service_js_1.EbayMarketplaceConfigService,
            ebay_sell_account_api_service_js_1.EbaySellAccountApiService,
            ebay_pa_return_policy_service_js_1.EbayPaReturnPolicyService,
            ebay_category_keyword_audit_service_js_1.EbayCategoryKeywordAuditService,
            partsbazar360_client_js_1.PartsBazar360Client,
            partsbazar360_service_js_1.PartsBazar360Service,
        ],
        exports: [
            channels_service_js_1.ChannelsService,
            stores_service_js_1.StoresService,
            ai_enhancement_service_js_1.AiEnhancementService,
            pricing_push_service_js_1.PricingPushService,
            inventory_realtime_sync_service_js_1.InventoryRealtimeSyncService,
            ebay_auth_service_js_1.EbayAuthService,
            ebay_inventory_api_service_js_1.EbayInventoryApiService,
            ebay_taxonomy_cache_service_js_1.EbayTaxonomyCacheService,
            ebay_selling_metadata_service_js_1.EbaySellingMetadataService,
            ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService,
            ebay_fulfillment_api_service_js_1.EbayFulfillmentApiService,
            ebay_browse_api_service_js_1.EbayBrowseApiService,
            ebay_trading_api_service_js_1.EbayTradingApiService,
            ebay_media_api_service_js_1.EbayMediaApiService,
            ebay_compatibility_reconciliation_service_js_1.EbayCompatibilityReconciliationService,
            ebay_publish_service_js_1.EbayPublishService,
            ebay_pa_return_policy_service_js_1.EbayPaReturnPolicyService,
            token_encryption_service_js_1.TokenEncryptionService,
            store_access_service_js_1.StoreAccessService,
            ebay_category_keyword_audit_service_js_1.EbayCategoryKeywordAuditService,
            partsbazar360_service_js_1.PartsBazar360Service,
        ],
    })
], ChannelsModule);
//# sourceMappingURL=channels.module.js.map