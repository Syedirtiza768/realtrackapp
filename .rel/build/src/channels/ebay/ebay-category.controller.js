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
exports.EbayCategoryController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const public_decorator_js_1 = require("../../auth/decorators/public.decorator.js");
const ebay_taxonomy_api_service_js_1 = require("./ebay-taxonomy-api.service.js");
let EbayCategoryController = class EbayCategoryController {
    taxonomy;
    constructor(taxonomy) {
        this.taxonomy = taxonomy;
    }
    async suggest(q) {
        if (!q?.trim())
            return { suggestions: [] };
        const suggestions = await this.taxonomy.getCategorySuggestions(q.trim());
        return {
            suggestions: suggestions.map((s) => ({
                id: s.category.categoryId,
                name: s.category.categoryName,
            })),
        };
    }
};
exports.EbayCategoryController = EbayCategoryController;
__decorate([
    (0, common_1.Get)('suggest'),
    (0, public_decorator_js_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Suggest eBay categories from a keyword query' }),
    __param(0, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EbayCategoryController.prototype, "suggest", null);
exports.EbayCategoryController = EbayCategoryController = __decorate([
    (0, swagger_1.ApiTags)('ebay-category'),
    (0, common_1.Controller)('ebay/category'),
    __metadata("design:paramtypes", [ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService])
], EbayCategoryController);
//# sourceMappingURL=ebay-category.controller.js.map