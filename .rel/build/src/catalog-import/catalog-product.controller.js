"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogProductController = void 0;
const common_1 = require("@nestjs/common");
const express = __importStar(require("express"));
const catalog_product_service_js_1 = require("./catalog-product.service.js");
const template_generator_service_js_1 = require("./template-generator.service.js");
const catalog_product_list_query_js_1 = require("./utils/catalog-product-list-query.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const category_lookup_service_js_1 = require("./services/category-lookup.service.js");
const listings_service_js_1 = require("../listings/listings.service.js");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
let CatalogProductController = class CatalogProductController {
    productService;
    templateService;
    categoryLookup;
    listingsService;
    constructor(productService, templateService, categoryLookup, listingsService) {
        this.productService = productService;
        this.templateService = templateService;
        this.categoryLookup = categoryLookup;
        this.listingsService = listingsService;
    }
    async list(query, user) {
        const params = (0, catalog_product_list_query_js_1.parseCatalogProductListQuery)(query);
        return this.productService.findAll(params, user);
    }
    async updateBySku(sku, dto, user) {
        return this.productService.updateBySku(sku, dto, user);
    }
    async getOne(id, user) {
        return this.productService.findOne(id, user);
    }
    async update(id, dto, user) {
        return this.productService.update(id, dto, user);
    }
    async fixConditionTitles(body) {
        return this.productService.bulkFixConditionMismatchTitles(body.pipelineJobId);
    }
    async sanitizeTitles(body) {
        return this.productService.bulkSanitizeTitles(body.pipelineJobId);
    }
    async backfillCategories(body) {
        const catalogResult = await this.categoryLookup.backfillMissingCategories(body.batchSize ?? 10, body.concurrency ?? 2);
        let listingResult = { scanned: 0, updated: 0, failed: 0 };
        if (body.includeListings !== false) {
            listingResult = await this.categoryLookup.backfillListingRecords(body.batchSize ?? 10, body.concurrency ?? 2);
        }
        return {
            catalog: catalogResult,
            listings: listingResult,
            total: {
                scanned: catalogResult.scanned + listingResult.scanned,
                updated: catalogResult.updated + listingResult.updated,
                failed: catalogResult.failed + listingResult.failed,
            },
        };
    }
    async exportTemplates(body, user, res) {
        let products = body.ids?.length
            ? await this.productService.findByIds(body.ids, user)
            : [];
        if (body.listingIds?.length && products.length === 0) {
            products = await this.productService.findByListingIds(body.listingIds, user);
        }
        if (!products.length) {
            res
                .status(404)
                .json({ error: 'No catalog products found for given IDs' });
            return;
        }
        if (body.persistProfiles && body.listingIds?.length) {
            await this.listingsService.bulkApplyProfiles({
                ids: body.listingIds,
                shippingProfile: body.shippingProfile,
                returnProfile: body.returnProfile,
                paymentProfile: body.paymentProfile,
                teamIds: body.teamIds,
            }, user);
        }
        const profileOverrides = {
            shippingProfile: body.shippingProfile,
            returnProfile: body.returnProfile,
            paymentProfile: body.paymentProfile,
        };
        products = this.productService.applyProfileOverrides(products, profileOverrides);
        const formats = body.formats || ['us', 'au', 'de'];
        const zip = await this.templateService.generateTemplatesZip(products, formats);
        const dateStr = new Date().toISOString().slice(0, 10);
        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="listings-${dateStr}.zip"`,
        });
        res.send(zip);
    }
};
exports.CatalogProductController = CatalogProductController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], CatalogProductController.prototype, "list", null);
__decorate([
    (0, common_1.Patch)('by-sku/:sku'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('catalog.update'),
    __param(0, (0, common_1.Param)('sku')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], CatalogProductController.prototype, "updateBySku", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], CatalogProductController.prototype, "getOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('catalog.update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], CatalogProductController.prototype, "update", null);
__decorate([
    (0, common_1.Post)('fix-condition-titles'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('catalog.clear'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CatalogProductController.prototype, "fixConditionTitles", null);
__decorate([
    (0, common_1.Post)('sanitize-titles'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('catalog.clear'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CatalogProductController.prototype, "sanitizeTitles", null);
__decorate([
    (0, common_1.Post)('backfill-categories'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('catalog.clear'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CatalogProductController.prototype, "backfillCategories", null);
__decorate([
    (0, common_1.Post)('export-templates'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('catalog.export'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_entity_js_1.User, Object]),
    __metadata("design:returntype", Promise)
], CatalogProductController.prototype, "exportTemplates", null);
exports.CatalogProductController = CatalogProductController = __decorate([
    (0, common_1.Controller)('catalog-products'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('catalog.view'),
    __metadata("design:paramtypes", [catalog_product_service_js_1.CatalogProductService,
        template_generator_service_js_1.TemplateGeneratorService,
        category_lookup_service_js_1.CategoryLookupService,
        listings_service_js_1.ListingsService])
], CatalogProductController);
//# sourceMappingURL=catalog-product.controller.js.map