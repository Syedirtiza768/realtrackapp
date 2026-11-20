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
exports.StoreAccessController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const store_access_service_js_1 = require("./store-access.service.js");
class SetAssignmentDto {
    userId;
    storeId;
    accessLevel;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SetAssignmentDto.prototype, "userId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SetAssignmentDto.prototype, "storeId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['view', 'operate', 'admin']),
    __metadata("design:type", String)
], SetAssignmentDto.prototype, "accessLevel", void 0);
let StoreAccessController = class StoreAccessController {
    storeAccess;
    constructor(storeAccess) {
        this.storeAccess = storeAccess;
    }
    async getUserAssignments(userId) {
        const assignments = await this.storeAccess.getUserAssignments(userId);
        return { assignments };
    }
    async assign(dto, user) {
        await this.storeAccess.assertStoreAccess(user, dto.storeId, 'admin');
        const assignment = await this.storeAccess.setAssignment(dto.userId, dto.storeId, dto.accessLevel);
        return { assignment };
    }
    async unassign(userId, storeId, user) {
        await this.storeAccess.assertStoreAccess(user, storeId, 'admin');
        await this.storeAccess.removeAssignment(userId, storeId);
        return { success: true };
    }
    async updateAssignment(userId, storeId, dto, user) {
        await this.storeAccess.assertStoreAccess(user, storeId, 'admin');
        const assignment = await this.storeAccess.setAssignment(userId, storeId, dto.accessLevel);
        return { assignment };
    }
    async setAccessAll(userId, dto) {
        await this.storeAccess.setAccessAll(userId, dto.enabled);
        return { success: true };
    }
};
exports.StoreAccessController = StoreAccessController;
__decorate([
    (0, common_1.Get)('users/:userId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stores.assign'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StoreAccessController.prototype, "getUserAssignments", null);
__decorate([
    (0, common_1.Post)('assign'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stores.assign'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SetAssignmentDto, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], StoreAccessController.prototype, "assign", null);
__decorate([
    (0, common_1.Delete)('assign/:userId/:storeId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stores.assign'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Param)('storeId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], StoreAccessController.prototype, "unassign", null);
__decorate([
    (0, common_1.Put)('assign/:userId/:storeId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stores.assign'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Param)('storeId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], StoreAccessController.prototype, "updateAssignment", null);
__decorate([
    (0, common_1.Post)('access-all/:userId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('stores.access_all_manage'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StoreAccessController.prototype, "setAccessAll", null);
exports.StoreAccessController = StoreAccessController = __decorate([
    (0, common_1.Controller)('store-access'),
    __metadata("design:paramtypes", [store_access_service_js_1.StoreAccessService])
], StoreAccessController);
//# sourceMappingURL=store-access.controller.js.map