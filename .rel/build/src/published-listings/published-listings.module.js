"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishedListingsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const channels_module_js_1 = require("../channels/channels.module.js");
const store_entity_js_1 = require("../channels/entities/store.entity.js");
const channel_webhook_log_entity_js_1 = require("../channels/entities/channel-webhook-log.entity.js");
const ebay_integrations_module_js_1 = require("../integrations/ebay/ebay-integrations.module.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const connected_ebay_account_entity_js_1 = require("../integrations/ebay/entities/connected-ebay-account.entity.js");
const ebay_listing_channel_entity_js_1 = require("../integrations/ebay/entities/ebay-listing-channel.entity.js");
const ebay_published_listing_entity_js_1 = require("./entities/ebay-published-listing.entity.js");
const ebay_published_listing_change_entity_js_1 = require("./entities/ebay-published-listing-change.entity.js");
const ebay_published_listing_sync_log_entity_js_1 = require("./entities/ebay-published-listing-sync-log.entity.js");
const ebay_published_listing_bulk_job_entity_js_1 = require("./entities/ebay-published-listing-bulk-job.entity.js");
const ebay_published_listing_bulk_job_item_entity_js_1 = require("./entities/ebay-published-listing-bulk-job-item.entity.js");
const ebay_published_listing_revision_entity_js_1 = require("./entities/ebay-published-listing-revision.entity.js");
const published_listings_controller_js_1 = require("./published-listings.controller.js");
const store_published_listings_controller_js_1 = require("./store-published-listings.controller.js");
const published_listings_service_js_1 = require("./services/published-listings.service.js");
const published_listings_sync_service_js_1 = require("./services/published-listings-sync.service.js");
const published_listings_action_service_js_1 = require("./services/published-listings-action.service.js");
const published_listings_bulk_service_js_1 = require("./services/published-listings-bulk.service.js");
const published_listings_health_service_js_1 = require("./services/published-listings-health.service.js");
const published_listings_audit_service_js_1 = require("./services/published-listings-audit.service.js");
const published_listings_sync_processor_js_1 = require("./processors/published-listings-sync.processor.js");
const published_listings_bulk_processor_js_1 = require("./processors/published-listings-bulk.processor.js");
const published_listings_pricing_service_js_1 = require("./services/published-listings-pricing.service.js");
const published_listings_scheduler_service_js_1 = require("./services/published-listings-scheduler.service.js");
const published_listings_enrichment_service_js_1 = require("./services/published-listings-enrichment.service.js");
const published_listings_trading_enrichment_service_js_1 = require("./services/published-listings-trading-enrichment.service.js");
const primemotive_listing_changes_service_js_1 = require("./services/primemotive-listing-changes.service.js");
const primemotive_listing_simulator_service_js_1 = require("./services/primemotive-listing-simulator.service.js");
const ebay_listing_page_scrape_service_js_1 = require("../channels/ebay/ebay-listing-page-scrape.service.js");
const scheduler_module_js_1 = require("../common/scheduler/scheduler.module.js");
let PublishedListingsModule = class PublishedListingsModule {
};
exports.PublishedListingsModule = PublishedListingsModule;
exports.PublishedListingsModule = PublishedListingsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                ebay_published_listing_entity_js_1.EbayPublishedListing,
                ebay_published_listing_change_entity_js_1.EbayPublishedListingChange,
                catalog_product_entity_js_1.CatalogProduct,
                channel_webhook_log_entity_js_1.ChannelWebhookLog,
                ebay_published_listing_sync_log_entity_js_1.EbayPublishedListingSyncLog,
                ebay_published_listing_bulk_job_entity_js_1.EbayPublishedListingBulkJob,
                ebay_published_listing_bulk_job_item_entity_js_1.EbayPublishedListingBulkJobItem,
                ebay_published_listing_revision_entity_js_1.EbayPublishedListingRevision,
                connected_ebay_account_entity_js_1.ConnectedEbayAccount,
                ebay_listing_channel_entity_js_1.EbayListingChannel,
                user_entity_js_1.User,
                store_entity_js_1.Store,
            ]),
            bullmq_1.BullModule.registerQueue({ name: 'published-listings-sync' }, { name: 'published-listings-bulk' }),
            channels_module_js_1.ChannelsModule,
            ebay_integrations_module_js_1.EbayIntegrationsModule,
            scheduler_module_js_1.SchedulerModule,
        ],
        controllers: [published_listings_controller_js_1.PublishedListingsController, store_published_listings_controller_js_1.StorePublishedListingsController],
        providers: [
            published_listings_service_js_1.PublishedListingsService,
            published_listings_sync_service_js_1.PublishedListingsSyncService,
            published_listings_action_service_js_1.PublishedListingsActionService,
            published_listings_bulk_service_js_1.PublishedListingsBulkService,
            published_listings_health_service_js_1.PublishedListingsHealthService,
            published_listings_enrichment_service_js_1.PublishedListingsEnrichmentService,
            published_listings_trading_enrichment_service_js_1.PublishedListingsTradingEnrichmentService,
            ebay_listing_page_scrape_service_js_1.EbayListingPageScrapeService,
            published_listings_audit_service_js_1.PublishedListingsAuditService,
            published_listings_pricing_service_js_1.PublishedListingsPricingService,
            published_listings_sync_processor_js_1.PublishedListingsSyncProcessor,
            published_listings_bulk_processor_js_1.PublishedListingsBulkProcessor,
            published_listings_scheduler_service_js_1.PublishedListingsSchedulerService,
            primemotive_listing_changes_service_js_1.PrimemotiveListingChangesService,
            primemotive_listing_simulator_service_js_1.PrimemotiveListingSimulatorService,
        ],
        exports: [published_listings_sync_service_js_1.PublishedListingsSyncService, published_listings_service_js_1.PublishedListingsService],
    })
], PublishedListingsModule);
//# sourceMappingURL=published-listings.module.js.map