"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingOptimizationModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const pipeline_job_entity_js_1 = require("../ingestion/entities/pipeline-job.entity.js");
const ebay_category_mapping_entity_js_1 = require("../motors-intelligence/entities/ebay-category-mapping.entity.js");
const fitment_module_js_1 = require("../fitment/fitment.module.js");
const channels_module_js_1 = require("../channels/channels.module.js");
const openai_module_js_1 = require("../common/openai/openai.module.js");
const enterprise_listing_intelligence_service_js_1 = require("../ingestion/enterprise-listing-intelligence.service.js");
const fitment_discovery_service_js_1 = require("./fitment-discovery.service.js");
const listing_optimization_service_js_1 = require("./listing-optimization.service.js");
const listing_optimization_processor_js_1 = require("./processors/listing-optimization.processor.js");
const title_verification_service_js_1 = require("./title-verification/title-verification.service.js");
const ebay_fitment_publish_service_js_1 = require("./ebay-fitment-publish.service.js");
const oem_fitment_lookup_service_js_1 = require("./oem-fitment-lookup.service.js");
let ListingOptimizationModule = class ListingOptimizationModule {
};
exports.ListingOptimizationModule = ListingOptimizationModule;
exports.ListingOptimizationModule = ListingOptimizationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                catalog_product_entity_js_1.CatalogProduct,
                listing_record_entity_js_1.ListingRecord,
                pipeline_job_entity_js_1.PipelineJob,
                ebay_category_mapping_entity_js_1.EbayCategoryMapping,
            ]),
            bullmq_1.BullModule.registerQueue({
                name: 'listing-optimization',
                defaultJobOptions: {
                    removeOnComplete: { count: 50 },
                    removeOnFail: { count: 100 },
                },
            }),
            fitment_module_js_1.FitmentModule,
            channels_module_js_1.ChannelsModule,
            openai_module_js_1.OpenAiModule,
        ],
        providers: [
            fitment_discovery_service_js_1.FitmentDiscoveryService,
            oem_fitment_lookup_service_js_1.OemFitmentLookupService,
            listing_optimization_service_js_1.ListingOptimizationService,
            listing_optimization_processor_js_1.ListingOptimizationProcessor,
            enterprise_listing_intelligence_service_js_1.EnterpriseListingIntelligenceService,
            title_verification_service_js_1.TitleVerificationService,
            ebay_fitment_publish_service_js_1.EbayFitmentPublishService,
        ],
        exports: [
            listing_optimization_service_js_1.ListingOptimizationService,
            enterprise_listing_intelligence_service_js_1.EnterpriseListingIntelligenceService,
            fitment_discovery_service_js_1.FitmentDiscoveryService,
            title_verification_service_js_1.TitleVerificationService,
        ],
    })
], ListingOptimizationModule);
//# sourceMappingURL=listing-optimization.module.js.map