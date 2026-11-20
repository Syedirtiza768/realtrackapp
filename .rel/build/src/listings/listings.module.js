"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const listing_record_entity_1 = require("./listing-record.entity");
const listing_revision_entity_1 = require("./listing-revision.entity");
const listing_compliance_entity_1 = require("./listing-compliance.entity");
const master_product_entity_1 = require("./entities/master-product.entity");
const ebay_offer_entity_1 = require("./entities/ebay-offer.entity");
const cross_reference_entity_1 = require("./entities/cross-reference.entity");
const ebay_category_entity_1 = require("./entities/ebay-category.entity");
const competitor_price_entity_1 = require("./entities/competitor-price.entity");
const market_snapshot_entity_1 = require("./entities/market-snapshot.entity");
const export_rule_entity_1 = require("./entities/export-rule.entity");
const catalog_product_entity_1 = require("../catalog-import/entities/catalog-product.entity");
const listing_action_log_entity_js_1 = require("../integrations/ebay/entities/listing-action-log.entity.js");
const listings_controller_1 = require("./listings.controller");
const listings_v2_controller_1 = require("./listings-v2.controller");
const export_rule_controller_1 = require("./export-rule.controller");
const listing_generation_controller_1 = require("./listing-generation.controller");
const listings_service_1 = require("./listings.service");
const search_service_1 = require("./search.service");
const export_rule_service_1 = require("./export-rule.service");
const listing_generation_service_1 = require("./listing-generation.service");
const channels_module_1 = require("../channels/channels.module");
const template_module_1 = require("../templates/template.module");
const teams_module_js_1 = require("../teams/teams.module.js");
const rbac_module_js_1 = require("../rbac/rbac.module.js");
const auth_module_js_1 = require("../auth/auth.module.js");
let ListingsModule = class ListingsModule {
};
exports.ListingsModule = ListingsModule;
exports.ListingsModule = ListingsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                listing_record_entity_1.ListingRecord,
                listing_revision_entity_1.ListingRevision,
                listing_compliance_entity_1.ListingCompliance,
                master_product_entity_1.MasterProduct,
                ebay_offer_entity_1.EbayOffer,
                cross_reference_entity_1.CrossReference,
                ebay_category_entity_1.EbayCategory,
                competitor_price_entity_1.CompetitorPrice,
                market_snapshot_entity_1.MarketSnapshot,
                export_rule_entity_1.ExportRule,
                catalog_product_entity_1.CatalogProduct,
                listing_action_log_entity_js_1.ListingActionLog,
            ]),
            channels_module_1.ChannelsModule,
            template_module_1.TemplateModule,
            teams_module_js_1.TeamsModule,
            rbac_module_js_1.RbacModule,
            auth_module_js_1.AuthModule,
        ],
        controllers: [
            listings_controller_1.ListingsController,
            listings_v2_controller_1.ListingsV2Controller,
            export_rule_controller_1.ExportRuleController,
            listing_generation_controller_1.ListingGenerationController,
        ],
        providers: [
            listings_service_1.ListingsService,
            search_service_1.SearchService,
            export_rule_service_1.ExportRuleService,
            listing_generation_service_1.ListingGenerationService,
        ],
        exports: [
            listings_service_1.ListingsService,
            search_service_1.SearchService,
            export_rule_service_1.ExportRuleService,
            listing_generation_service_1.ListingGenerationService,
        ],
    })
], ListingsModule);
//# sourceMappingURL=listings.module.js.map