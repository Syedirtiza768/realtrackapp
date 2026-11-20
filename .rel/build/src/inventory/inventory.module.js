"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const inventory_ledger_entity_js_1 = require("./entities/inventory-ledger.entity.js");
const inventory_event_entity_js_1 = require("./entities/inventory-event.entity.js");
const store_inventory_allocation_entity_js_1 = require("./entities/store-inventory-allocation.entity.js");
const image_asset_entity_js_1 = require("../storage/entities/image-asset.entity.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const part_fitment_entity_js_1 = require("../fitment/entities/part-fitment.entity.js");
const pipeline_job_entity_js_1 = require("../ingestion/entities/pipeline-job.entity.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const store_entity_js_1 = require("../channels/entities/store.entity.js");
const connected_ebay_account_entity_js_1 = require("../integrations/ebay/entities/connected-ebay-account.entity.js");
const ebay_account_marketplace_entity_js_1 = require("../integrations/ebay/entities/ebay-account-marketplace.entity.js");
const ebay_business_policy_entity_js_1 = require("../integrations/ebay/entities/ebay-business-policy.entity.js");
const ebay_listing_channel_entity_js_1 = require("../integrations/ebay/entities/ebay-listing-channel.entity.js");
const listing_store_override_entity_js_1 = require("../integrations/ebay/entities/listing-store-override.entity.js");
const ebay_category_entity_js_1 = require("../listings/entities/ebay-category.entity.js");
const inventory_service_js_1 = require("./inventory.service.js");
const inventory_workbench_service_js_1 = require("./inventory-workbench.service.js");
const inventory_auto_trigger_service_js_1 = require("./inventory-auto-trigger.service.js");
const inventory_editor_service_js_1 = require("./inventory-editor.service.js");
const inventory_publish_service_js_1 = require("./inventory-publish.service.js");
const enrichment_retry_service_js_1 = require("./enrichment-retry.service.js");
const part_identification_service_js_1 = require("./part-identification.service.js");
const inventory_controller_js_1 = require("./inventory.controller.js");
const inventory_editor_controller_js_1 = require("./inventory-editor.controller.js");
const inventory_sync_processor_js_1 = require("./processors/inventory-sync.processor.js");
const feature_flag_module_js_1 = require("../common/feature-flags/feature-flag.module.js");
const ingestion_module_js_1 = require("../ingestion/ingestion.module.js");
const channels_module_js_1 = require("../channels/channels.module.js");
const ebay_integrations_module_js_1 = require("../integrations/ebay/ebay-integrations.module.js");
const listing_optimization_module_js_1 = require("../listing-optimization/listing-optimization.module.js");
const storage_module_js_1 = require("../storage/storage.module.js");
const fitment_module_js_1 = require("../fitment/fitment.module.js");
const teams_module_js_1 = require("../teams/teams.module.js");
let InventoryModule = class InventoryModule {
};
exports.InventoryModule = InventoryModule;
exports.InventoryModule = InventoryModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                inventory_ledger_entity_js_1.InventoryLedger,
                inventory_event_entity_js_1.InventoryEvent,
                store_inventory_allocation_entity_js_1.StoreInventoryAllocation,
                listing_record_entity_js_1.ListingRecord,
                part_fitment_entity_js_1.PartFitment,
                pipeline_job_entity_js_1.PipelineJob,
                image_asset_entity_js_1.ImageAsset,
                catalog_product_entity_js_1.CatalogProduct,
                store_entity_js_1.Store,
                connected_ebay_account_entity_js_1.ConnectedEbayAccount,
                ebay_account_marketplace_entity_js_1.EbayAccountMarketplace,
                ebay_business_policy_entity_js_1.EbayBusinessPolicy,
                ebay_listing_channel_entity_js_1.EbayListingChannel,
                listing_store_override_entity_js_1.ListingStoreOverride,
                ebay_category_entity_js_1.EbayCategory,
            ]),
            bullmq_1.BullModule.registerQueue({ name: 'inventory' }),
            bullmq_1.BullModule.registerQueue({
                name: 'listing-optimization',
                defaultJobOptions: {
                    removeOnComplete: { count: 50 },
                    removeOnFail: { count: 100 },
                },
            }),
            feature_flag_module_js_1.FeatureFlagModule,
            ingestion_module_js_1.IngestionModule,
            channels_module_js_1.ChannelsModule,
            ebay_integrations_module_js_1.EbayIntegrationsModule,
            listing_optimization_module_js_1.ListingOptimizationModule,
            storage_module_js_1.StorageModule,
            fitment_module_js_1.FitmentModule,
            teams_module_js_1.TeamsModule,
        ],
        controllers: [inventory_controller_js_1.InventoryController, inventory_editor_controller_js_1.InventoryEditorController],
        providers: [
            inventory_service_js_1.InventoryService,
            inventory_workbench_service_js_1.InventoryWorkbenchService,
            inventory_auto_trigger_service_js_1.InventoryAutoTriggerService,
            inventory_editor_service_js_1.InventoryEditorService,
            inventory_publish_service_js_1.InventoryPublishService,
            inventory_sync_processor_js_1.InventorySyncProcessor,
            enrichment_retry_service_js_1.EnrichmentRetryService,
            part_identification_service_js_1.PartIdentificationService,
        ],
        exports: [
            inventory_service_js_1.InventoryService,
            inventory_workbench_service_js_1.InventoryWorkbenchService,
            enrichment_retry_service_js_1.EnrichmentRetryService,
        ],
    })
], InventoryModule);
//# sourceMappingURL=inventory.module.js.map