"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotorsIntelligenceModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const entities_1 = require("./entities");
const services_1 = require("./services");
const controllers_1 = require("./controllers");
const processors_1 = require("./processors");
const catalog_product_entity_1 = require("../catalog-import/entities/catalog-product.entity");
const part_fitment_entity_1 = require("../fitment/entities/part-fitment.entity");
const fitment_make_entity_1 = require("../fitment/entities/fitment-make.entity");
const fitment_model_entity_1 = require("../fitment/entities/fitment-model.entity");
const channels_module_1 = require("../channels/channels.module");
const listings_module_1 = require("../listings/listings.module");
const feature_flag_module_1 = require("../common/feature-flags/feature-flag.module");
const fitment_module_1 = require("../fitment/fitment.module");
const storage_module_1 = require("../storage/storage.module");
let MotorsIntelligenceModule = class MotorsIntelligenceModule {
};
exports.MotorsIntelligenceModule = MotorsIntelligenceModule;
exports.MotorsIntelligenceModule = MotorsIntelligenceModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                entities_1.MotorsProduct,
                entities_1.ProductCandidate,
                entities_1.ExtractedAttribute,
                entities_1.EbayCategoryMapping,
                entities_1.EbayAspectRequirement,
                entities_1.ValidationResult,
                entities_1.ReviewTask,
                entities_1.CorrectionRule,
                entities_1.ListingGeneration,
                entities_1.MotorsFeedbackLog,
                catalog_product_entity_1.CatalogProduct,
                part_fitment_entity_1.PartFitment,
                fitment_make_entity_1.FitmentMake,
                fitment_model_entity_1.FitmentModel,
            ]),
            bullmq_1.BullModule.registerQueue({ name: 'motors-pipeline' }),
            channels_module_1.ChannelsModule,
            listings_module_1.ListingsModule,
            feature_flag_module_1.FeatureFlagModule,
            fitment_module_1.FitmentModule,
            storage_module_1.StorageModule,
        ],
        controllers: [controllers_1.MotorsIntelligenceController, controllers_1.ReviewQueueController],
        providers: [
            services_1.VisionExtractionService,
            services_1.ProductIdentityService,
            services_1.ListingGeneratorService,
            services_1.ComplianceEngineService,
            services_1.FitmentResolverService,
            services_1.ReviewQueueService,
            services_1.MotorsIntelligenceService,
            services_1.MotorsPublisherService,
            services_1.EbayEnrichmentService,
            processors_1.MotorsPipelineProcessor,
        ],
        exports: [
            services_1.MotorsIntelligenceService,
            services_1.ReviewQueueService,
            services_1.EbayEnrichmentService,
        ],
    })
], MotorsIntelligenceModule);
//# sourceMappingURL=motors-intelligence.module.js.map