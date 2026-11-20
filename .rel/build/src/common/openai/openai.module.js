"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const openai_service_js_1 = require("./openai.service.js");
const openai_queue_service_js_1 = require("./openai-queue.service.js");
const enrichment_pipeline_js_1 = require("./pipelines/enrichment.pipeline.js");
const vision_enrichment_pipeline_js_1 = require("./pipelines/vision-enrichment.pipeline.js");
const listing_generation_pipeline_js_1 = require("./pipelines/listing-generation.pipeline.js");
const title_position_part_name_pipeline_js_1 = require("./pipelines/title-position-part-name.pipeline.js");
const competitive_analysis_pipeline_js_1 = require("./pipelines/competitive-analysis.pipeline.js");
const cross_reference_pipeline_js_1 = require("./pipelines/cross-reference.pipeline.js");
const pricing_analysis_pipeline_js_1 = require("./pipelines/pricing-analysis.pipeline.js");
const cross_reference_entity_js_1 = require("../../listings/entities/cross-reference.entity.js");
const ai_run_log_entity_js_1 = require("./entities/ai-run-log.entity.js");
const ai_routing_policy_history_entity_js_1 = require("./entities/ai-routing-policy-history.entity.js");
const compliance_audit_log_entity_js_1 = require("../../catalog-import/entities/compliance-audit-log.entity.js");
const model_router_js_1 = require("./model-router.js");
const listing_quality_validator_js_1 = require("./listing-quality.validator.js");
const ai_run_log_service_js_1 = require("./ai-run-log.service.js");
const ai_optimizer_service_js_1 = require("./ai-optimizer.service.js");
const listing_guard_audit_service_js_1 = require("./listing-guard-audit.service.js");
const ai_routing_controller_js_1 = require("./ai-routing.controller.js");
const ebay_taxonomy_truth_service_js_1 = require("./ebay-taxonomy-truth.service.js");
const enrichment_cache_service_js_1 = require("./enrichment-cache.service.js");
const ebay_category_entity_js_1 = require("../../listings/entities/ebay-category.entity.js");
let OpenAiModule = class OpenAiModule {
};
exports.OpenAiModule = OpenAiModule;
exports.OpenAiModule = OpenAiModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            bullmq_1.BullModule.registerQueue({ name: 'openai' }),
            typeorm_1.TypeOrmModule.forFeature([
                cross_reference_entity_js_1.CrossReference,
                ai_run_log_entity_js_1.AiRunLog,
                ai_routing_policy_history_entity_js_1.AiRoutingPolicyHistory,
                compliance_audit_log_entity_js_1.ComplianceAuditLog,
                ebay_category_entity_js_1.EbayCategory,
            ]),
        ],
        controllers: [ai_routing_controller_js_1.AiRoutingController],
        providers: [
            openai_service_js_1.OpenAiService,
            openai_queue_service_js_1.OpenAiQueueService,
            openai_queue_service_js_1.OpenAiQueueProcessor,
            model_router_js_1.ModelRouter,
            listing_quality_validator_js_1.ListingQualityValidator,
            ai_run_log_service_js_1.AiRunLogService,
            ai_optimizer_service_js_1.AiOptimizerService,
            listing_guard_audit_service_js_1.ListingGuardAuditService,
            ebay_taxonomy_truth_service_js_1.EbayTaxonomyTruthService,
            enrichment_cache_service_js_1.EnrichmentCacheService,
            enrichment_pipeline_js_1.EnrichmentPipeline,
            vision_enrichment_pipeline_js_1.VisionEnrichmentPipeline,
            listing_generation_pipeline_js_1.ListingGenerationPipeline,
            title_position_part_name_pipeline_js_1.TitlePositionPartNamePipeline,
            competitive_analysis_pipeline_js_1.CompetitiveAnalysisPipeline,
            cross_reference_pipeline_js_1.CrossReferencePipeline,
            pricing_analysis_pipeline_js_1.PricingAnalysisPipeline,
        ],
        exports: [
            openai_service_js_1.OpenAiService,
            openai_queue_service_js_1.OpenAiQueueService,
            model_router_js_1.ModelRouter,
            listing_quality_validator_js_1.ListingQualityValidator,
            ai_run_log_service_js_1.AiRunLogService,
            ai_optimizer_service_js_1.AiOptimizerService,
            enrichment_cache_service_js_1.EnrichmentCacheService,
            enrichment_pipeline_js_1.EnrichmentPipeline,
            vision_enrichment_pipeline_js_1.VisionEnrichmentPipeline,
            listing_generation_pipeline_js_1.ListingGenerationPipeline,
            title_position_part_name_pipeline_js_1.TitlePositionPartNamePipeline,
            competitive_analysis_pipeline_js_1.CompetitiveAnalysisPipeline,
            cross_reference_pipeline_js_1.CrossReferencePipeline,
            pricing_analysis_pipeline_js_1.PricingAnalysisPipeline,
        ],
    })
], OpenAiModule);
//# sourceMappingURL=openai.module.js.map