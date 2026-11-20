"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayIntegrationsModule = void 0;
const verticals_module_js_1 = require("../../verticals/verticals.module.js");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const organization_member_entity_js_1 = require("../../auth/entities/organization-member.entity.js");
const user_entity_js_1 = require("../../auth/entities/user.entity.js");
const catalog_product_entity_js_1 = require("../../catalog-import/entities/catalog-product.entity.js");
const listing_record_entity_js_1 = require("../../listings/listing-record.entity.js");
const image_asset_entity_js_1 = require("../../storage/entities/image-asset.entity.js");
const channel_connection_entity_js_1 = require("../../channels/entities/channel-connection.entity.js");
const store_entity_js_1 = require("../../channels/entities/store.entity.js");
const channels_module_js_1 = require("../../channels/channels.module.js");
const auth_module_js_1 = require("../../auth/auth.module.js");
const orders_module_js_1 = require("../../orders/orders.module.js");
const internal_store_entity_js_1 = require("./entities/internal-store.entity.js");
const connected_ebay_account_entity_js_1 = require("./entities/connected-ebay-account.entity.js");
const ebay_oauth_token_entity_js_1 = require("./entities/ebay-oauth-token.entity.js");
const ebay_account_marketplace_entity_js_1 = require("./entities/ebay-account-marketplace.entity.js");
const ebay_business_policy_entity_js_1 = require("./entities/ebay-business-policy.entity.js");
const listing_store_override_entity_js_1 = require("./entities/listing-store-override.entity.js");
const ebay_listing_channel_entity_js_1 = require("./entities/ebay-listing-channel.entity.js");
const ebay_listing_job_entity_js_1 = require("./entities/ebay-listing-job.entity.js");
const ebay_listing_job_target_entity_js_1 = require("./entities/ebay-listing-job-target.entity.js");
const ebay_api_error_entity_js_1 = require("./entities/ebay-api-error.entity.js");
const listing_action_log_entity_js_1 = require("./entities/listing-action-log.entity.js");
const inventory_movement_entity_js_1 = require("./entities/inventory-movement.entity.js");
const ebay_integrations_redis_connection_js_1 = require("./ebay-integrations-redis.connection.js");
const ebay_oauth_state_store_js_1 = require("./services/ebay-oauth-state.store.js");
const ebay_account_token_service_js_1 = require("./services/ebay-account-token.service.js");
const ebay_integrations_oauth_service_js_1 = require("./services/ebay-integrations-oauth.service.js");
const ebay_integration_permissions_service_js_1 = require("./services/ebay-integration-permissions.service.js");
const ebay_integration_account_service_js_1 = require("./services/ebay-integration-account.service.js");
const ebay_marketplace_config_service_js_1 = require("./services/ebay-marketplace-config.service.js");
const ebay_listing_validation_service_js_1 = require("./services/ebay-listing-validation.service.js");
const listing_builder_service_js_1 = require("./services/listing-builder.service.js");
const catalog_publish_resolver_service_js_1 = require("./services/catalog-publish-resolver.service.js");
const listing_action_log_writer_service_js_1 = require("./services/listing-action-log-writer.service.js");
const ebay_multi_store_listing_service_js_1 = require("./services/ebay-multi-store-listing.service.js");
const ebay_trading_quota_service_js_1 = require("./services/ebay-trading-quota.service.js");
const ebay_policy_sync_service_js_1 = require("./services/ebay-policy-sync.service.js");
const ebay_sell_account_api_service_js_1 = require("./services/ebay-sell-account-api.service.js");
const ebay_listing_publish_processor_js_1 = require("./processors/ebay-listing-publish.processor.js");
const ebay_inventory_sync_processor_js_1 = require("./processors/ebay-inventory-sync.processor.js");
const ebay_order_sync_processor_js_1 = require("./processors/ebay-order-sync.processor.js");
const ebay_api_audit_log_entity_js_1 = require("./entities/ebay-api-audit-log.entity.js");
const ebay_listing_sync_log_entity_js_1 = require("./entities/ebay-listing-sync-log.entity.js");
const ebay_api_audit_service_js_1 = require("./services/ebay-api-audit.service.js");
const ebay_sync_service_js_1 = require("./services/ebay-sync.service.js");
const integrations_ebay_controller_js_1 = require("./controllers/integrations-ebay.controller.js");
const ebay_platform_notifications_controller_js_1 = require("./controllers/ebay-platform-notifications.controller.js");
const ebay_platform_notifications_service_js_1 = require("./services/ebay-platform-notifications.service.js");
const ebay_multi_store_controller_js_1 = require("./controllers/ebay-multi-store.controller.js");
const fashion_ebay_controller_js_1 = require("./controllers/fashion-ebay.controller.js");
const business_industrial_ebay_controller_js_1 = require("./controllers/business-industrial-ebay.controller.js");
const sellerpundit_module_js_1 = require("../sellerpundit/sellerpundit.module.js");
const sellerpundit_ebay_controller_js_1 = require("../sellerpundit/sellerpundit-ebay.controller.js");
const fitment_module_js_1 = require("../../fitment/fitment.module.js");
const storage_module_js_1 = require("../../storage/storage.module.js");
let EbayIntegrationsModule = class EbayIntegrationsModule {
};
exports.EbayIntegrationsModule = EbayIntegrationsModule;
exports.EbayIntegrationsModule = EbayIntegrationsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sellerpundit_module_js_1.SellerpunditModule,
            typeorm_1.TypeOrmModule.forFeature([
                internal_store_entity_js_1.InternalStore,
                connected_ebay_account_entity_js_1.ConnectedEbayAccount,
                ebay_oauth_token_entity_js_1.EbayOAuthToken,
                ebay_account_marketplace_entity_js_1.EbayAccountMarketplace,
                ebay_business_policy_entity_js_1.EbayBusinessPolicy,
                listing_store_override_entity_js_1.ListingStoreOverride,
                ebay_listing_channel_entity_js_1.EbayListingChannel,
                ebay_listing_job_entity_js_1.EbayListingJob,
                ebay_listing_job_target_entity_js_1.EbayListingJobTarget,
                ebay_api_error_entity_js_1.EbayApiError,
                listing_action_log_entity_js_1.ListingActionLog,
                inventory_movement_entity_js_1.InventoryMovement,
                ebay_api_audit_log_entity_js_1.EbayApiAuditLog,
                ebay_listing_sync_log_entity_js_1.EbayListingSyncLog,
                organization_member_entity_js_1.OrganizationMember,
                user_entity_js_1.User,
                catalog_product_entity_js_1.CatalogProduct,
                listing_record_entity_js_1.ListingRecord,
                image_asset_entity_js_1.ImageAsset,
                channel_connection_entity_js_1.ChannelConnection,
                store_entity_js_1.Store,
            ]),
            bullmq_1.BullModule.registerQueue({ name: 'ebay-listing-publish' }, { name: 'ebay-listing-validation' }, { name: 'ebay-listing-revision' }, { name: 'ebay-listing-ending' }, { name: 'ebay-policy-sync' }, { name: 'ebay-order-sync' }, { name: 'ebay-inventory-sync' }),
            channels_module_js_1.ChannelsModule,
            verticals_module_js_1.VerticalsModule,
            auth_module_js_1.AuthModule,
            orders_module_js_1.OrdersModule,
            fitment_module_js_1.FitmentModule,
            storage_module_js_1.StorageModule,
        ],
        controllers: [
            integrations_ebay_controller_js_1.IntegrationsEbayController,
            ebay_multi_store_controller_js_1.EbayMultiStoreController,
            fashion_ebay_controller_js_1.FashionEbayController,
            business_industrial_ebay_controller_js_1.BusinessIndustrialEbayController,
            sellerpundit_ebay_controller_js_1.SellerpunditEbayController,
            ebay_platform_notifications_controller_js_1.EbayPlatformNotificationsController,
        ],
        providers: [
            ebay_integrations_redis_connection_js_1.EbayIntegrationsRedisConnection,
            {
                provide: ebay_integrations_redis_connection_js_1.EBAY_INTEGRATIONS_REDIS,
                useFactory: (c) => c.client,
                inject: [ebay_integrations_redis_connection_js_1.EbayIntegrationsRedisConnection],
            },
            ebay_oauth_state_store_js_1.EbayOAuthStateStore,
            ebay_account_token_service_js_1.EbayAccountTokenService,
            ebay_integrations_oauth_service_js_1.EbayIntegrationsOAuthService,
            ebay_integration_permissions_service_js_1.EbayIntegrationPermissionsService,
            ebay_integration_account_service_js_1.EbayIntegrationAccountService,
            ebay_marketplace_config_service_js_1.EbayMarketplaceConfigService,
            ebay_listing_validation_service_js_1.EbayListingValidationService,
            catalog_publish_resolver_service_js_1.CatalogPublishResolverService,
            listing_builder_service_js_1.ListingBuilderService,
            listing_action_log_writer_service_js_1.ListingActionLogWriterService,
            ebay_multi_store_listing_service_js_1.EbayMultiStoreListingService,
            ebay_trading_quota_service_js_1.EbayTradingQuotaService,
            ebay_policy_sync_service_js_1.EbayPolicySyncService,
            ebay_sell_account_api_service_js_1.EbaySellAccountApiService,
            ebay_listing_publish_processor_js_1.EbayListingPublishProcessor,
            ebay_inventory_sync_processor_js_1.EbayInventorySyncProcessor,
            ebay_order_sync_processor_js_1.EbayOrderSyncProcessor,
            ebay_api_audit_service_js_1.EbayApiAuditService,
            ebay_sync_service_js_1.EbaySyncService,
            ebay_platform_notifications_service_js_1.EbayPlatformNotificationsService,
        ],
        exports: [
            ebay_account_token_service_js_1.EbayAccountTokenService,
            ebay_marketplace_config_service_js_1.EbayMarketplaceConfigService,
            ebay_multi_store_listing_service_js_1.EbayMultiStoreListingService,
            ebay_sync_service_js_1.EbaySyncService,
            ebay_api_audit_service_js_1.EbayApiAuditService,
            listing_action_log_writer_service_js_1.ListingActionLogWriterService,
            ebay_integration_permissions_service_js_1.EbayIntegrationPermissionsService,
            ebay_policy_sync_service_js_1.EbayPolicySyncService,
            listing_builder_service_js_1.ListingBuilderService,
        ],
    })
], EbayIntegrationsModule);
//# sourceMappingURL=ebay-integrations.module.js.map