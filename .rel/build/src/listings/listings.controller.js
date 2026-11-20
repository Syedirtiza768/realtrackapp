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
exports.ListingsController = void 0;
const common_1 = require("@nestjs/common");
const bulk_update_dto_1 = require("./dto/bulk-update.dto");
const bulk_profiles_dto_1 = require("./dto/bulk-profiles.dto");
const create_listing_dto_1 = require("./dto/create-listing.dto");
const listings_query_dto_1 = require("./dto/listings-query.dto");
const patch_status_dto_1 = require("./dto/patch-status.dto");
const search_query_dto_1 = require("./dto/search-query.dto");
const update_listing_dto_1 = require("./dto/update-listing.dto");
const listings_service_1 = require("./listings.service");
const search_service_1 = require("./search.service");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
let ListingsController = class ListingsController {
    listingsService;
    searchService;
    constructor(listingsService, searchService) {
        this.listingsService = listingsService;
        this.searchService = searchService;
    }
    search(query, user) {
        return this.searchService.search(query, user);
    }
    suggest(q, limit, user) {
        return this.searchService.suggest(q ?? '', Number(limit) || 10, user);
    }
    dynamicFacets(query, user) {
        return this.searchService.dynamicFacets(query, user);
    }
    create(dto, user) {
        return this.listingsService.create(dto, user);
    }
    update(id, dto, user) {
        return this.listingsService.update(id, dto, user);
    }
    patchStatus(id, dto, user) {
        return this.listingsService.patchStatus(id, dto, user);
    }
    softDelete(id, user) {
        return this.listingsService.softDelete(id, user);
    }
    restore(id, user) {
        return this.listingsService.restore(id, user);
    }
    bulkUpdate(dto, user) {
        return this.listingsService.bulkUpdate(dto, user);
    }
    bulkApplyProfiles(dto, user) {
        return this.listingsService.bulkApplyProfiles(dto, user);
    }
    bulkDelete(body, user) {
        return this.listingsService.bulkSoftDelete(body.ids, user);
    }
    async exportCsv(query, res, user) {
        const csv = await this.listingsService.exportCsv(query, user);
        const dateStr = new Date().toISOString().slice(0, 10);
        res.set({
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="listings-export-${dateStr}.csv"`,
        });
        res.send(csv);
    }
    getRevisions(id, limit, offset, user) {
        return this.listingsService.getRevisions(id, Number(limit) || 20, Number(offset) || 0, user);
    }
    findAll(query, user) {
        return this.listingsService.findAll(query, user);
    }
    getSummary(user, vertical) {
        return this.listingsService.getSummary(user, vertical);
    }
    getFacets(user) {
        return this.listingsService.getFacets(user);
    }
    findOne(id, user) {
        return this.listingsService.findOne(id, user);
    }
    importListings() {
        const folder = process.env.LISTINGS_FOLDER_PATH ??
            '../files/_same_structure_as_B20_eBay_Verified_2-Oct';
        return this.listingsService.importFromFolder(folder);
    }
};
exports.ListingsController = ListingsController;
__decorate([
    (0, common_1.Get)('search'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.view'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [search_query_dto_1.SearchQueryDto, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('search/suggest'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.view'),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "suggest", null);
__decorate([
    (0, common_1.Get)('search/facets'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.view'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [search_query_dto_1.SearchQueryDto, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "dynamicFacets", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_listing_dto_1.CreateListingDto, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_listing_dto_1.UpdateListingDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, patch_status_dto_1.PatchStatusDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "patchStatus", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.delete'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "softDelete", null);
__decorate([
    (0, common_1.Post)(':id/restore'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "restore", null);
__decorate([
    (0, common_1.Post)('bulk'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.update'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bulk_update_dto_1.BulkUpdateDto, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "bulkUpdate", null);
__decorate([
    (0, common_1.Post)('bulk-profiles'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.update'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bulk_profiles_dto_1.BulkProfilesDto, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "bulkApplyProfiles", null);
__decorate([
    (0, common_1.Post)('bulk-delete'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "bulkDelete", null);
__decorate([
    (0, common_1.Get)('export'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.export'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [search_query_dto_1.SearchQueryDto, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], ListingsController.prototype, "exportCsv", null);
__decorate([
    (0, common_1.Get)(':id/revisions'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __param(3, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "getRevisions", null);
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.view'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [listings_query_dto_1.ListingsQueryDto, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('summary'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('vertical')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)('facets'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "getFacets", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.import'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "importListings", null);
exports.ListingsController = ListingsController = __decorate([
    (0, common_1.Controller)('listings'),
    __metadata("design:paramtypes", [listings_service_1.ListingsService,
        search_service_1.SearchService])
], ListingsController);
//# sourceMappingURL=listings.controller.js.map