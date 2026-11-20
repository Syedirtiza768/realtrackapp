"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FashionBatchPublishModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const auth_module_js_1 = require("../auth/auth.module.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const channels_module_js_1 = require("../channels/channels.module.js");
const openai_module_js_1 = require("../common/openai/openai.module.js");
const ebay_integrations_module_js_1 = require("../integrations/ebay/ebay-integrations.module.js");
const ebay_hosted_image_entity_js_1 = require("../integrations/ebay/entities/ebay-hosted-image.entity.js");
const ebay_listing_job_target_entity_js_1 = require("../integrations/ebay/entities/ebay-listing-job-target.entity.js");
const listing_action_log_entity_js_1 = require("../integrations/ebay/entities/listing-action-log.entity.js");
const rbac_module_js_1 = require("../rbac/rbac.module.js");
const storage_module_js_1 = require("../storage/storage.module.js");
const verticals_module_js_1 = require("../verticals/verticals.module.js");
const fashion_publish_entities_js_1 = require("./entities/fashion-publish.entities.js");
const fashion_batch_publish_controller_js_1 = require("./fashion-batch-publish.controller.js");
const fashion_batch_publish_processor_js_1 = require("./fashion-batch-publish.processor.js");
const fashion_batch_publish_service_js_1 = require("./fashion-batch-publish.service.js");
const fashion_image_pipeline_service_js_1 = require("./fashion-image-pipeline.service.js");
const fashion_vision_check_service_js_1 = require("./fashion-vision-check.service.js");
let FashionBatchPublishModule = class FashionBatchPublishModule {
};
exports.FashionBatchPublishModule = FashionBatchPublishModule;
exports.FashionBatchPublishModule = FashionBatchPublishModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_js_1.AuthModule,
            channels_module_js_1.ChannelsModule,
            ebay_integrations_module_js_1.EbayIntegrationsModule,
            openai_module_js_1.OpenAiModule,
            rbac_module_js_1.RbacModule,
            storage_module_js_1.StorageModule,
            verticals_module_js_1.VerticalsModule,
            bullmq_1.BullModule.registerQueue({
                name: fashion_batch_publish_service_js_1.FASHION_BATCH_QUEUE,
                defaultJobOptions: {
                    attempts: 1,
                    removeOnComplete: { count: 1000 },
                    removeOnFail: { count: 1000 },
                },
            }),
            typeorm_1.TypeOrmModule.forFeature([
                fashion_publish_entities_js_1.FashionListingPipeline,
                fashion_publish_entities_js_1.FashionPublishBatch,
                fashion_publish_entities_js_1.FashionPublishBatchItem,
                fashion_publish_entities_js_1.FashionComplianceConfigRow,
                catalog_product_entity_js_1.CatalogProduct,
                listing_action_log_entity_js_1.ListingActionLog,
                ebay_listing_job_target_entity_js_1.EbayListingJobTarget,
                ebay_hosted_image_entity_js_1.EbayHostedImage,
                user_entity_js_1.User,
            ]),
        ],
        controllers: [fashion_batch_publish_controller_js_1.FashionBatchPublishController],
        providers: [
            fashion_batch_publish_service_js_1.FashionBatchPublishService,
            fashion_batch_publish_processor_js_1.FashionBatchPublishProcessor,
            fashion_image_pipeline_service_js_1.FashionImagePipelineService,
            fashion_vision_check_service_js_1.FashionVisionCheckService,
        ],
    })
], FashionBatchPublishModule);
//# sourceMappingURL=fashion-batch-publish.module.js.map