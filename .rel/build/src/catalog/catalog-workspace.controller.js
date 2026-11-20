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
exports.BusinessIndustrialCatalogWorkspaceController = exports.FashionCatalogWorkspaceController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const business_industrial_service_js_1 = require("../verticals/business-industrial.service.js");
const catalog_workspace_service_js_1 = require("./catalog-workspace.service.js");
const catalog_workspace_dto_js_1 = require("./catalog-workspace.dto.js");
let FashionCatalogWorkspaceController = class FashionCatalogWorkspaceController {
    catalog;
    constructor(catalog) {
        this.catalog = catalog;
    }
    search(user, dto) {
        return this.catalog.search(user, 'fashion', dto);
    }
    suggest(user, dto) {
        return this.catalog.suggest(user, 'fashion', dto.q, dto.limit ?? 10, dto.organizationId);
    }
    facets(user, dto) {
        return this.catalog.facets(user, 'fashion', dto);
    }
    summary(user, dto) {
        return this.catalog.summary(user, 'fashion', dto.organizationId);
    }
    detail(user, id, dto) {
        return this.catalog.detail(user, 'fashion', id, dto.organizationId);
    }
    patch(user, id, dto, query) {
        return this.catalog.patch(user, 'fashion', id, dto, query.organizationId);
    }
    team(user, dto) {
        return this.catalog.bulkTeam(user, 'fashion', dto);
    }
    policies(user, dto) {
        return this.catalog.bulkPolicies(user, 'fashion', dto);
    }
    delete(user, dto) {
        return this.catalog.bulkDelete(user, 'fashion', dto);
    }
    async export(user, dto, response) {
        response.setHeader('Content-Disposition', `attachment; filename="fashion-catalog-${new Date().toISOString().slice(0, 10)}.csv"`);
        response.send(await this.catalog.exportCsv(user, 'fashion', dto));
    }
};
exports.FashionCatalogWorkspaceController = FashionCatalogWorkspaceController;
__decorate([
    (0, common_1.Get)('search'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, catalog_workspace_dto_js_1.CatalogQueryDto]),
    __metadata("design:returntype", void 0)
], FashionCatalogWorkspaceController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('search/suggest'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, catalog_workspace_dto_js_1.CatalogSuggestQueryDto]),
    __metadata("design:returntype", void 0)
], FashionCatalogWorkspaceController.prototype, "suggest", null);
__decorate([
    (0, common_1.Get)('search/facets'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, catalog_workspace_dto_js_1.CatalogQueryDto]),
    __metadata("design:returntype", void 0)
], FashionCatalogWorkspaceController.prototype, "facets", null);
__decorate([
    (0, common_1.Get)('summary'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, catalog_workspace_dto_js_1.CatalogQueryDto]),
    __metadata("design:returntype", void 0)
], FashionCatalogWorkspaceController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('products/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, catalog_workspace_dto_js_1.CatalogQueryDto]),
    __metadata("design:returntype", void 0)
], FashionCatalogWorkspaceController.prototype, "detail", null);
__decorate([
    (0, common_1.Patch)('products/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.update'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, catalog_workspace_dto_js_1.CatalogProductPatchDto,
        catalog_workspace_dto_js_1.CatalogQueryDto]),
    __metadata("design:returntype", void 0)
], FashionCatalogWorkspaceController.prototype, "patch", null);
__decorate([
    (0, common_1.Post)('bulk/team'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.catalog.assign_team'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, catalog_workspace_dto_js_1.CatalogBulkTeamDto]),
    __metadata("design:returntype", void 0)
], FashionCatalogWorkspaceController.prototype, "team", null);
__decorate([
    (0, common_1.Post)('bulk/policies'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.catalog.manage_policies'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, catalog_workspace_dto_js_1.CatalogBulkPoliciesDto]),
    __metadata("design:returntype", void 0)
], FashionCatalogWorkspaceController.prototype, "policies", null);
__decorate([
    (0, common_1.Post)('bulk/delete'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.catalog.delete'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, catalog_workspace_dto_js_1.CatalogBulkIdsDto]),
    __metadata("design:returntype", void 0)
], FashionCatalogWorkspaceController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)('export'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.catalog.export'),
    (0, common_1.Header)('Content-Type', 'text/csv; charset=utf-8'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        catalog_workspace_dto_js_1.CatalogExportDto, Object]),
    __metadata("design:returntype", Promise)
], FashionCatalogWorkspaceController.prototype, "export", null);
exports.FashionCatalogWorkspaceController = FashionCatalogWorkspaceController = __decorate([
    (0, common_1.Controller)('fashion/catalog'),
    __metadata("design:paramtypes", [catalog_workspace_service_js_1.CatalogWorkspaceService])
], FashionCatalogWorkspaceController);
let BusinessIndustrialCatalogWorkspaceController = class BusinessIndustrialCatalogWorkspaceController {
    catalog;
    businessIndustrial;
    constructor(catalog, businessIndustrial) {
        this.catalog = catalog;
        this.businessIndustrial = businessIndustrial;
    }
    search(user, dto) {
        return this.catalog.search(user, 'business_industrial', dto);
    }
    suggest(user, dto) {
        return this.catalog.suggest(user, 'business_industrial', dto.q, dto.limit ?? 10, dto.organizationId);
    }
    facets(user, dto) {
        return this.catalog.facets(user, 'business_industrial', dto);
    }
    summary(user, dto) {
        return this.catalog.summary(user, 'business_industrial', dto.organizationId);
    }
    detail(user, id, dto) {
        return this.catalog.detail(user, 'business_industrial', id, dto.organizationId);
    }
    patch(user, id, dto, query) {
        return this.catalog.patch(user, 'business_industrial', id, dto, query.organizationId);
    }
    team(user, dto) {
        return this.catalog.bulkTeam(user, 'business_industrial', dto);
    }
    policies(user, dto) {
        return this.catalog.bulkPolicies(user, 'business_industrial', dto);
    }
    delete(user, dto) {
        return this.catalog.bulkDelete(user, 'business_industrial', dto);
    }
    async export(user, dto, response) {
        response.setHeader('Content-Disposition', `attachment; filename="business-industrial-catalog-${new Date().toISOString().slice(0, 10)}.csv"`);
        response.send(await this.catalog.exportCsv(user, 'business_industrial', dto));
    }
    categories() {
        return this.businessIndustrial.categoryFamilies();
    }
};
exports.BusinessIndustrialCatalogWorkspaceController = BusinessIndustrialCatalogWorkspaceController;
__decorate([
    (0, common_1.Get)('search'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, catalog_workspace_dto_js_1.CatalogQueryDto]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialCatalogWorkspaceController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('search/suggest'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, catalog_workspace_dto_js_1.CatalogSuggestQueryDto]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialCatalogWorkspaceController.prototype, "suggest", null);
__decorate([
    (0, common_1.Get)('search/facets'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, catalog_workspace_dto_js_1.CatalogQueryDto]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialCatalogWorkspaceController.prototype, "facets", null);
__decorate([
    (0, common_1.Get)('summary'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, catalog_workspace_dto_js_1.CatalogQueryDto]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialCatalogWorkspaceController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('products/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, catalog_workspace_dto_js_1.CatalogQueryDto]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialCatalogWorkspaceController.prototype, "detail", null);
__decorate([
    (0, common_1.Patch)('products/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.listings.update'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, catalog_workspace_dto_js_1.CatalogProductPatchDto,
        catalog_workspace_dto_js_1.CatalogQueryDto]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialCatalogWorkspaceController.prototype, "patch", null);
__decorate([
    (0, common_1.Post)('bulk/team'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.catalog.assign_team'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, catalog_workspace_dto_js_1.CatalogBulkTeamDto]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialCatalogWorkspaceController.prototype, "team", null);
__decorate([
    (0, common_1.Post)('bulk/policies'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.catalog.manage_policies'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, catalog_workspace_dto_js_1.CatalogBulkPoliciesDto]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialCatalogWorkspaceController.prototype, "policies", null);
__decorate([
    (0, common_1.Post)('bulk/delete'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.catalog.delete'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, catalog_workspace_dto_js_1.CatalogBulkIdsDto]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialCatalogWorkspaceController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)('export'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.catalog.export'),
    (0, common_1.Header)('Content-Type', 'text/csv; charset=utf-8'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        catalog_workspace_dto_js_1.CatalogExportDto, Object]),
    __metadata("design:returntype", Promise)
], BusinessIndustrialCatalogWorkspaceController.prototype, "export", null);
__decorate([
    (0, common_1.Get)('categories'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access', 'business_industrial.listings.view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BusinessIndustrialCatalogWorkspaceController.prototype, "categories", null);
exports.BusinessIndustrialCatalogWorkspaceController = BusinessIndustrialCatalogWorkspaceController = __decorate([
    (0, common_1.Controller)('business-industrial/catalog'),
    __metadata("design:paramtypes", [catalog_workspace_service_js_1.CatalogWorkspaceService,
        business_industrial_service_js_1.BusinessIndustrialService])
], BusinessIndustrialCatalogWorkspaceController);
//# sourceMappingURL=catalog-workspace.controller.js.map