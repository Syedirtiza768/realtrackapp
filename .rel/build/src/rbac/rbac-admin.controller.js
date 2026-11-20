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
exports.RbacAdminController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const bcrypt = __importStar(require("bcrypt"));
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const auth_service_js_1 = require("../auth/auth.service.js");
const auth_audit_service_js_1 = require("../auth/auth-audit.service.js");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const role_entity_js_1 = require("./entities/role.entity.js");
const permission_entity_js_1 = require("./entities/permission.entity.js");
const require_permissions_decorator_js_1 = require("./decorators/require-permissions.decorator.js");
const rbac_admin_dto_js_1 = require("./dto/rbac-admin.dto.js");
const permission_registry_js_1 = require("./permission-registry.js");
const rbac_service_js_1 = require("./rbac.service.js");
const user_organization_service_js_1 = require("../auth/user-organization.service.js");
const organization_member_entity_js_1 = require("../auth/entities/organization-member.entity.js");
const SALT_ROUNDS = 12;
function legacyUserRoleFromSlug(slug) {
    switch (slug) {
        case permission_registry_js_1.ROLE_SLUGS.STAFF:
            return 'user';
        case permission_registry_js_1.ROLE_SLUGS.SUPER_ADMIN:
            return 'super_admin';
        case permission_registry_js_1.ROLE_SLUGS.ADMIN:
            return 'admin';
        case permission_registry_js_1.ROLE_SLUGS.MANAGER:
            return 'manager';
        case permission_registry_js_1.ROLE_SLUGS.VIEWER:
            return 'viewer';
        default:
            return 'user';
    }
}
let RbacAdminController = class RbacAdminController {
    userRepo;
    roleRepo;
    permissionRepo;
    memberRepo;
    rbac;
    auth;
    authAudit;
    userOrgs;
    constructor(userRepo, roleRepo, permissionRepo, memberRepo, rbac, auth, authAudit, userOrgs) {
        this.userRepo = userRepo;
        this.roleRepo = roleRepo;
        this.permissionRepo = permissionRepo;
        this.memberRepo = memberRepo;
        this.rbac = rbac;
        this.auth = auth;
        this.authAudit = authAudit;
        this.userOrgs = userOrgs;
    }
    listPermissions() {
        return this.permissionRepo.find({ order: { module: 'ASC', key: 'ASC' } });
    }
    async listRoles() {
        const roles = await this.roleRepo.find({
            relations: ['rolePermissions', 'rolePermissions.permission'],
            order: { slug: 'ASC' },
        });
        return roles.map((r) => ({
            id: r.id,
            slug: r.slug,
            name: r.name,
            description: r.description,
            isSystem: r.isSystem,
            isCustomized: r.isCustomized,
            permissions: (r.rolePermissions ?? [])
                .map((rp) => rp.permission?.key)
                .filter(Boolean),
        }));
    }
    async listUsers() {
        const users = await this.userRepo.find({ order: { createdAt: 'DESC' } });
        return Promise.all(users.map(async (u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            active: u.active,
            lastLoginAt: u.lastLoginAt,
            createdAt: u.createdAt,
            profile: await this.rbac.getAuthProfile(u),
        })));
    }
    async createUser(body, actor) {
        const email = body.email.toLowerCase();
        const existing = await this.userRepo.findOne({ where: { email } });
        if (existing) {
            return { error: 'Email already registered' };
        }
        const user = await this.userRepo.save(this.userRepo.create({
            email,
            name: body.name ?? null,
            passwordHash: await bcrypt.hash(body.password, SALT_ROUNDS),
            role: legacyUserRoleFromSlug(body.roleSlug),
            active: true,
            storeAccessAll: true,
        }));
        await this.rbac.assignPrimaryRole(user.id, body.roleSlug);
        try {
            const orgs = await this.userOrgs.listForUser(actor.id);
            if (orgs.length > 0) {
                const existing = await this.memberRepo.findOne({
                    where: { userId: user.id, organizationId: orgs[0].organizationId },
                });
                if (!existing) {
                    await this.memberRepo.save(this.memberRepo.create({
                        userId: user.id,
                        organizationId: orgs[0].organizationId,
                        role: 'editor',
                    }));
                }
            }
        }
        catch {
        }
        return this.rbac.getAuthProfile(user);
    }
    async assignRole(userId, body, actor) {
        if (body.roleSlug === 'super_admin' && actor.role !== 'super_admin') {
            return { error: 'Only Super Admin can assign Super Admin role' };
        }
        const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
        user.role = legacyUserRoleFromSlug(body.roleSlug);
        await this.userRepo.save(user);
        await this.rbac.assignPrimaryRole(userId, body.roleSlug);
        return this.rbac.getAuthProfile(user);
    }
    async deactivate(id) {
        const user = await this.userRepo.findOneOrFail({ where: { id } });
        if (user.role === 'super_admin') {
            const superAdmins = await this.userRepo.count({
                where: { role: 'super_admin', active: true },
            });
            if (superAdmins <= 1) {
                return { error: 'Cannot deactivate the last Super Admin' };
            }
        }
        user.active = false;
        await this.userRepo.save(user);
        return { ok: true };
    }
    async resetPassword(id, body, actor, req) {
        await this.auth.adminResetPassword(id, body.newPassword);
        await this.authAudit.log('auth.admin_password_reset', {
            actorId: actor.id,
            entityId: id,
            metadata: { targetUserId: id },
            req,
        });
        return { ok: true };
    }
    async addOrgMember(body, actor) {
        const orgs = body.organizationId
            ? [{ organizationId: body.organizationId }]
            : await this.userOrgs.listForUser(actor.id);
        if (orgs.length === 0) {
            return { error: 'No organization found' };
        }
        const orgId = orgs[0].organizationId;
        const existing = await this.memberRepo.findOne({
            where: { userId: body.userId, organizationId: orgId },
        });
        if (existing) {
            return { ok: true, message: 'Already a member', memberId: existing.id };
        }
        const member = await this.memberRepo.save(this.memberRepo.create({
            userId: body.userId,
            organizationId: orgId,
            role: (['owner', 'admin', 'editor'].includes(body.role ?? '')
                ? body.role
                : 'editor'),
        }));
        return {
            ok: true,
            memberId: member.id,
            organizationId: orgId,
            role: member.role,
        };
    }
};
exports.RbacAdminController = RbacAdminController;
__decorate([
    (0, common_1.Get)('permissions'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('roles.view'),
    (0, swagger_1.ApiOperation)({ summary: 'List all permissions' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RbacAdminController.prototype, "listPermissions", null);
__decorate([
    (0, common_1.Get)('roles'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('roles.view'),
    (0, swagger_1.ApiOperation)({ summary: 'List roles with permission keys' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RbacAdminController.prototype, "listRoles", null);
__decorate([
    (0, common_1.Get)('users'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('users.view'),
    (0, swagger_1.ApiOperation)({ summary: 'List users' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RbacAdminController.prototype, "listUsers", null);
__decorate([
    (0, common_1.Post)('users'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('users.create'),
    (0, swagger_1.ApiOperation)({ summary: 'Create user' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [rbac_admin_dto_js_1.CreateRbacUserDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], RbacAdminController.prototype, "createUser", null);
__decorate([
    (0, common_1.Patch)('users/:id/role'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('roles.assign'),
    (0, swagger_1.ApiOperation)({ summary: 'Assign primary role to user' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, rbac_admin_dto_js_1.AssignRoleDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], RbacAdminController.prototype, "assignRole", null);
__decorate([
    (0, common_1.Patch)('users/:id/deactivate'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('users.deactivate'),
    (0, swagger_1.ApiOperation)({ summary: 'Deactivate user' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RbacAdminController.prototype, "deactivate", null);
__decorate([
    (0, common_1.Patch)('users/:id/reset-password'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('users.reset_password'),
    (0, swagger_1.ApiOperation)({ summary: 'Admin reset a user password' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, rbac_admin_dto_js_1.ResetPasswordDto,
        user_entity_js_1.User, Object]),
    __metadata("design:returntype", Promise)
], RbacAdminController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Post)('org/add-member'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('users.create'),
    (0, swagger_1.ApiOperation)({
        summary: 'Add a user to an organization (defaults to actor org)',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], RbacAdminController.prototype, "addOrgMember", null);
exports.RbacAdminController = RbacAdminController = __decorate([
    (0, swagger_1.ApiTags)('rbac-admin'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('rbac'),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_js_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(role_entity_js_1.Role)),
    __param(2, (0, typeorm_1.InjectRepository)(permission_entity_js_1.Permission)),
    __param(3, (0, typeorm_1.InjectRepository)(organization_member_entity_js_1.OrganizationMember)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        rbac_service_js_1.RbacService,
        auth_service_js_1.AuthService,
        auth_audit_service_js_1.AuthAuditService,
        user_organization_service_js_1.UserOrganizationService])
], RbacAdminController);
//# sourceMappingURL=rbac-admin.controller.js.map