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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessIndustrialUsersService = exports.BUSINESS_INDUSTRIAL_ROLES = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const bcrypt = __importStar(require("bcrypt"));
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const organization_member_entity_js_1 = require("../auth/entities/organization-member.entity.js");
const user_organization_service_js_1 = require("../auth/user-organization.service.js");
const store_access_service_js_1 = require("../channels/store-access.service.js");
const user_store_assignment_entity_js_1 = require("../channels/entities/user-store-assignment.entity.js");
const role_entity_js_1 = require("../rbac/entities/role.entity.js");
const user_role_assignment_entity_js_1 = require("../rbac/entities/user-role-assignment.entity.js");
const rbac_service_js_1 = require("../rbac/rbac.service.js");
const verticals_service_js_1 = require("./verticals.service.js");
exports.BUSINESS_INDUSTRIAL_ROLES = [
    'business_industrial_admin',
    'business_industrial_manager',
    'business_industrial_operator',
];
let BusinessIndustrialUsersService = class BusinessIndustrialUsersService {
    dataSource;
    organizations;
    stores;
    verticals;
    rbac;
    constructor(dataSource, organizations, stores, verticals, rbac) {
        this.dataSource = dataSource;
        this.organizations = organizations;
        this.stores = stores;
        this.verticals = verticals;
        this.rbac = rbac;
    }
    async list(user, organizationId) {
        const org = await this.organizations.resolveOrganizationId(user.id, organizationId);
        const members = await this.dataSource
            .getRepository(organization_member_entity_js_1.OrganizationMember)
            .find({
            where: { organizationId: org.organizationId },
            relations: ['user'],
            order: { createdAt: 'ASC' },
        });
        const result = [];
        for (const member of members) {
            const profile = await this.rbac.getAuthProfile(member.user);
            if (exports.BUSINESS_INDUSTRIAL_ROLES.includes(profile.roleSlug) &&
                profile.permissions.every((key) => key.startsWith('business_industrial.')))
                result.push(await this.summary(member.user, member, org.organizationId));
        }
        return result;
    }
    async create(actor, dto, organizationId) {
        const org = await this.organizations.resolveOrganizationId(actor.id, organizationId);
        await this.validateStores(actor, dto.storeIds ?? [], org.organizationId);
        if (Buffer.byteLength(dto.password, 'utf8') > 72)
            throw new common_1.BadRequestException('Password must not exceed 72 UTF-8 bytes');
        const passwordHash = await bcrypt.hash(dto.password, 12);
        let saved;
        try {
            saved = await this.dataSource.transaction(async (manager) => {
                const role = await this.safeRole(manager, dto.role);
                const users = manager.getRepository(user_entity_js_1.User);
                const email = dto.email.trim().toLowerCase();
                if (await users.findOne({ where: { email } }))
                    throw new common_1.ConflictException('Email already registered; existing accounts cannot be claimed by B&I administrators');
                const created = await users.save(users.create({
                    email,
                    name: dto.name?.trim() || null,
                    passwordHash,
                    role: 'user',
                    active: true,
                    storeAccessAll: false,
                    passwordChangeRequired: true,
                }));
                await manager.getRepository(organization_member_entity_js_1.OrganizationMember).save({
                    organizationId: org.organizationId,
                    userId: created.id,
                    role: 'editor',
                });
                await manager
                    .getRepository(user_role_assignment_entity_js_1.UserRoleAssignment)
                    .save({ userId: created.id, roleId: role.id, isPrimary: true });
                for (const storeId of dto.storeIds ?? [])
                    await manager
                        .getRepository(user_store_assignment_entity_js_1.UserStoreAssignment)
                        .save({ userId: created.id, storeId, accessLevel: 'view' });
                return created;
            });
        }
        catch (error) {
            if (error.code === '23505')
                throw new common_1.ConflictException('Email already registered');
            throw error;
        }
        const member = await this.dataSource
            .getRepository(organization_member_entity_js_1.OrganizationMember)
            .findOneByOrFail({
            organizationId: org.organizationId,
            userId: saved.id,
        });
        return this.summary(saved, member, org.organizationId);
    }
    async updateRole(actor, id, dto, organizationId) {
        return this.mutate(actor, id, organizationId, async (manager, target) => {
            const role = await this.safeRole(manager, dto.role);
            await manager
                .getRepository(user_role_assignment_entity_js_1.UserRoleAssignment)
                .delete({ userId: target.id });
            await manager
                .getRepository(user_role_assignment_entity_js_1.UserRoleAssignment)
                .save({ userId: target.id, roleId: role.id, isPrimary: true });
        });
    }
    async deactivate(actor, id, organizationId) {
        return this.mutate(actor, id, organizationId, async (manager, target) => {
            target.active = false;
            await manager.getRepository(user_entity_js_1.User).save(target);
            await manager
                .getRepository(user_store_assignment_entity_js_1.UserStoreAssignment)
                .delete({ userId: target.id });
        });
    }
    async setStores(actor, id, dto, organizationId) {
        const org = await this.organizations.resolveOrganizationId(actor.id, organizationId);
        await this.validateStores(actor, dto.storeIds, org.organizationId);
        return this.mutate(actor, id, org.organizationId, async (manager, target) => {
            await manager
                .getRepository(user_store_assignment_entity_js_1.UserStoreAssignment)
                .delete({ userId: target.id });
            for (const storeId of dto.storeIds)
                await manager.getRepository(user_store_assignment_entity_js_1.UserStoreAssignment).save({
                    userId: target.id,
                    storeId,
                    accessLevel: dto.accessLevel ?? 'view',
                });
        });
    }
    async safeRole(manager, slug) {
        if (!exports.BUSINESS_INDUSTRIAL_ROLES.includes(slug))
            throw new common_1.ForbiddenException('Only Business & Industrial roles may be assigned');
        const role = await manager.getRepository(role_entity_js_1.Role).findOne({
            where: { slug },
            relations: ['rolePermissions', 'rolePermissions.permission'],
        });
        const keys = role?.rolePermissions?.map((row) => row.permission?.key) ?? [];
        if (!role ||
            !keys.includes('business_industrial.access') ||
            keys.some((key) => !key?.startsWith('business_industrial.')))
            throw new common_1.ForbiddenException('Role is missing or grants access outside Business & Industrial');
        return role;
    }
    async mutate(actor, id, organizationId, operation) {
        if (actor.id === id)
            throw new common_1.ForbiddenException('Business & Industrial administrators cannot change their own access');
        const org = await this.organizations.resolveOrganizationId(actor.id, organizationId);
        const result = await this.dataSource.transaction(async (manager) => {
            const target = await manager
                .getRepository(user_entity_js_1.User)
                .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
            const members = await manager
                .getRepository(organization_member_entity_js_1.OrganizationMember)
                .find({ where: { userId: id } });
            if (!target ||
                !members.some((member) => member.organizationId === org.organizationId))
                throw new common_1.NotFoundException('Business & Industrial user not found');
            if (members.length !== 1 ||
                target.role !== 'user' ||
                target.storeAccessAll)
                throw new common_1.ForbiddenException('Shared or platform accounts cannot be changed by B&I administrators');
            const assignments = await manager
                .getRepository(user_role_assignment_entity_js_1.UserRoleAssignment)
                .find({ where: { userId: id }, relations: ['role'] });
            if (!assignments.length ||
                assignments.some((row) => !exports.BUSINESS_INDUSTRIAL_ROLES.includes(row.role?.slug)))
                throw new common_1.ForbiddenException('Only exclusively Business & Industrial accounts can be changed');
            for (const assignment of assignments)
                await this.safeRole(manager, assignment.role.slug);
            const storeAssignments = await manager
                .getRepository(user_store_assignment_entity_js_1.UserStoreAssignment)
                .find({ where: { userId: id }, relations: ['store'] });
            if (storeAssignments.some((row) => row.store?.organizationId !== org.organizationId ||
                !this.isDedicatedBusinessIndustrial(row.store)))
                throw new common_1.ForbiddenException('User has stores outside this Business & Industrial workspace');
            await operation(manager, target);
            return { target, member: members[0] };
        });
        return this.summary(result.target, result.member, org.organizationId);
    }
    isDedicatedBusinessIndustrial(store) {
        const config = this.verticals.getStoreConfig(store);
        return (config.enabledVerticals.length === 1 &&
            config.enabledVerticals[0] === 'business_industrial');
    }
    async validateStores(actor, ids, organizationId) {
        const available = await this.verticals.listStoresForOrganization(organizationId);
        const canManageStores = await this.rbac.userHasPermission(actor.id, 'business_industrial.stores.manage');
        for (const id of ids) {
            if (!available.some((store) => store.id === id && this.isDedicatedBusinessIndustrial(store)))
                throw new common_1.ForbiddenException('Store is not dedicated to this Business & Industrial workspace');
            if (!canManageStores)
                await this.stores.assertStoreAccess(actor, id, 'admin');
        }
    }
    async summary(user, member, organizationId) {
        const profile = await this.rbac.getAuthProfile(user);
        const allowed = new Set((await this.verticals.listStoresForOrganization(organizationId))
            .filter((store) => this.isDedicatedBusinessIndustrial(store))
            .map((store) => store.id));
        const assignments = await this.stores.getUserAssignments(user.id);
        return {
            userId: user.id,
            email: user.email,
            name: user.name,
            organizationRole: member.role,
            roleSlug: profile.roleSlug,
            roleName: profile.roleName,
            active: user.active,
            storeAssignments: assignments
                .filter((row) => allowed.has(row.storeId))
                .map((row) => ({ storeId: row.storeId, accessLevel: row.accessLevel })),
        };
    }
};
exports.BusinessIndustrialUsersService = BusinessIndustrialUsersService;
exports.BusinessIndustrialUsersService = BusinessIndustrialUsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        user_organization_service_js_1.UserOrganizationService,
        store_access_service_js_1.StoreAccessService,
        verticals_service_js_1.VerticalsService,
        rbac_service_js_1.RbacService])
], BusinessIndustrialUsersService);
//# sourceMappingURL=business-industrial-users.service.js.map