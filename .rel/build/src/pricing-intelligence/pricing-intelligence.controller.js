"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingIntelligenceController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const price_monitor_service_js_1 = require("./price-monitor.service.js");
const auto_reprice_service_js_1 = require("./auto-reprice.service.js");
class AnalyzeDto {
    productId;
}
class RepriceDto {
    productId;
    storeIds;
    forceApply;
}
class CollectPricesDto {
    productId;
}
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
let PricingIntelligenceController = class PricingIntelligenceController {
    priceMonitor;
    autoReprice;
    constructor(priceMonitor, autoReprice) {
        this.priceMonitor = priceMonitor;
        this.autoReprice = autoReprice;
    }
    getLatestSnapshot(productId) {
        return this.priceMonitor.getLatestSnapshot(productId);
    }
    getSnapshotHistory(productId, limit) {
        return this.priceMonitor.getSnapshotHistory(productId, limit ? parseInt(limit, 10) : 30);
    }
    getCompetitorHistory(productId, days) {
        return this.priceMonitor.getCompetitorHistory(productId, days ? parseInt(days, 10) : 30);
    }
    getSuggestion(productId) {
        return this.autoReprice.getSuggestion(productId);
    }
    reprice(dto) {
        return this.autoReprice.repriceProduct(dto.productId, {
            storeIds: dto.storeIds,
            forceApply: dto.forceApply,
        });
    }
    collectPrices(dto) {
        if (dto.productId) {
            return this.priceMonitor.collectForProduct(dto.productId);
        }
        return this.priceMonitor.collectAllCompetitorPrices();
    }
};
exports.PricingIntelligenceController = PricingIntelligenceController;
__decorate([
    (0, common_1.Get)(':productId/snapshot'),
    (0, swagger_1.ApiOperation)({ summary: 'Get latest market snapshot for a product' }),
    __param(0, (0, common_1.Param)('productId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PricingIntelligenceController.prototype, "getLatestSnapshot", null);
__decorate([
    (0, common_1.Get)(':productId/snapshots'),
    (0, swagger_1.ApiOperation)({ summary: 'Get market snapshot history for charting' }),
    __param(0, (0, common_1.Param)('productId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PricingIntelligenceController.prototype, "getSnapshotHistory", null);
__decorate([
    (0, common_1.Get)(':productId/competitors'),
    (0, swagger_1.ApiOperation)({ summary: 'Get competitor price history for a product' }),
    __param(0, (0, common_1.Param)('productId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PricingIntelligenceController.prototype, "getCompetitorHistory", null);
__decorate([
    (0, common_1.Get)(':productId/suggestion'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get AI pricing suggestion for a product (does not apply)',
    }),
    __param(0, (0, common_1.Param)('productId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PricingIntelligenceController.prototype, "getSuggestion", null);
__decorate([
    (0, common_1.Post)('reprice'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pricing.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Auto-reprice a product across eBay stores' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RepriceDto]),
    __metadata("design:returntype", void 0)
], PricingIntelligenceController.prototype, "reprice", null);
__decorate([
    (0, common_1.Post)('collect'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pricing.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Manually trigger competitor price collection' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CollectPricesDto]),
    __metadata("design:returntype", void 0)
], PricingIntelligenceController.prototype, "collectPrices", null);
exports.PricingIntelligenceController = PricingIntelligenceController = __decorate([
    (0, swagger_1.ApiTags)('pricing-intelligence'),
    (0, common_1.Controller)('pricing'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pricing.view'),
    __metadata("design:paramtypes", [price_monitor_service_js_1.PriceMonitorService,
        auto_reprice_service_js_1.AutoRepriceService])
], PricingIntelligenceController);
//# sourceMappingURL=pricing-intelligence.controller.js.map