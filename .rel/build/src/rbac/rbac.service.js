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
var RbacService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RbacService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const permission_entity_js_1 = require("./entities/permission.entity.js");
const role_permission_entity_js_1 = require("./entities/role-permission.entity.js");
const role_entity_js_1 = require("./entities/role.entity.js");
const sidebar_module_config_entity_js_1 = require("./entities/sidebar-module-config.entity.js");
const user_role_assignment_entity_js_1 = require("./entities/user-role-assignment.entity.js");
const permission_registry_js_1 = require("./permission-registry.js");
let RbacService = RbacService_1 = class RbacService {
    roleRepo;
    permissionRepo;
    rolePermissionRepo;
    userRoleRepo;
    sidebarConfigRepo;
    userRepo;
    config;
    logger = new common_1.Logger(RbacService_1.name);
    syncInFlight = null;
    constructor(roleRepo, permissionRepo, rolePermissionRepo, userRoleRepo, sidebarConfigRepo, userRepo, config) {
        this.roleRepo = roleRepo;
        this.permissionRepo = permissionRepo;
        this.rolePermissionRepo = rolePermissionRepo;
        this.userRoleRepo = userRoleRepo;
        this.sidebarConfigRepo = sidebarConfigRepo;
        this.userRepo = userRepo;
        this.config = config;
    }
    async onModuleInit() {
        const sync = this.config.get('RBAC_SYNC_PERMISSIONS', 'true') === 'true';
        if (!sync)
            return;
        await this.syncFromRegistry();
        await this.syncLegacyUserRoles();
    }
    async syncFromRegistry() {
        if (this.syncInFlight) {
            return this.syncInFlight;
        }
        this.syncInFlight = this.doSyncFromRegistry().finally(() => {
            this.syncInFlight = null;
        });
        return this.syncInFlight;
    }
    async doSyncFromRegistry() {
        for (const def of permission_registry_js_1.PERMISSION_REGISTRY) {
            let perm = await this.permissionRepo.findOne({ where: { key: def.key } });
            if (!perm) {
                perm = this.permissionRepo.create({
                    key: def.key,
                    label: def.label,
                    module: def.module,
                    description: def.description ?? null,
                });
            }
            else {
                perm.label = def.label;
                perm.module = def.module;
                perm.description = def.description ?? null;
            }
            await this.permissionRepo.save(perm);
        }
        for (const roleDef of permission_registry_js_1.ROLE_DEFINITIONS) {
            let role = await this.roleRepo.findOne({ where: { slug: roleDef.slug } });
            if (!role) {
                role = this.roleRepo.create({
                    slug: roleDef.slug,
                    name: roleDef.name,
                    description: roleDef.description,
                    isSystem: roleDef.isSystem,
                });
                await this.roleRepo.save(role);
            }
            if (role.isCustomized) {
                this.logger.debug(`Skipping permission sync for customized role: ${role.slug}`);
                continue;
            }
            const permKeys = permission_registry_js_1.PERMISSION_REGISTRY.filter((p) => p.defaultRoles?.includes(roleDef.slug)).map((p) => p.key);
            const permissions = await this.permissionRepo.find({
                where: { key: (0, typeorm_2.In)(permKeys) },
            });
            const permissionIds = new Set(permissions.map((p) => p.id));
            const existing = await this.rolePermissionRepo.find({
                where: { roleId: role.id },
            });
            const existingIds = new Set(existing.map((e) => e.permissionId));
            for (const perm of permissions) {
                if (existingIds.has(perm.id))
                    continue;
                const exists = await this.rolePermissionRepo.findOne({
                    where: { roleId: role.id, permissionId: perm.id },
                });
                if (exists)
                    continue;
                try {
                    await this.rolePermissionRepo.save(this.rolePermissionRepo.create({
                        roleId: role.id,
                        permissionId: perm.id,
                    }));
                }
                catch (err) {
                    const code = err && typeof err === 'object' && 'code' in err
                        ? String(err.code)
                        : '';
                    if (code !== '23505')
                        throw err;
                }
            }
            for (const row of existing) {
                if (!permissionIds.has(row.permissionId)) {
                    await this.rolePermissionRepo.delete({ id: row.id });
                }
            }
        }
        await this.ensureAllRolesCanPublish();
        this.logger.log('RBAC registry synced');
    }
    async ensureAllRolesCanPublish() {
        const permissions = await this.permissionRepo.find({
            where: { key: (0, typeorm_2.In)([...permission_registry_js_1.ALL_USERS_PUBLISH_PERMISSION_KEYS]) },
        });
        const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission]));
        const missingDefinitions = permission_registry_js_1.ALL_USERS_PUBLISH_PERMISSION_KEYS.filter((key) => !permissionByKey.has(key));
        if (missingDefinitions.length) {
            throw new Error(`Missing publish permissions in registry sync: ${missingDefinitions.join(', ')}`);
        }
        const roles = await this.roleRepo.find({ relations: ['rolePermissions'] });
        let added = 0;
        for (const role of roles) {
            if (role.slug.startsWith('fashion_') ||
                role.slug.startsWith('business_industrial_'))
                continue;
            const existing = new Set((role.rolePermissions ?? []).map((assignment) => assignment.permissionId));
            for (const key of permission_registry_js_1.ALL_USERS_PUBLISH_PERMISSION_KEYS) {
                const permission = permissionByKey.get(key);
                if (existing.has(permission.id))
                    continue;
                await this.rolePermissionRepo.save(this.rolePermissionRepo.create({
                    roleId: role.id,
                    permissionId: permission.id,
                }));
                existing.add(permission.id);
                added += 1;
            }
        }
        if (added) {
            this.logger.warn(`Granted publish permissions to ${added} role assignment(s)`);
        }
    }
    async syncLegacyUserRoles() {
        const users = await this.userRepo.find();
        for (const user of users) {
            const hasAssignment = await this.userRoleRepo.findOne({
                where: { userId: user.id, isPrimary: true },
            });
            if (hasAssignment)
                continue;
            const slug = permission_registry_js_1.LEGACY_USER_ROLE_TO_SLUG[user.role] ??
                (user.role === 'admin' ? permission_registry_js_1.ROLE_SLUGS.ADMIN : permission_registry_js_1.ROLE_SLUGS.STAFF);
            await this.assignPrimaryRole(user.id, slug);
        }
    }
    async getRoleBySlug(slug) {
        return this.roleRepo.findOne({ where: { slug } });
    }
    async assignPrimaryRole(userId, roleSlug) {
        const role = await this.roleRepo.findOne({ where: { slug: roleSlug } });
        if (!role)
            throw new Error(`Role not found: ${roleSlug}`);
        await this.userRoleRepo.update({ userId, isPrimary: true }, { isPrimary: false });
        const existing = await this.userRoleRepo.findOne({
            where: { userId, roleId: role.id },
        });
        if (existing) {
            existing.isPrimary = true;
            await this.userRoleRepo.save(existing);
        }
        else {
            await this.userRoleRepo.save(this.userRoleRepo.create({ userId, roleId: role.id, isPrimary: true }));
        }
    }
    async getPermissionKeysForUser(userId) {
        const assignments = await this.userRoleRepo.find({
            where: { userId },
            relations: [
                'role',
                'role.rolePermissions',
                'role.rolePermissions.permission',
            ],
        });
        const keys = new Set();
        for (const assignment of assignments) {
            for (const rp of assignment.role?.rolePermissions ?? []) {
                if (rp.permission?.key)
                    keys.add(rp.permission.key);
            }
        }
        if (keys.size === 0) {
            const user = await this.userRepo.findOne({ where: { id: userId } });
            if (user) {
                const slug = permission_registry_js_1.LEGACY_USER_ROLE_TO_SLUG[user.role] ?? permission_registry_js_1.ROLE_SLUGS.STAFF;
                const role = await this.roleRepo.findOne({
                    where: { slug },
                    relations: ['rolePermissions', 'rolePermissions.permission'],
                });
                for (const rp of role?.rolePermissions ?? []) {
                    if (rp.permission?.key)
                        keys.add(rp.permission.key);
                }
            }
        }
        return keys;
    }
    async userHasPermission(userId, permissionKey) {
        const keys = await this.getPermissionKeysForUser(userId);
        return keys.has(permissionKey);
    }
    async getAuthProfile(user) {
        const permissions = [
            ...(await this.getPermissionKeysForUser(user.id)),
        ].sort();
        const primary = await this.userRoleRepo.findOne({
            where: { userId: user.id, isPrimary: true },
            relations: ['role'],
        });
        const roleSlug = primary?.role?.slug ?? permission_registry_js_1.LEGACY_USER_ROLE_TO_SLUG[user.role] ?? user.role;
        const role = primary?.role ?? (await this.getRoleBySlug(roleSlug));
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            active: user.active,
            role: user.role,
            roleSlug,
            roleName: role?.name ?? roleSlug,
            permissions,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
        };
    }
    async createRole(dto) {
        const existing = await this.roleRepo.findOne({ where: { slug: dto.slug } });
        if (existing)
            throw new common_1.BadRequestException(`Role slug "${dto.slug}" already exists`);
        const role = this.roleRepo.create({
            slug: dto.slug,
            name: dto.name,
            description: dto.description ?? null,
            isSystem: false,
        });
        const saved = await this.roleRepo.save(role);
        await this.ensureRoleCanPublish(saved.id);
        return saved;
    }
    async ensureRoleCanPublish(roleId) {
        const role = await this.roleRepo.findOne({ where: { id: roleId } });
        if (role?.slug.startsWith('fashion_') ||
            role?.slug.startsWith('business_industrial_'))
            return;
        const permissions = await this.permissionRepo.find({
            where: { key: (0, typeorm_2.In)([...permission_registry_js_1.ALL_USERS_PUBLISH_PERMISSION_KEYS]) },
        });
        const existing = await this.rolePermissionRepo.find({ where: { roleId } });
        const existingIds = new Set(existing.map((assignment) => assignment.permissionId));
        for (const permission of permissions) {
            if (existingIds.has(permission.id))
                continue;
            await this.rolePermissionRepo.save(this.rolePermissionRepo.create({
                roleId,
                permissionId: permission.id,
            }));
        }
    }
    async updateRole(id, dto) {
        const role = await this.roleRepo.findOneOrFail({ where: { id } });
        if (dto.name !== undefined)
            role.name = dto.name;
        if (dto.description !== undefined)
            role.description = dto.description;
        return this.roleRepo.save(role);
    }
    async deleteRole(id) {
        const role = await this.roleRepo.findOneOrFail({
            where: { id },
            relations: ['userAssignments'],
        });
        if (role.isSystem)
            throw new common_1.BadRequestException('Cannot delete system roles');
        if ((role.userAssignments?.length ?? 0) > 0) {
            throw new common_1.BadRequestException('Cannot delete role with assigned users. Reassign them first.');
        }
        await this.rolePermissionRepo.delete({ roleId: id });
        await this.roleRepo.delete(id);
    }
    async setRolePermissions(roleId, permissionKeys) {
        const role = await this.roleRepo.findOneOrFail({ where: { id: roleId } });
        const validKeys = new Set(permission_registry_js_1.PERMISSION_REGISTRY.map((p) => p.key));
        const invalid = permissionKeys.filter((k) => !validKeys.has(k));
        if (invalid.length) {
            throw new common_1.BadRequestException(`Unknown permissions: ${invalid.join(', ')}`);
        }
        const enforcedPublishKeys = role.slug.startsWith('fashion_') ||
            role.slug.startsWith('business_industrial_')
            ? []
            : permission_registry_js_1.ALL_USERS_PUBLISH_PERMISSION_KEYS;
        const effectivePermissionKeys = [
            ...new Set([...permissionKeys, ...enforcedPublishKeys]),
        ];
        const permissions = await this.permissionRepo.find({
            where: { key: (0, typeorm_2.In)(effectivePermissionKeys) },
        });
        await this.rolePermissionRepo.delete({ roleId });
        for (const perm of permissions) {
            await this.rolePermissionRepo.save(this.rolePermissionRepo.create({ roleId, permissionId: perm.id }));
        }
        if (role.isSystem && !role.isCustomized) {
            role.isCustomized = true;
            await this.roleRepo.save(role);
        }
        return role;
    }
    async removeRolePermission(roleId, permissionId) {
        const permission = await this.permissionRepo.findOne({
            where: { id: permissionId },
        });
        if (permission &&
            permission_registry_js_1.ALL_USERS_PUBLISH_PERMISSION_KEYS.includes(permission.key)) {
            throw new common_1.BadRequestException('Publishing permissions are enabled for every role and cannot be removed');
        }
        await this.rolePermissionRepo.delete({ roleId, permissionId });
        const role = await this.roleRepo.findOne({ where: { id: roleId } });
        if (role?.isSystem && !role.isCustomized) {
            role.isCustomized = true;
            await this.roleRepo.save(role);
        }
    }
    async resetRoleToDefaults(roleId) {
        const role = await this.roleRepo.findOneOrFail({ where: { id: roleId } });
        const enforcedPublishKeys = role.slug.startsWith('fashion_') ||
            role.slug.startsWith('business_industrial_')
            ? []
            : permission_registry_js_1.ALL_USERS_PUBLISH_PERMISSION_KEYS;
        const defaultKeys = [
            ...new Set([
                ...(0, permission_registry_js_1.permissionsForRole)(role.slug),
                ...enforcedPublishKeys,
            ]),
        ];
        const permissions = await this.permissionRepo.find({
            where: { key: (0, typeorm_2.In)(defaultKeys) },
        });
        await this.rolePermissionRepo.delete({ roleId });
        for (const perm of permissions) {
            await this.rolePermissionRepo.save(this.rolePermissionRepo.create({ roleId, permissionId: perm.id }));
        }
        role.isCustomized = false;
        return this.roleRepo.save(role);
    }
    async getSidebarConfigs() {
        return this.sidebarConfigRepo.find();
    }
    async setSidebarConfigs(configs) {
        for (const cfg of configs) {
            const existing = await this.sidebarConfigRepo.findOne({
                where: { roleSlug: cfg.roleSlug, moduleKey: cfg.moduleKey },
            });
            if (existing) {
                existing.visible = cfg.visible;
                await this.sidebarConfigRepo.save(existing);
            }
            else {
                await this.sidebarConfigRepo.save(this.sidebarConfigRepo.create(cfg));
            }
        }
    }
    async getVisibleModulesForUser(userId) {
        const primary = await this.userRoleRepo.findOne({
            where: { userId, isPrimary: true },
            relations: ['role'],
        });
        const roleSlug = primary?.role?.slug ?? permission_registry_js_1.ROLE_SLUGS.STAFF;
        const configs = await this.sidebarConfigRepo.find({ where: { roleSlug } });
        const hiddenModules = new Set(configs.filter((c) => !c.visible).map((c) => c.moduleKey));
        const { SIDEBAR_MODULE_PERMISSIONS } = await import('./permission-registry.js');
        const userPerms = await this.getPermissionKeysForUser(userId);
        const visible = [];
        for (const [moduleKey, requiredPerm] of Object.entries(SIDEBAR_MODULE_PERMISSIONS)) {
            if (hiddenModules.has(moduleKey))
                continue;
            if (!userPerms.has(requiredPerm))
                continue;
            visible.push(moduleKey);
        }
        return visible;
    }
};
exports.RbacService = RbacService;
exports.RbacService = RbacService = RbacService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(role_entity_js_1.Role)),
    __param(1, (0, typeorm_1.InjectRepository)(permission_entity_js_1.Permission)),
    __param(2, (0, typeorm_1.InjectRepository)(role_permission_entity_js_1.RolePermission)),
    __param(3, (0, typeorm_1.InjectRepository)(user_role_assignment_entity_js_1.UserRoleAssignment)),
    __param(4, (0, typeorm_1.InjectRepository)(sidebar_module_config_entity_js_1.SidebarModuleConfig)),
    __param(5, (0, typeorm_1.InjectRepository)(user_entity_js_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService])
], RbacService);
//# sourceMappingURL=rbac.service.js.map