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
exports.RbacRolesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const require_permissions_decorator_js_1 = require("./decorators/require-permissions.decorator.js");
const rbac_admin_dto_js_1 = require("./dto/rbac-admin.dto.js");
const rbac_service_js_1 = require("./rbac.service.js");
let RbacRolesController = class RbacRolesController {
    rbac;
    constructor(rbac) {
        this.rbac = rbac;
    }
    async createRole(body) {
        const role = await this.rbac.createRole(body);
        return {
            id: role.id,
            slug: role.slug,
            name: role.name,
            description: role.description,
            isSystem: role.isSystem,
            isCustomized: role.isCustomized,
            permissions: [],
        };
    }
    async getSidebarConfigs() {
        return this.rbac.getSidebarConfigs();
    }
    async setSidebarConfigs(body) {
        await this.rbac.setSidebarConfigs(body.configs);
        return { ok: true };
    }
    async getMySidebarConfig(user) {
        const visible = await this.rbac.getVisibleModulesForUser(user.id);
        return { visibleModules: visible };
    }
    async updateRole(id, body) {
        const role = await this.rbac.updateRole(id, body);
        return {
            id: role.id,
            slug: role.slug,
            name: role.name,
            description: role.description,
        };
    }
    async deleteRole(id) {
        await this.rbac.deleteRole(id);
        return { ok: true };
    }
    async setRolePermissions(id, body) {
        const role = await this.rbac.setRolePermissions(id, body.permissionKeys);
        return { ok: true, isCustomized: role.isCustomized };
    }
    async removeRolePermission(id, permId) {
        await this.rbac.removeRolePermission(id, permId);
        return { ok: true };
    }
    async resetToDefaults(id) {
        const role = await this.rbac.resetRoleToDefaults(id);
        return { ok: true, isCustomized: role.isCustomized };
    }
};
exports.RbacRolesController = RbacRolesController;
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_js_1.RequirePermissions)('roles.create'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a custom role' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [rbac_admin_dto_js_1.CreateRoleDto]),
    __metadata("design:returntype", Promise)
], RbacRolesController.prototype, "createRole", null);
__decorate([
    (0, common_1.Get)('sidebar-config'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('roles.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all sidebar module visibility configs' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RbacRolesController.prototype, "getSidebarConfigs", null);
__decorate([
    (0, common_1.Patch)('sidebar-config'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('roles.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Set sidebar module visibility for roles' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [rbac_admin_dto_js_1.SetSidebarConfigDto]),
    __metadata("design:returntype", Promise)
], RbacRolesController.prototype, "setSidebarConfigs", null);
__decorate([
    (0, common_1.Get)('sidebar-config/me'),
    (0, swagger_1.ApiOperation)({ summary: 'Get visible sidebar modules for current user' }),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], RbacRolesController.prototype, "getMySidebarConfig", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('roles.update'),
    (0, swagger_1.ApiOperation)({ summary: 'Update role name/description' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, rbac_admin_dto_js_1.UpdateRoleDto]),
    __metadata("design:returntype", Promise)
], RbacRolesController.prototype, "updateRole", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('roles.delete'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a custom role' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RbacRolesController.prototype, "deleteRole", null);
__decorate([
    (0, common_1.Post)(':id/permissions'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('roles.assign_permissions'),
    (0, swagger_1.ApiOperation)({
        summary: 'Set all permissions for a role (replaces existing)',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, rbac_admin_dto_js_1.SetRolePermissionsDto]),
    __metadata("design:returntype", Promise)
], RbacRolesController.prototype, "setRolePermissions", null);
__decorate([
    (0, common_1.Delete)(':id/permissions/:permId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('roles.assign_permissions'),
    (0, swagger_1.ApiOperation)({ summary: 'Remove a permission from a role' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('permId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], RbacRolesController.prototype, "removeRolePermission", null);
__decorate([
    (0, common_1.Post)(':id/reset'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('roles.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Reset a system role to its default permissions' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RbacRolesController.prototype, "resetToDefaults", null);
exports.RbacRolesController = RbacRolesController = __decorate([
    (0, swagger_1.ApiTags)('rbac-roles'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('rbac/roles'),
    __metadata("design:paramtypes", [rbac_service_js_1.RbacService])
], RbacRolesController);
//# sourceMappingURL=rbac-roles.controller.js.map