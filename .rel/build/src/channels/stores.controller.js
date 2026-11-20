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
exports.StoresController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const stores_service_js_1 = require("./stores.service.js");
const store_dto_js_1 = require("./dto/store.dto.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
let StoresController = class StoresController {
    storesService;
    constructor(storesService) {
        this.storesService = storesService;
    }
    getStores(connectionId) {
        return this.storesService.getStores(connectionId);
    }
    getStoresByChannel(channel, user) {
        return this.storesService.getStoresByChannel(channel, user);
    }
    getStore(storeId) {
        return this.storesService.getStore(storeId);
    }
    getStoreProfiles(storeId) {
        return this.storesService.getStoreProfiles(storeId);
    }
    createStore(dto) {
        return this.storesService.createStore(dto);
    }
    updateStore(storeId, dto) {
        return this.storesService.updateStore(storeId, dto);
    }
    deleteStore(storeId) {
        return this.storesService.deleteStore(storeId);
    }
    getInstances(listingId, storeId, connectionId, channel, syncStatus) {
        return this.storesService.getInstances({
            listingId,
            storeId,
            connectionId,
            channel,
            syncStatus,
        });
    }
    getInstance(instanceId) {
        return this.storesService.getInstance(instanceId);
    }
    createInstance(dto) {
        return this.storesService.createInstance(dto);
    }
    publishInstance(dto) {
        return this.storesService.publishInstance(dto.instanceId);
    }
    bulkPublishInstances(dto) {
        return this.storesService.bulkPublishInstances(dto.instanceIds);
    }
    endInstance(instanceId) {
        return this.storesService.endInstance(instanceId);
    }
    publishToMultipleStores(dto) {
        return this.storesService.publishToMultipleStores(dto.listingId, dto.storeIds, dto.overrides);
    }
    getListingChannelOverview(listingId) {
        return this.storesService.getListingChannelOverview(listingId);
    }
    getDemoLogs(channel, operationType, listingId, limit, offset) {
        return this.storesService.getDemoLogs({
            channel,
            operationType,
            listingId,
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
    }
    simulateOrder(instanceId) {
        return this.storesService.simulateIncomingOrder(instanceId);
    }
};
exports.StoresController = StoresController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List stores, optionally filtered by connectionId' }),
    __param(0, (0, common_1.Query)('connectionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StoresController.prototype, "getStores", null);
__decorate([
    (0, common_1.Get)('by-channel/:channel'),
    (0, swagger_1.ApiOperation)({
        summary: 'List stores for a specific channel (user-scoped, native OAuth only)',
    }),
    __param(0, (0, common_1.Param)('channel')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], StoresController.prototype, "getStoresByChannel", null);
__decorate([
    (0, common_1.Get)(':storeId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a store by ID' }),
    __param(0, (0, common_1.Param)('storeId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StoresController.prototype, "getStore", null);
__decorate([
    (0, common_1.Get)(':storeId/profiles'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get available shipping, return, and payment profiles for a store',
    }),
    __param(0, (0, common_1.Param)('storeId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StoresController.prototype, "getStoreProfiles", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stores.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new store within a channel connection' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [store_dto_js_1.CreateStoreDto]),
    __metadata("design:returntype", void 0)
], StoresController.prototype, "createStore", null);
__decorate([
    (0, common_1.Put)(':storeId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stores.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a store' }),
    __param(0, (0, common_1.Param)('storeId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, store_dto_js_1.UpdateStoreDto]),
    __metadata("design:returntype", void 0)
], StoresController.prototype, "updateStore", null);
__decorate([
    (0, common_1.Delete)(':storeId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stores.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a store' }),
    __param(0, (0, common_1.Param)('storeId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StoresController.prototype, "deleteStore", null);
__decorate([
    (0, common_1.Get)('instances/list'),
    (0, swagger_1.ApiOperation)({ summary: 'List listing channel instances with filters' }),
    __param(0, (0, common_1.Query)('listingId')),
    __param(1, (0, common_1.Query)('storeId')),
    __param(2, (0, common_1.Query)('connectionId')),
    __param(3, (0, common_1.Query)('channel')),
    __param(4, (0, common_1.Query)('syncStatus')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], StoresController.prototype, "getInstances", null);
__decorate([
    (0, common_1.Get)('instances/:instanceId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a listing channel instance by ID' }),
    __param(0, (0, common_1.Param)('instanceId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StoresController.prototype, "getInstance", null);
__decorate([
    (0, common_1.Post)('instances'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stores.manage'),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a listing channel instance (assign listing to store)',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [store_dto_js_1.CreateInstanceDto]),
    __metadata("design:returntype", void 0)
], StoresController.prototype, "createInstance", null);
__decorate([
    (0, common_1.Post)('instances/publish'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('channels.publish'),
    (0, swagger_1.ApiOperation)({
        summary: 'Publish a listing channel instance to marketplace',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [store_dto_js_1.PublishInstanceDto]),
    __metadata("design:returntype", void 0)
], StoresController.prototype, "publishInstance", null);
__decorate([
    (0, common_1.Post)('instances/bulk-publish'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('channels.publish'),
    (0, swagger_1.ApiOperation)({ summary: 'Bulk publish multiple instances' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [store_dto_js_1.BulkPublishInstancesDto]),
    __metadata("design:returntype", void 0)
], StoresController.prototype, "bulkPublishInstances", null);
__decorate([
    (0, common_1.Post)('instances/:instanceId/end'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('channels.publish'),
    (0, swagger_1.ApiOperation)({ summary: 'End/delist an instance' }),
    __param(0, (0, common_1.Param)('instanceId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StoresController.prototype, "endInstance", null);
__decorate([
    (0, common_1.Post)('publish-multi-store'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('channels.publish'),
    (0, swagger_1.ApiOperation)({ summary: 'Publish a listing to multiple stores at once' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], StoresController.prototype, "publishToMultipleStores", null);
__decorate([
    (0, common_1.Get)('listing/:listingId/overview'),
    (0, swagger_1.ApiOperation)({ summary: 'Get multi-store channel overview for a listing' }),
    __param(0, (0, common_1.Param)('listingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StoresController.prototype, "getListingChannelOverview", null);
__decorate([
    (0, common_1.Get)('demo/logs'),
    (0, swagger_1.ApiOperation)({ summary: 'Get demo simulation logs' }),
    __param(0, (0, common_1.Query)('channel')),
    __param(1, (0, common_1.Query)('operationType')),
    __param(2, (0, common_1.Query)('listingId')),
    __param(3, (0, common_1.Query)('limit')),
    __param(4, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], StoresController.prototype, "getDemoLogs", null);
__decorate([
    (0, common_1.Post)('demo/simulate-order/:instanceId'),
    (0, swagger_1.ApiOperation)({ summary: 'Simulate an incoming order (demo mode)' }),
    __param(0, (0, common_1.Param)('instanceId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StoresController.prototype, "simulateOrder", null);
exports.StoresController = StoresController = __decorate([
    (0, swagger_1.ApiTags)('stores'),
    (0, common_1.Controller)('stores'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stores.view'),
    __metadata("design:paramtypes", [stores_service_js_1.StoresService])
], StoresController);
//# sourceMappingURL=stores.controller.js.map