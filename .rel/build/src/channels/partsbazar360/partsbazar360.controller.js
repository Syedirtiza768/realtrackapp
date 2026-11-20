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
exports.PartsBazar360Controller = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_js_1 = require("../../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../../auth/entities/user.entity.js");
const require_permissions_decorator_js_1 = require("../../rbac/decorators/require-permissions.decorator.js");
const partsbazar360_dto_js_1 = require("./partsbazar360.dto.js");
const partsbazar360_service_js_1 = require("./partsbazar360.service.js");
let PartsBazar360Controller = class PartsBazar360Controller {
    partsbazar;
    constructor(partsbazar) {
        this.partsbazar = partsbazar;
    }
    status() {
        return this.partsbazar.getStatus();
    }
    connect(dto, user) {
        return this.partsbazar.connect(user.id, dto);
    }
    refresh(listingId) {
        return this.partsbazar.refresh(listingId);
    }
};
exports.PartsBazar360Controller = PartsBazar360Controller;
__decorate([
    (0, common_1.Get)('status'),
    (0, swagger_1.ApiOperation)({
        summary: 'Whether PartsBazar360 publishing is configured, and its sellers',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PartsBazar360Controller.prototype, "status", null);
__decorate([
    (0, common_1.Post)('connect'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('channels.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Link a PartsBazar360 seller as a publish destination (verified live)',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [partsbazar360_dto_js_1.ConnectPartsBazar360Dto, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], PartsBazar360Controller.prototype, "connect", null);
__decorate([
    (0, common_1.Post)('listings/:listingId/refresh'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('channels.publish'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: "Re-check a listing's import state on PartsBazar360",
    }),
    __param(0, (0, common_1.Param)('listingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PartsBazar360Controller.prototype, "refresh", null);
exports.PartsBazar360Controller = PartsBazar360Controller = __decorate([
    (0, swagger_1.ApiTags)('channels'),
    (0, common_1.Controller)('channels/partsbazar360'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('channels.view'),
    __metadata("design:paramtypes", [partsbazar360_service_js_1.PartsBazar360Service])
], PartsBazar360Controller);
//# sourceMappingURL=partsbazar360.controller.js.map