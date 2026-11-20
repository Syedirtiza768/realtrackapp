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
exports.ListingsV2Controller = void 0;
const common_1 = require("@nestjs/common");
const listings_service_js_1 = require("./listings.service.js");
const listings_query_dto_js_1 = require("./dto/listings-query.dto.js");
const search_service_js_1 = require("./search.service.js");
const search_query_dto_js_1 = require("./dto/search-query.dto.js");
const index_js_1 = require("../common/cache/index.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
let ListingsV2Controller = class ListingsV2Controller {
    listingsService;
    searchService;
    constructor(listingsService, searchService) {
        this.listingsService = listingsService;
        this.searchService = searchService;
    }
    async findAll(query) {
        const result = await this.listingsService.findAll(query);
        return {
            ...result,
            items: result.items.map(toV2Listing),
        };
    }
    async search(query) {
        const result = await this.searchService.search(query);
        return {
            ...result,
            results: result.results?.map((r) => ({
                ...r,
                ...toV2PriceFields(r),
            })) ?? [],
        };
    }
    getSummary() {
        return this.listingsService.getSummary();
    }
    getFacets() {
        return this.listingsService.getFacets();
    }
    async findOne(id) {
        const result = await this.listingsService.findOne(id);
        return toV2FullListing(result);
    }
    getRevisions(id, limit, offset) {
        return this.listingsService.getRevisions(id, Number(limit) || 20, Number(offset) || 0);
    }
};
exports.ListingsV2Controller = ListingsV2Controller;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [listings_query_dto_js_1.ListingsQueryDto]),
    __metadata("design:returntype", Promise)
], ListingsV2Controller.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [search_query_dto_js_1.SearchQueryDto]),
    __metadata("design:returntype", Promise)
], ListingsV2Controller.prototype, "search", null);
__decorate([
    (0, common_1.Get)('summary'),
    (0, index_js_1.CacheTTL)(30),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ListingsV2Controller.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)('facets'),
    (0, index_js_1.CacheTTL)(60),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ListingsV2Controller.prototype, "getFacets", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ListingsV2Controller.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/revisions'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], ListingsV2Controller.prototype, "getRevisions", null);
exports.ListingsV2Controller = ListingsV2Controller = __decorate([
    (0, common_1.Controller)('v2/listings'),
    (0, common_1.UseInterceptors)(index_js_1.RedisCacheInterceptor),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.view'),
    __metadata("design:paramtypes", [listings_service_js_1.ListingsService,
        search_service_js_1.SearchService])
], ListingsV2Controller);
function parsePrice(val) {
    if (val == null || val === '')
        return null;
    const cleaned = val.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : Math.round(num * 100) / 100;
}
function parseQty(val) {
    if (val == null || val === '')
        return null;
    const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? null : num;
}
function toV2PriceFields(record) {
    return {
        startPrice: record.startPriceNum ?? parsePrice(record.startPrice),
        quantity: record.quantityNum ?? parseQty(record.quantity),
    };
}
function toV2Listing(record) {
    return {
        ...record,
        ...toV2PriceFields(record),
    };
}
function toV2FullListing(record) {
    return {
        ...record,
        startPrice: record.startPriceNum ?? parsePrice(record.startPrice),
        quantity: record.quantityNum ?? parseQty(record.quantity),
        buyItNowPrice: record.buyItNowPriceNum ?? parsePrice(record.buyItNowPrice),
        bestOfferAutoAcceptPrice: record.bestOfferAutoAcceptPriceNum ??
            parsePrice(record.bestOfferAutoAcceptPrice),
        minimumBestOfferPrice: record.minimumBestOfferPriceNum ??
            parsePrice(record.minimumBestOfferPrice),
        shippingService1Cost: record.shippingService1CostNum ?? parsePrice(record.shippingService1Cost),
        shippingService2Cost: record.shippingService2CostNum ?? parsePrice(record.shippingService2Cost),
    };
}
//# sourceMappingURL=listings-v2.controller.js.map