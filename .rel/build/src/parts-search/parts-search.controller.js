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
exports.PartsSearchController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const parts_search_query_dto_js_1 = require("./dto/parts-search-query.dto.js");
const parts_search_options_dto_js_1 = require("./dto/parts-search-options.dto.js");
const parts_search_images_service_js_1 = require("./parts-search-images.service.js");
const parts_search_options_service_js_1 = require("./parts-search-options.service.js");
const parts_search_service_js_1 = require("./parts-search.service.js");
const PART_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;
let PartsSearchController = class PartsSearchController {
    partsSearch;
    options;
    images;
    constructor(partsSearch, options, images) {
        this.partsSearch = partsSearch;
        this.options = options;
        this.images = images;
    }
    status() {
        return this.partsSearch.status();
    }
    query(dto, user) {
        return this.partsSearch.search(dto, user?.id);
    }
    suggest(dto) {
        return this.partsSearch.suggest(dto.q);
    }
    part(id) {
        if (!PART_ID_RE.test(id))
            throw new common_1.BadRequestException('Invalid part id');
        return this.partsSearch.part(id);
    }
    searchOptions(dto, user) {
        return this.options.options(dto, user);
    }
    select(dto, user) {
        return this.options.select(dto, user);
    }
    createRequest(dto, user) {
        return this.options.request(dto, user);
    }
    updateRequest(id, dto, user) {
        return this.options.updateRequest(id, dto.status, user);
    }
    demand(dto) {
        return this.options.demand(dto.days ?? 7);
    }
    makes() {
        return this.options.vehicles('/makes');
    }
    models(makeId) {
        if (!PART_ID_RE.test(makeId))
            throw new common_1.BadRequestException('Invalid make id');
        return this.options.vehicles(`/makes/${makeId}/models`);
    }
    generations(modelId) {
        if (!PART_ID_RE.test(modelId))
            throw new common_1.BadRequestException('Invalid model id');
        return this.options.vehicles(`/models/${modelId}/generations`);
    }
    configurations(generationId) {
        if (!PART_ID_RE.test(generationId))
            throw new common_1.BadRequestException('Invalid generation id');
        return this.options.vehicles(`/generations/${generationId}/configurations`);
    }
    vin(vin) {
        return this.options.decodeVin(vin);
    }
    partImages(id) {
        if (!PART_ID_RE.test(id))
            throw new common_1.BadRequestException('Invalid part id');
        return this.images.listPartImages(id);
    }
    async partImagesZip(id, res) {
        if (!PART_ID_RE.test(id))
            throw new common_1.BadRequestException('Invalid part id');
        await this.images.downloadPartZip(id, res);
    }
    async partImageDownload(id, index, res) {
        if (!PART_ID_RE.test(id))
            throw new common_1.BadRequestException('Invalid part id');
        if (index < 0 || index > 200)
            throw new common_1.BadRequestException('Invalid image index');
        await this.images.downloadPartImage(id, index, res);
    }
    async omniImageDownload(itemId, user, res) {
        await this.images.downloadOmniImage(itemId, user, res);
    }
};
exports.PartsSearchController = PartsSearchController;
__decorate([
    (0, common_1.Get)('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PartsSearchController.prototype, "status", null);
__decorate([
    (0, common_1.Get)('query'),
    (0, throttler_1.Throttle)({ short: { limit: 5, ttl: 1000 }, medium: { limit: 120, ttl: 60_000 } }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [parts_search_query_dto_js_1.PartsSearchQueryDto, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], PartsSearchController.prototype, "query", null);
__decorate([
    (0, common_1.Get)('suggest'),
    (0, throttler_1.Throttle)({ short: { limit: 20, ttl: 1000 }, medium: { limit: 400, ttl: 60_000 } }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [parts_search_query_dto_js_1.PartsSearchSuggestDto]),
    __metadata("design:returntype", void 0)
], PartsSearchController.prototype, "suggest", null);
__decorate([
    (0, common_1.Get)('parts/:id'),
    (0, throttler_1.Throttle)({ short: { limit: 10, ttl: 1000 } }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PartsSearchController.prototype, "part", null);
__decorate([
    (0, common_1.Get)('options'),
    (0, throttler_1.Throttle)({ short: { limit: 5, ttl: 1000 }, medium: { limit: 120, ttl: 60_000 } }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [parts_search_options_dto_js_1.PartsSearchOptionsDto, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], PartsSearchController.prototype, "searchOptions", null);
__decorate([
    (0, common_1.Post)('events/select'),
    (0, throttler_1.Throttle)({ short: { limit: 10, ttl: 1000 } }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [parts_search_options_dto_js_1.PartsSearchSelectDto, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], PartsSearchController.prototype, "select", null);
__decorate([
    (0, common_1.Post)('requests'),
    (0, throttler_1.Throttle)({ short: { limit: 3, ttl: 1000 }, medium: { limit: 60, ttl: 60_000 } }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [parts_search_options_dto_js_1.PartsSearchRequestDto, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], PartsSearchController.prototype, "createRequest", null);
__decorate([
    (0, common_1.Patch)('requests/:id'),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, parts_search_options_dto_js_1.PartsSearchRequestStatusDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], PartsSearchController.prototype, "updateRequest", null);
__decorate([
    (0, common_1.Get)('demand'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [parts_search_options_dto_js_1.PartsSearchDemandQueryDto]),
    __metadata("design:returntype", void 0)
], PartsSearchController.prototype, "demand", null);
__decorate([
    (0, common_1.Get)('vehicles/makes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PartsSearchController.prototype, "makes", null);
__decorate([
    (0, common_1.Get)('vehicles/makes/:makeId/models'),
    __param(0, (0, common_1.Param)('makeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PartsSearchController.prototype, "models", null);
__decorate([
    (0, common_1.Get)('vehicles/models/:modelId/generations'),
    __param(0, (0, common_1.Param)('modelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PartsSearchController.prototype, "generations", null);
__decorate([
    (0, common_1.Get)('vehicles/generations/:generationId/configurations'),
    __param(0, (0, common_1.Param)('generationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PartsSearchController.prototype, "configurations", null);
__decorate([
    (0, common_1.Get)('vin/:vin'),
    (0, throttler_1.Throttle)({ short: { limit: 2, ttl: 1000 }, medium: { limit: 30, ttl: 60_000 } }),
    __param(0, (0, common_1.Param)('vin')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PartsSearchController.prototype, "vin", null);
__decorate([
    (0, common_1.Get)('parts/:id/images'),
    (0, throttler_1.Throttle)({ short: { limit: 10, ttl: 1000 } }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PartsSearchController.prototype, "partImages", null);
__decorate([
    (0, common_1.Get)('parts/:id/images/zip'),
    (0, throttler_1.Throttle)({ short: { limit: 1, ttl: 1000 }, medium: { limit: 20, ttl: 60_000 } }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PartsSearchController.prototype, "partImagesZip", null);
__decorate([
    (0, common_1.Get)('parts/:id/images/:index/download'),
    (0, throttler_1.Throttle)({ short: { limit: 5, ttl: 1000 }, medium: { limit: 120, ttl: 60_000 } }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('index', new common_1.ParseIntPipe())),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Object]),
    __metadata("design:returntype", Promise)
], PartsSearchController.prototype, "partImageDownload", null);
__decorate([
    (0, common_1.Get)('omni/:itemId/image/download'),
    (0, throttler_1.Throttle)({ short: { limit: 5, ttl: 1000 } }),
    __param(0, (0, common_1.Param)('itemId', new common_1.ParseUUIDPipe())),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User, Object]),
    __metadata("design:returntype", Promise)
], PartsSearchController.prototype, "omniImageDownload", null);
exports.PartsSearchController = PartsSearchController = __decorate([
    (0, swagger_1.ApiTags)('parts-search'),
    (0, common_1.Controller)('parts-search'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('dashboard.view'),
    __metadata("design:paramtypes", [parts_search_service_js_1.PartsSearchService,
        parts_search_options_service_js_1.PartsSearchOptionsService,
        parts_search_images_service_js_1.PartsSearchImagesService])
], PartsSearchController);
//# sourceMappingURL=parts-search.controller.js.map