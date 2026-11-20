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
exports.MotoarkController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_js_1 = require("../../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../../auth/entities/user.entity.js");
const require_permissions_decorator_js_1 = require("../../rbac/decorators/require-permissions.decorator.js");
const ebay_integration_permissions_service_js_1 = require("../ebay/services/ebay-integration-permissions.service.js");
const motoark_dto_js_1 = require("./motoark.dto.js");
const motoark_service_js_1 = require("./motoark.service.js");
let MotoarkController = class MotoarkController {
    service;
    permissions;
    constructor(service, permissions) {
        this.service = service;
        this.permissions = permissions;
    }
    async accept(dto, user, organizationId, timestamp, signature, request) {
        const org = (await this.permissions.resolveOrganization(user.id, organizationId));
        return this.service.accept(org.organizationId, user, dto, request.rawBody ?? Buffer.alloc(0), timestamp, signature);
    }
    async get(eventId, user, organizationId) {
        const org = (await this.permissions.resolveOrganization(user.id, organizationId));
        return this.service.get(org.organizationId, user, eventId);
    }
    async quantity(listingId, user, organizationId) {
        const org = (await this.permissions.resolveOrganization(user.id, organizationId));
        return this.service.quantity(org.organizationId, user, listingId);
    }
};
exports.MotoarkController = MotoarkController;
__decorate([
    (0, common_1.Post)('order-events'),
    (0, common_1.HttpCode)(202),
    (0, require_permissions_decorator_js_1.RequirePermissions)('motoark.orders.notify'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __param(3, (0, common_1.Headers)('x-primemotive-timestamp')),
    __param(4, (0, common_1.Headers)('x-primemotive-signature')),
    __param(5, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [motoark_dto_js_1.MotoarkOrderEventDto,
        user_entity_js_1.User, Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], MotoarkController.prototype, "accept", null);
__decorate([
    (0, common_1.Get)('order-events/:eventId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('motoark.orders.view'),
    __param(0, (0, common_1.Param)('eventId')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User, String]),
    __metadata("design:returntype", Promise)
], MotoarkController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('quantities/:listingId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('motoark.orders.view'),
    __param(0, (0, common_1.Param)('listingId', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User, String]),
    __metadata("design:returntype", Promise)
], MotoarkController.prototype, "quantity", null);
exports.MotoarkController = MotoarkController = __decorate([
    (0, swagger_1.ApiTags)('motoark'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('integrations/motoark'),
    __metadata("design:paramtypes", [motoark_service_js_1.MotoarkService,
        ebay_integration_permissions_service_js_1.EbayIntegrationPermissionsService])
], MotoarkController);
//# sourceMappingURL=motoark.controller.js.map