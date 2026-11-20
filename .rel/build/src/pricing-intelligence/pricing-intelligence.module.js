"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingIntelligenceModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const master_product_entity_js_1 = require("../listings/entities/master-product.entity.js");
const ebay_offer_entity_js_1 = require("../listings/entities/ebay-offer.entity.js");
const competitor_price_entity_js_1 = require("../listings/entities/competitor-price.entity.js");
const market_snapshot_entity_js_1 = require("../listings/entities/market-snapshot.entity.js");
const store_entity_js_1 = require("../channels/entities/store.entity.js");
const price_monitor_service_js_1 = require("./price-monitor.service.js");
const auto_reprice_service_js_1 = require("./auto-reprice.service.js");
const pricing_intelligence_controller_js_1 = require("./pricing-intelligence.controller.js");
const channels_module_js_1 = require("../channels/channels.module.js");
const feature_flag_module_js_1 = require("../common/feature-flags/feature-flag.module.js");
let PricingIntelligenceModule = class PricingIntelligenceModule {
};
exports.PricingIntelligenceModule = PricingIntelligenceModule;
exports.PricingIntelligenceModule = PricingIntelligenceModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                master_product_entity_js_1.MasterProduct,
                ebay_offer_entity_js_1.EbayOffer,
                competitor_price_entity_js_1.CompetitorPrice,
                market_snapshot_entity_js_1.MarketSnapshot,
                store_entity_js_1.Store,
            ]),
            channels_module_js_1.ChannelsModule,
            feature_flag_module_js_1.FeatureFlagModule,
        ],
        controllers: [pricing_intelligence_controller_js_1.PricingIntelligenceController],
        providers: [price_monitor_service_js_1.PriceMonitorService, auto_reprice_service_js_1.AutoRepriceService],
        exports: [price_monitor_service_js_1.PriceMonitorService, auto_reprice_service_js_1.AutoRepriceService],
    })
], PricingIntelligenceModule);
//# sourceMappingURL=pricing-intelligence.module.js.map