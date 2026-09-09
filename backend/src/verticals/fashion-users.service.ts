import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../auth/entities/user.entity.js';
import { OrganizationMember } from '../auth/entities/organization-member.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { UserStoreAssignment } from '../channels/entities/user-store-assignment.entity.js';
import { Role } from '../rbac/entities/role.entity.js';
import { UserRoleAssignment } from '../rbac/entities/user-role-assignment.entity.js';
import { RbacService } from '../rbac/rbac.service.js';
import { VerticalsService } from './verticals.service.js';
import { FashionRoleDto, FashionStoreAccessDto, FashionUserCreateDto } from './fashion.dto.js';

export const FASHION_ROLES = ['fashion_admin', 'fashion_manager', 'fashion_operator'];

@Injectable()
export class FashionUsersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly organizations: UserOrganizationService,
    private readonly stores: StoreAccessService,
    private readonly verticals: VerticalsService,
    private readonly rbac: RbacService,
  ) {}

  async list(user: User, organizationId?: string) {
    const org = await this.organizations.resolveOrganizationId(user.id, organizationId);
    const members = await this.dataSource.getRepository(OrganizationMember).find({ where: { organizationId: org.organizationId }, relations: ['user'], order: { createdAt: 'ASC' } });
    const result: Awaited<ReturnType<FashionUsersService['summary']>>[] = [];
    for (const member of members) {
      const profile = await this.rbac.getAuthProfile(member.user);
      if (FASHION_ROLES.includes(profile.roleSlug) && profile.permissions.every((key) => key.startsWith('fashion.'))) result.push(await this.summary(member.user, member, org.organizationId));
    }
    return result;
  }

  async create(actor: User, dto: FashionUserCreateDto, organizationId?: string) {
    const org = await this.organizations.resolveOrganizationId(actor.id, organizationId);
    await this.validateStores(actor, dto.storeIds ?? [], org.organizationId);
    if (Buffer.byteLength(dto.password, 'utf8') > 72) throw new BadRequestException('Password must not exceed 72 UTF-8 bytes');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    let saved: User;
    try {
      saved = await this.dataSource.transaction(async (manager) => {
        const role = await this.safeRole(manager, dto.role);
        const users = manager.getRepository(User);
        if (await users.findOne({ where: { email: dto.email.trim().toLowerCase() } })) throw new ConflictException('Email already registered; existing accounts cannot be claimed by Fashion admins');
        const created = await users.save(users.create({ email: dto.email.trim().toLowerCase(), name: dto.name?.trim() || null, passwordHash, role: 'user', active: true, storeAccessAll: false, passwordChangeRequired: true }));
        await manager.getRepository(OrganizationMember).save({ organizationId: org.organizationId, userId: created.id, role: 'editor' });
        await manager.getRepository(UserRoleAssignment).save({ userId: created.id, roleId: role.id, isPrimary: true });
        for (const storeId of dto.storeIds ?? []) await manager.getRepository(UserStoreAssignment).save({ userId: created.id, storeId, accessLevel: 'view' });
        return created;
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('Email already registered');
      throw error;
    }
    const member = await this.dataSource.getRepository(OrganizationMember).findOneByOrFail({ organizationId: org.organizationId, userId: saved.id });
    return this.summary(saved, member, org.organizationId);
  }

  async updateRole(actor: User, id: string, dto: FashionRoleDto, organizationId?: string) {
    return this.mutate(actor, id, organizationId, async (manager, target) => {
      const role = await this.safeRole(manager, dto.role);
      // Effective permissions include non-primary roles: replace every old assignment.
      await manager.getRepository(UserRoleAssignment).delete({ userId: target.id });
      await manager.getRepository(UserRoleAssignment).save({ userId: target.id, roleId: role.id, isPrimary: true });
    });
  }

  async deactivate(actor: User, id: string, organizationId?: string) {
    return this.mutate(actor, id, organizationId, async (manager, target) => {
      target.active = false;
      await manager.getRepository(User).save(target);
      await manager.getRepository(UserStoreAssignment).delete({ userId: target.id });
    });
  }

  async setStores(actor: User, id: string, dto: FashionStoreAccessDto, organizationId?: string) {
    const org = await this.organizations.resolveOrganizationId(actor.id, organizationId);
    await this.validateStores(actor, dto.storeIds, org.organizationId);
    return this.mutate(actor, id, org.organizationId, async (manager, target) => {
      await manager.getRepository(UserStoreAssignment).delete({ userId: target.id });
      for (const storeId of dto.storeIds) await manager.getRepository(UserStoreAssignment).save({ userId: target.id, storeId, accessLevel: dto.accessLevel ?? 'view' });
    });
  }

  private async safeRole(manager: EntityManager, slug: string) {
    if (!FASHION_ROLES.includes(slug)) throw new ForbiddenException('Only Fashion roles may be assigned');
    const role = await manager.getRepository(Role).findOne({ where: { slug }, relations: ['rolePermissions', 'rolePermissions.permission'] });
    const keys = role?.rolePermissions?.map((row) => row.permission?.key) ?? [];
    if (!role || !keys.includes('fashion.access') || keys.some((key) => !key?.startsWith('fashion.'))) throw new ForbiddenException('Role is missing or grants access outside Fashion');
    return role;
  }

  private async mutate(actor: User, id: string, organizationId: string | undefined, operation: (manager: EntityManager, target: User) => Promise<void>) {
    if (actor.id === id) throw new ForbiddenException('Fashion administrators cannot change their own access');
    const org = await this.organizations.resolveOrganizationId(actor.id, organizationId);
    const result = await this.dataSource.transaction(async (manager) => {
      const target = await manager.getRepository(User).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      const members = await manager.getRepository(OrganizationMember).find({ where: { userId: id } });
      if (!target || !members.some((member) => member.organizationId === org.organizationId)) throw new NotFoundException('Fashion user not found');
      if (members.length !== 1 || target.role !== 'user' || target.storeAccessAll) throw new ForbiddenException('Shared or platform accounts cannot be changed by Fashion admins');
      const assignments = await manager.getRepository(UserRoleAssignment).find({ where: { userId: id }, relations: ['role'] });
      if (!assignments.length || assignments.some((row) => !FASHION_ROLES.includes(row.role?.slug))) throw new ForbiddenException('Only exclusively Fashion accounts can be changed');
      for (const assignment of assignments) await this.safeRole(manager, assignment.role.slug);
      const storeAssignments = await manager.getRepository(UserStoreAssignment).find({ where: { userId: id }, relations: ['store'] });
      if (storeAssignments.some((row) => row.store?.organizationId !== org.organizationId || !this.isDedicatedFashion(row.store))) throw new ForbiddenException('User has stores outside this Fashion workspace');
      await operation(manager, target);
      return { target, member: members[0] };
    });
    return this.summary(result.target, result.member, org.organizationId);
  }

  private isDedicatedFashion(store: Parameters<VerticalsService['getStoreConfig']>[0]) {
    const config = this.verticals.getStoreConfig(store);
    return config.enabledVerticals.length === 1 && config.enabledVerticals[0] === 'fashion';
  }

  private async validateStores(actor: User, ids: string[], organizationId: string) {
    const available = await this.verticals.listStoresForOrganization(organizationId);
    for (const id of ids) {
      if (!available.some((store) => store.id === id && this.isDedicatedFashion(store))) throw new ForbiddenException('Store is not dedicated to this Fashion workspace');
      await this.stores.assertStoreAccess(actor, id, 'admin');
    }
  }

  private async summary(user: User, member: OrganizationMember, organizationId: string) {
    const profile = await this.rbac.getAuthProfile(user);
    const allowed = new Set((await this.verticals.listStoresForOrganization(organizationId)).filter((store) => this.isDedicatedFashion(store)).map((store) => store.id));
    const assignments = await this.stores.getUserAssignments(user.id);
    return { userId: user.id, email: user.email, name: user.name, organizationRole: member.role, roleSlug: profile.roleSlug, roleName: profile.roleName, active: user.active, storeAssignments: assignments.filter((row) => allowed.has(row.storeId)).map((row) => ({ storeId: row.storeId, accessLevel: row.accessLevel })) };
  }
}
