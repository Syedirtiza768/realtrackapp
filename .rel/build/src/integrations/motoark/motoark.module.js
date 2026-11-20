"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotoarkModule = void 0;
const common_1 = require("@nestjs/common");
const channels_module_js_1 = require("../../channels/channels.module.js");
const rbac_module_js_1 = require("../../rbac/rbac.module.js");
const stock_module_js_1 = require("../../stock/stock.module.js");
const published_listings_module_js_1 = require("../../published-listings/published-listings.module.js");
const ebay_integrations_module_js_1 = require("../ebay/ebay-integrations.module.js");
const motoark_controller_js_1 = require("./motoark.controller.js");
const motoark_service_js_1 = require("./motoark.service.js");
const motoark_stock_service_js_1 = require("./motoark-stock.service.js");
let MotoarkModule = class MotoarkModule {
};
exports.MotoarkModule = MotoarkModule;
exports.MotoarkModule = MotoarkModule = __decorate([
    (0, common_1.Module)({
        imports: [
            channels_module_js_1.ChannelsModule,
            rbac_module_js_1.RbacModule,
            stock_module_js_1.StockModule,
            published_listings_module_js_1.PublishedListingsModule,
            ebay_integrations_module_js_1.EbayIntegrationsModule,
        ],
        controllers: [motoark_controller_js_1.MotoarkController],
        providers: [motoark_service_js_1.MotoarkService, motoark_stock_service_js_1.MotoarkStockService],
    })
], MotoarkModule);
//# sourceMappingURL=motoark.module.js.map