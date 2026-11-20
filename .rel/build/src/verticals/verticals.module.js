"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerticalsModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const auth_module_js_1 = require("../auth/auth.module.js");
const organization_member_entity_js_1 = require("../auth/entities/organization-member.entity.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const channels_module_js_1 = require("../channels/channels.module.js");
const feature_flag_module_js_1 = require("../common/feature-flags/feature-flag.module.js");
const notifications_module_js_1 = require("../notifications/notifications.module.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const store_entity_js_1 = require("../channels/entities/store.entity.js");
const connected_ebay_account_entity_js_1 = require("../integrations/ebay/entities/connected-ebay-account.entity.js");
const product_family_entity_js_1 = require("./entities/product-family.entity.js");
const product_variant_entity_js_1 = require("./entities/product-variant.entity.js");
const variant_marketplace_mapping_entity_js_1 = require("./entities/variant-marketplace-mapping.entity.js");
const product_marketplace_category_entity_js_1 = require("./entities/product-marketplace-category.entity.js");
const fashion_review_entity_js_1 = require("./entities/fashion-review.entity.js");
const user_store_assignment_entity_js_1 = require("../channels/entities/user-store-assignment.entity.js");
const ebay_listing_channel_entity_js_1 = require("../integrations/ebay/entities/ebay-listing-channel.entity.js");
const business_industrial_review_entity_js_1 = require("./entities/business-industrial-review.entity.js");
const business_industrial_unit_entity_js_1 = require("./entities/business-industrial-unit.entity.js");
const business_industrial_incident_entity_js_1 = require("./entities/business-industrial-incident.entity.js");
const fashion_controller_js_1 = require("./fashion.controller.js");
const fashion_users_service_js_1 = require("./fashion-users.service.js");
const fashion_listings_service_js_1 = require("./fashion-listings.service.js");
const fashion_image_analysis_service_js_1 = require("./fashion-image-analysis.service.js");
const fashion_intake_controller_js_1 = require("./fashion-intake.controller.js");
const fashion_intake_service_js_1 = require("./fashion-intake.service.js");
const fashion_intake_processor_js_1 = require("./fashion-intake.processor.js");
const fashion_intake_images_service_js_1 = require("./fashion-intake-images.service.js");
const fashion_warehouse_entity_js_1 = require("./entities/fashion-warehouse.entity.js");
const fashion_sku_counter_entity_js_1 = require("./entities/fashion-sku-counter.entity.js");
const business_industrial_controller_js_1 = require("./business-industrial.controller.js");
const verticals_controller_js_1 = require("./verticals.controller.js");
const verticals_service_js_1 = require("./verticals.service.js");
const ebay_variant_publishing_service_js_1 = require("./ebay-variant-publishing.service.js");
const business_industrial_service_js_1 = require("./business-industrial.service.js");
const business_industrial_incident_notifications_js_1 = require("./business-industrial-incident-notifications.js");
const business_industrial_users_service_js_1 = require("./business-industrial-users.service.js");
const storage_module_js_1 = require("../storage/storage.module.js");
const openai_module_js_1 = require("../common/openai/openai.module.js");
const business_industrial_image_intake_job_entity_js_1 = require("./entities/business-industrial-image-intake-job.entity.js");
const business_industrial_image_intake_group_entity_js_1 = require("./entities/business-industrial-image-intake-group.entity.js");
const business_industrial_image_intake_asset_entity_js_1 = require("./entities/business-industrial-image-intake-asset.entity.js");
const business_industrial_image_intake_controller_js_1 = require("./business-industrial-image-intake.controller.js");
const business_industrial_image_intake_service_js_1 = require("./business-industrial-image-intake.service.js");
const business_industrial_image_intake_processor_js_1 = require("./business-industrial-image-intake.processor.js");
let VerticalsModule = class VerticalsModule {
};
exports.VerticalsModule = VerticalsModule;
exports.VerticalsModule = VerticalsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_js_1.AuthModule,
            channels_module_js_1.ChannelsModule,
            feature_flag_module_js_1.FeatureFlagModule,
            notifications_module_js_1.NotificationsModule,
            storage_module_js_1.StorageModule,
            openai_module_js_1.OpenAiModule,
            bullmq_1.BullModule.registerQueue({
                name: 'business-industrial-image-intake',
                defaultJobOptions: {
                    removeOnComplete: { count: 50 },
                    removeOnFail: { count: 100 },
                },
            }),
            bullmq_1.BullModule.registerQueue({
                name: fashion_intake_service_js_1.FASHION_INTAKE_QUEUE,
                defaultJobOptions: {
                    removeOnComplete: { count: 200 },
                    removeOnFail: { count: 200 },
                },
            }),
            typeorm_1.TypeOrmModule.forFeature([
                fashion_warehouse_entity_js_1.FashionWarehouse,
                fashion_sku_counter_entity_js_1.FashionSkuCounter,
                store_entity_js_1.Store,
                connected_ebay_account_entity_js_1.ConnectedEbayAccount,
                catalog_product_entity_js_1.CatalogProduct,
                listing_record_entity_js_1.ListingRecord,
                product_family_entity_js_1.ProductFamily,
                product_variant_entity_js_1.ProductVariant,
                variant_marketplace_mapping_entity_js_1.VariantMarketplaceMapping,
                product_marketplace_category_entity_js_1.ProductMarketplaceCategory,
                fashion_review_entity_js_1.FashionReview,
                organization_member_entity_js_1.OrganizationMember,
                user_entity_js_1.User,
                user_store_assignment_entity_js_1.UserStoreAssignment,
                ebay_listing_channel_entity_js_1.EbayListingChannel,
                business_industrial_review_entity_js_1.BusinessIndustrialReview,
                business_industrial_unit_entity_js_1.BusinessIndustrialUnit,
                business_industrial_incident_entity_js_1.BusinessIndustrialIncident,
                business_industrial_image_intake_job_entity_js_1.BusinessIndustrialImageIntakeJob,
                business_industrial_image_intake_group_entity_js_1.BusinessIndustrialImageIntakeGroup,
                business_industrial_image_intake_asset_entity_js_1.BusinessIndustrialImageIntakeAsset,
            ]),
        ],
        controllers: [
            verticals_controller_js_1.VerticalsController,
            fashion_controller_js_1.FashionController,
            fashion_intake_controller_js_1.FashionIntakeController,
            business_industrial_controller_js_1.BusinessIndustrialController,
            business_industrial_image_intake_controller_js_1.BusinessIndustrialImageIntakeController,
        ],
        providers: [
            verticals_service_js_1.VerticalsService,
            ebay_variant_publishing_service_js_1.EbayVariantPublishingService,
            fashion_users_service_js_1.FashionUsersService,
            fashion_listings_service_js_1.FashionListingsService,
            fashion_image_analysis_service_js_1.FashionImageAnalysisService,
            fashion_intake_service_js_1.FashionIntakeService,
            fashion_intake_processor_js_1.FashionIntakeProcessor,
            fashion_intake_images_service_js_1.FashionIntakeImagesService,
            business_industrial_service_js_1.BusinessIndustrialService,
            business_industrial_users_service_js_1.BusinessIndustrialUsersService,
            business_industrial_incident_notifications_js_1.BusinessIndustrialIncidentNotifications,
            business_industrial_image_intake_service_js_1.BusinessIndustrialImageIntakeService,
            business_industrial_image_intake_processor_js_1.BusinessIndustrialImageIntakeProcessor,
        ],
        exports: [
            verticals_service_js_1.VerticalsService,
            ebay_variant_publishing_service_js_1.EbayVariantPublishingService,
            fashion_listings_service_js_1.FashionListingsService,
            fashion_image_analysis_service_js_1.FashionImageAnalysisService,
            business_industrial_service_js_1.BusinessIndustrialService,
        ],
    })
], VerticalsModule);
//# sourceMappingURL=verticals.module.js.map