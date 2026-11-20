"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogImportModule = void 0;
const verticals_module_js_1 = require("../verticals/verticals.module.js");
const auth_module_js_1 = require("../auth/auth.module.js");
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const catalog_product_entity_js_1 = require("./entities/catalog-product.entity.js");
const catalog_import_entity_js_1 = require("./entities/catalog-import.entity.js");
const catalog_import_row_entity_js_1 = require("./entities/catalog-import-row.entity.js");
const compliance_audit_log_entity_js_1 = require("./entities/compliance-audit-log.entity.js");
const catalog_import_controller_js_1 = require("./catalog-import.controller.js");
const catalog_import_service_js_1 = require("./catalog-import.service.js");
const csv_import_processor_js_1 = require("./processors/csv-import.processor.js");
const duplicate_detection_service_js_1 = require("./services/duplicate-detection.service.js");
const ebay_compliance_service_js_1 = require("./services/ebay-compliance.service.js");
const compliance_audit_service_js_1 = require("./services/compliance-audit.service.js");
const category_lookup_service_js_1 = require("./services/category-lookup.service.js");
const compliance_controller_js_1 = require("./controllers/compliance.controller.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const openai_module_js_1 = require("../common/openai/openai.module.js");
const catalog_product_controller_js_1 = require("./catalog-product.controller.js");
const catalog_product_service_js_1 = require("./catalog-product.service.js");
const template_generator_service_js_1 = require("./template-generator.service.js");
const storage_module_js_1 = require("../storage/storage.module.js");
const channels_module_js_1 = require("../channels/channels.module.js");
const rbac_module_js_1 = require("../rbac/rbac.module.js");
const heavy_job_limiter_module_js_1 = require("../common/jobs/heavy-job-limiter.module.js");
const listings_module_js_1 = require("../listings/listings.module.js");
let CatalogImportModule = class CatalogImportModule {
};
exports.CatalogImportModule = CatalogImportModule;
exports.CatalogImportModule = CatalogImportModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                catalog_product_entity_js_1.CatalogProduct,
                catalog_import_entity_js_1.CatalogImport,
                catalog_import_row_entity_js_1.CatalogImportRow,
                compliance_audit_log_entity_js_1.ComplianceAuditLog,
                listing_record_entity_js_1.ListingRecord,
            ]),
            rbac_module_js_1.RbacModule,
            auth_module_js_1.AuthModule,
            verticals_module_js_1.VerticalsModule,
            heavy_job_limiter_module_js_1.HeavyJobLimiterModule,
            bullmq_1.BullModule.registerQueue({ name: 'catalog-import' }),
            openai_module_js_1.OpenAiModule,
            storage_module_js_1.StorageModule,
            channels_module_js_1.ChannelsModule,
            listings_module_js_1.ListingsModule,
        ],
        controllers: [
            catalog_import_controller_js_1.CatalogImportController,
            compliance_controller_js_1.ComplianceController,
            catalog_product_controller_js_1.CatalogProductController,
        ],
        providers: [
            catalog_import_service_js_1.CatalogImportService,
            csv_import_processor_js_1.CsvImportProcessor,
            duplicate_detection_service_js_1.DuplicateDetectionService,
            ebay_compliance_service_js_1.EbayComplianceService,
            compliance_audit_service_js_1.ComplianceAuditService,
            catalog_product_service_js_1.CatalogProductService,
            template_generator_service_js_1.TemplateGeneratorService,
            category_lookup_service_js_1.CategoryLookupService,
        ],
        exports: [
            catalog_import_service_js_1.CatalogImportService,
            duplicate_detection_service_js_1.DuplicateDetectionService,
            ebay_compliance_service_js_1.EbayComplianceService,
            compliance_audit_service_js_1.ComplianceAuditService,
            catalog_product_service_js_1.CatalogProductService,
            template_generator_service_js_1.TemplateGeneratorService,
        ],
    })
], CatalogImportModule);
//# sourceMappingURL=catalog-import.module.js.map