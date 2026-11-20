"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FitmentModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const fitment_make_entity_js_1 = require("./entities/fitment-make.entity.js");
const fitment_model_entity_js_1 = require("./entities/fitment-model.entity.js");
const fitment_submodel_entity_js_1 = require("./entities/fitment-submodel.entity.js");
const fitment_year_entity_js_1 = require("./entities/fitment-year.entity.js");
const fitment_engine_entity_js_1 = require("./entities/fitment-engine.entity.js");
const part_fitment_entity_js_1 = require("./entities/part-fitment.entity.js");
const vin_cache_entity_js_1 = require("./entities/vin-cache.entity.js");
const ebay_mvl_release_entity_js_1 = require("./entities/ebay-mvl-release.entity.js");
const ebay_mvl_entry_entity_js_1 = require("./entities/ebay-mvl-entry.entity.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const fitment_service_js_1 = require("./fitment.service.js");
const fitment_matcher_service_js_1 = require("./fitment-matcher.service.js");
const fitment_import_service_js_1 = require("./fitment-import.service.js");
const fitment_import_processor_js_1 = require("./processors/fitment-import.processor.js");
const fitment_controller_js_1 = require("./fitment.controller.js");
const ebay_mvl_service_js_1 = require("./ebay-mvl.service.js");
const ebay_mvl_store_service_js_1 = require("./ebay-mvl-store.service.js");
const ebay_mvl_import_service_js_1 = require("./ebay-mvl-import.service.js");
const vin_decode_service_js_1 = require("./vin-decode.service.js");
const mvl_fitment_expander_service_js_1 = require("./mvl-fitment-expander.service.js");
const vin_export_service_js_1 = require("./vin-export.service.js");
const vin_db_export_service_js_1 = require("./vin-db-export.service.js");
const ebay_vin_search_service_js_1 = require("./ebay-vin-search.service.js");
const brand_decoder_registry_js_1 = require("./vin-decoders/brand-decoder.registry.js");
const channels_module_js_1 = require("../channels/channels.module.js");
let FitmentModule = class FitmentModule {
};
exports.FitmentModule = FitmentModule;
exports.FitmentModule = FitmentModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                fitment_make_entity_js_1.FitmentMake,
                fitment_model_entity_js_1.FitmentModel,
                fitment_submodel_entity_js_1.FitmentSubmodel,
                fitment_year_entity_js_1.FitmentYear,
                fitment_engine_entity_js_1.FitmentEngine,
                part_fitment_entity_js_1.PartFitment,
                vin_cache_entity_js_1.VinCache,
                listing_record_entity_js_1.ListingRecord,
                ebay_mvl_release_entity_js_1.EbayMvlRelease,
                ebay_mvl_entry_entity_js_1.EbayMvlEntry,
            ]),
            bullmq_1.BullModule.registerQueue({ name: 'fitment' }),
            (0, common_1.forwardRef)(() => channels_module_js_1.ChannelsModule),
        ],
        controllers: [fitment_controller_js_1.FitmentController],
        providers: [
            fitment_service_js_1.FitmentService,
            fitment_matcher_service_js_1.FitmentMatcherService,
            fitment_import_service_js_1.FitmentImportService,
            fitment_import_processor_js_1.FitmentImportProcessor,
            ebay_mvl_service_js_1.EbayMvlService,
            ebay_mvl_store_service_js_1.EbayMvlStoreService,
            ebay_mvl_import_service_js_1.EbayMvlImportService,
            mvl_fitment_expander_service_js_1.MvlFitmentExpanderService,
            vin_decode_service_js_1.VinDecodeService,
            vin_export_service_js_1.VinExportService,
            vin_db_export_service_js_1.VinDbExportService,
            ebay_vin_search_service_js_1.EbayVinSearchService,
            brand_decoder_registry_js_1.BrandVinDecoderRegistry,
        ],
        exports: [
            fitment_service_js_1.FitmentService,
            fitment_matcher_service_js_1.FitmentMatcherService,
            ebay_mvl_service_js_1.EbayMvlService,
            ebay_mvl_store_service_js_1.EbayMvlStoreService,
            ebay_mvl_import_service_js_1.EbayMvlImportService,
            mvl_fitment_expander_service_js_1.MvlFitmentExpanderService,
            vin_decode_service_js_1.VinDecodeService,
            vin_export_service_js_1.VinExportService,
            vin_db_export_service_js_1.VinDbExportService,
            ebay_vin_search_service_js_1.EbayVinSearchService,
            brand_decoder_registry_js_1.BrandVinDecoderRegistry,
        ],
    })
], FitmentModule);
//# sourceMappingURL=fitment.module.js.map