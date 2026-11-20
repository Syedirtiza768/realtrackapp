"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const rbac_module_js_1 = require("../rbac/rbac.module.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const ingestion_job_entity_js_1 = require("./entities/ingestion-job.entity.js");
const ai_result_entity_js_1 = require("./entities/ai-result.entity.js");
const image_asset_entity_js_1 = require("../storage/entities/image-asset.entity.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const pipeline_job_entity_js_1 = require("./entities/pipeline-job.entity.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const ingestion_controller_js_1 = require("./ingestion.controller.js");
const ingestion_service_js_1 = require("./ingestion.service.js");
const ingestion_processor_js_1 = require("./processors/ingestion.processor.js");
const pipeline_controller_js_1 = require("./pipeline.controller.js");
const pipeline_service_js_1 = require("./pipeline.service.js");
const pipeline_processor_js_1 = require("./processors/pipeline.processor.js");
const ai_module_js_1 = require("./ai/ai.module.js");
const storage_module_js_1 = require("../storage/storage.module.js");
const feature_flag_module_js_1 = require("../common/feature-flags/feature-flag.module.js");
const review_controller_js_1 = require("./review/review.controller.js");
const review_service_js_1 = require("./review/review.service.js");
const image_enrichment_controller_js_1 = require("./image-enrichment/image-enrichment.controller.js");
const image_enrichment_service_js_1 = require("./image-enrichment/image-enrichment.service.js");
const image_search_service_js_1 = require("./image-enrichment/image-search.service.js");
const image_optimizer_service_js_1 = require("./image-enrichment/image-optimizer.service.js");
const openai_module_js_1 = require("../common/openai/openai.module.js");
const channels_module_js_1 = require("../channels/channels.module.js");
const listing_optimization_module_js_1 = require("../listing-optimization/listing-optimization.module.js");
const heavy_job_limiter_module_js_1 = require("../common/jobs/heavy-job-limiter.module.js");
const fitment_module_js_1 = require("../fitment/fitment.module.js");
const pipeline_output_image_service_js_1 = require("./services/pipeline-output-image.service.js");
const single_listing_form_service_js_1 = require("./services/single-listing-form.service.js");
const teams_module_js_1 = require("../teams/teams.module.js");
let IngestionModule = class IngestionModule {
};
exports.IngestionModule = IngestionModule;
exports.IngestionModule = IngestionModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                ingestion_job_entity_js_1.IngestionJob,
                ai_result_entity_js_1.AiResult,
                image_asset_entity_js_1.ImageAsset,
                listing_record_entity_js_1.ListingRecord,
                pipeline_job_entity_js_1.PipelineJob,
                catalog_product_entity_js_1.CatalogProduct,
                user_entity_js_1.User,
            ]),
            rbac_module_js_1.RbacModule,
            bullmq_1.BullModule.registerQueue({ name: 'ingestion' }),
            bullmq_1.BullModule.registerQueue({ name: 'pipeline' }),
            bullmq_1.BullModule.registerQueue({
                name: 'listing-optimization',
                defaultJobOptions: {
                    removeOnComplete: { count: 50 },
                    removeOnFail: { count: 100 },
                },
            }),
            listing_optimization_module_js_1.ListingOptimizationModule,
            fitment_module_js_1.FitmentModule,
            ai_module_js_1.AiModule,
            storage_module_js_1.StorageModule,
            feature_flag_module_js_1.FeatureFlagModule,
            openai_module_js_1.OpenAiModule,
            channels_module_js_1.ChannelsModule,
            heavy_job_limiter_module_js_1.HeavyJobLimiterModule,
            teams_module_js_1.TeamsModule,
        ],
        controllers: [
            ingestion_controller_js_1.IngestionController,
            review_controller_js_1.ReviewController,
            pipeline_controller_js_1.PipelineController,
            image_enrichment_controller_js_1.ImageEnrichmentController,
        ],
        providers: [
            ingestion_service_js_1.IngestionService,
            ingestion_processor_js_1.IngestionProcessor,
            review_service_js_1.ReviewService,
            pipeline_service_js_1.PipelineService,
            pipeline_processor_js_1.PipelineProcessor,
            image_enrichment_service_js_1.ImageEnrichmentService,
            image_search_service_js_1.ImageSearchService,
            image_optimizer_service_js_1.ImageOptimizerService,
            pipeline_output_image_service_js_1.PipelineOutputImageService,
            single_listing_form_service_js_1.SingleListingFormService,
        ],
        exports: [
            ingestion_service_js_1.IngestionService,
            pipeline_service_js_1.PipelineService,
            image_enrichment_service_js_1.ImageEnrichmentService,
            listing_optimization_module_js_1.ListingOptimizationModule,
            single_listing_form_service_js_1.SingleListingFormService,
        ],
    })
], IngestionModule);
//# sourceMappingURL=ingestion.module.js.map