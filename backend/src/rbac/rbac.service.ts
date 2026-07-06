import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { Permission } from './entities/permission.entity.js';
import { RolePermission } from './entities/role-permission.entity.js';
import { Role } from './entities/role.entity.js';
import { SidebarModuleConfig } from './entities/sidebar-module-config.entity.js';
import { UserRoleAssignment } from './entities/user-role-assignment.entity.js';
import {
  LEGACY_USER_ROLE_TO_SLUG,
  PERMISSION_REGISTRY,
  ROLE_DEFINITIONS,
  ROLE_SLUGS,
  permissionsForRole,
  type RoleSlug,
} from './permission-registry.js';

export type AuthProfile = {
  id: string;
  email: string;
  name: string | null;
  active: boolean;
  role: string;
  roleSlug: string;
  roleName: string;
  permissions: string[];
  lastLoginAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class RbacService implements OnModuleInit {
  private readonly logger = new Logger(RbacService.name);
  private syncInFlight: Promise<void> | null = null;

  constructor(
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
    @InjectRepository(UserRoleAssignment)
    private readonly userRoleRepo: Repository<UserRoleAssignment>,
    @InjectRepository(SidebarModuleConfig)
    private readonly sidebarConfigRepo: Repository<SidebarModuleConfig>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const sync =
      this.config.get<string>('RBAC_SYNC_PERMISSIONS', 'true') === 'true';
    if (!sync) return;
    await this.syncFromRegistry();
    await this.syncLegacyUserRoles();
  }

  async syncFromRegistry(): Promise<void> {
    if (this.syncInFlight) {
      return this.syncInFlight;
    }
    this.syncInFlight = this.doSyncFromRegistry().finally(() => {
      this.syncInFlight = null;
    });
    return this.syncInFlight;
  }

  private async doSyncFromRegistry(): Promise<void> {
    for (const def of PERMISSION_REGISTRY) {
      let perm = await this.permissionRepo.findOne({ where: { key: def.key } });
      if (!perm) {
        perm = this.permissionRepo.create({
          key: def.key,
          label: def.label,
          module: def.module,
          description: def.description ?? null,
        });
      } else {
        perm.label = def.label;
        perm.module = def.module;
        perm.description = def.description ?? null;
      }
      await this.permissionRepo.save(perm);
    }

    for (const roleDef of ROLE_DEFINITIONS) {
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
        this.logger.debug(
          `Skipping permission sync for customized role: ${role.slug}`,
        );
        continue;
      }

      const permKeys = PERMISSION_REGISTRY.filter((p) =>
        p.defaultRoles?.includes(roleDef.slug as RoleSlug),
      ).map((p) => p.key);

      const permissions = await this.permissionRepo.find({
        where: { key: In(permKeys) },
      });
      const permissionIds = new Set(permissions.map((p) => p.id));

      const existing = await this.rolePermissionRepo.find({
        where: { roleId: role.id },
      });
      const existingIds = new Set(existing.map((e) => e.permissionId));

      for (const perm of permissions) {
        if (existingIds.has(perm.id)) continue;
        const exists = await this.rolePermissionRepo.findOne({
          where: { roleId: role.id, permissionId: perm.id },
        });
        if (exists) continue;
        try {
          await this.rolePermissionRepo.save(
            this.rolePermissionRepo.create({
              roleId: role.id,
              permissionId: perm.id,
            }),
          );
        } catch (err: unknown) {
          const code =
            err && typeof err === 'object' && 'code' in err
              ? String((err as { code: unknown }).code)
              : '';
          if (code !== '23505') throw err;
        }
      }

      for (const row of existing) {
        if (!permissionIds.has(row.permissionId)) {
          await this.rolePermissionRepo.delete({ id: row.id });
        }
      }
    }

    this.logger.log('RBAC registry synced');
  }

  /** Assign RBAC roles for users that only have legacy users.role. */
  async syncLegacyUserRoles(): Promise<void> {
    const users = await this.userRepo.find();
    for (const user of users) {
      const hasAssignment = await this.userRoleRepo.findOne({
        where: { userId: user.id, isPrimary: true },
      });
      if (hasAssignment) continue;

      const slug =
        LEGACY_USER_ROLE_TO_SLUG[user.role] ??
        (user.role === 'admin' ? ROLE_SLUGS.ADMIN : ROLE_SLUGS.STAFF);
      await this.assignPrimaryRole(user.id, slug);
    }
  }

  async getRoleBySlug(slug: string): Promise<Role | null> {
    return this.roleRepo.findOne({ where: { slug } });
  }

  async assignPrimaryRole(userId: string, roleSlug: string): Promise<void> {
    const role = await this.roleRepo.findOne({ where: { slug: roleSlug } });
    if (!role) throw new Error(`Role not found: ${roleSlug}`);

    await this.userRoleRepo.update(
      { userId, isPrimary: true },
      { isPrimary: false },
    );

    const existing = await this.userRoleRepo.findOne({
      where: { userId, roleId: role.id },
    });
    if (existing) {
      existing.isPrimary = true;
      await this.userRoleRepo.save(existing);
    } else {
      await this.userRoleRepo.save(
        this.userRoleRepo.create({ userId, roleId: role.id, isPrimary: true }),
      );
    }
  }

  async getPermissionKeysForUser(userId: string): Promise<Set<string>> {
    const assignments = await this.userRoleRepo.find({
      where: { userId },
      relations: [
        'role',
        'role.rolePermissions',
        'role.rolePermissions.permission',
      ],
    });

    const keys = new Set<string>();
    for (const assignment of assignments) {
      for (const rp of assignment.role?.rolePermissions ?? []) {
        if (rp.permission?.key) keys.add(rp.permission.key);
      }
    }

    if (keys.size === 0) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (user) {
        const slug = LEGACY_USER_ROLE_TO_SLUG[user.role] ?? ROLE_SLUGS.STAFF;
        const role = await this.roleRepo.findOne({
          where: { slug },
          relations: ['rolePermissions', 'rolePermissions.permission'],
        });
        for (const rp of role?.rolePermissions ?? []) {
          if (rp.permission?.key) keys.add(rp.permission.key);
        }
      }
    }

    return keys;
  }

  async userHasPermission(
    userId: string,
    permissionKey: string,
  ): Promise<boolean> {
    const keys = await this.getPermissionKeysForUser(userId);
    return keys.has(permissionKey);
  }

  async getAuthProfile(user: User): Promise<AuthProfile> {
    const permissions = [
      ...(await this.getPermissionKeysForUser(user.id)),
    ].sort();
    const primary = await this.userRoleRepo.findOne({
      where: { userId: user.id, isPrimary: true },
      relations: ['role'],
    });
    const roleSlug =
      primary?.role?.slug ?? LEGACY_USER_ROLE_TO_SLUG[user.role] ?? user.role;
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

  // ── Role CRUD ──

  async createRole(dto: {
    slug: string;
    name: string;
    description?: string;
  }): Promise<Role> {
    const existing = await this.roleRepo.findOne({ where: { slug: dto.slug } });
    if (existing)
      throw new BadRequestException(`Role slug "${dto.slug}" already exists`);

    const role = this.roleRepo.create({
      slug: dto.slug,
      name: dto.name,
      description: dto.description ?? null,
      isSystem: false,
    });
    return this.roleRepo.save(role);
  }

  async updateRole(
    id: string,
    dto: { name?: string; description?: string },
  ): Promise<Role> {
    const role = await this.roleRepo.findOneOrFail({ where: { id } });
    if (dto.name !== undefined) role.name = dto.name;
    if (dto.description !== undefined) role.description = dto.description;
    return this.roleRepo.save(role);
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.roleRepo.findOneOrFail({
      where: { id },
      relations: ['userAssignments'],
    });
    if (role.isSystem)
      throw new BadRequestException('Cannot delete system roles');
    if ((role.userAssignments?.length ?? 0) > 0) {
      throw new BadRequestException(
        'Cannot delete role with assigned users. Reassign them first.',
      );
    }
    await this.rolePermissionRepo.delete({ roleId: id });
    await this.roleRepo.delete(id);
  }

  // ── Role-Permission assignment ──

  async setRolePermissions(
    roleId: string,
    permissionKeys: string[],
  ): Promise<Role> {
    const role = await this.roleRepo.findOneOrFail({ where: { id: roleId } });

    const validKeys = new Set(PERMISSION_REGISTRY.map((p) => p.key));
    const invalid = permissionKeys.filter((k) => !validKeys.has(k));
    if (invalid.length) {
      throw new BadRequestException(
        `Unknown permissions: ${invalid.join(', ')}`,
      );
    }

    const permissions = await this.permissionRepo.find({
      where: { key: In(permissionKeys) },
    });

    await this.rolePermissionRepo.delete({ roleId });
    for (const perm of permissions) {
      await this.rolePermissionRepo.save(
        this.rolePermissionRepo.create({ roleId, permissionId: perm.id }),
      );
    }

    if (role.isSystem && !role.isCustomized) {
      role.isCustomized = true;
      await this.roleRepo.save(role);
    }

    return role;
  }

  async removeRolePermission(
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    await this.rolePermissionRepo.delete({ roleId, permissionId });
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (role?.isSystem && !role.isCustomized) {
      role.isCustomized = true;
      await this.roleRepo.save(role);
    }
  }

  async resetRoleToDefaults(roleId: string): Promise<Role> {
    const role = await this.roleRepo.findOneOrFail({ where: { id: roleId } });
    const defaultKeys = permissionsForRole(role.slug as RoleSlug);
    const permissions = await this.permissionRepo.find({
      where: { key: In(defaultKeys) },
    });

    await this.rolePermissionRepo.delete({ roleId });
    for (const perm of permissions) {
      await this.rolePermissionRepo.save(
        this.rolePermissionRepo.create({ roleId, permissionId: perm.id }),
      );
    }

    role.isCustomized = false;
    return this.roleRepo.save(role);
  }

  // ── Sidebar module visibility ──

  async getSidebarConfigs(): Promise<SidebarModuleConfig[]> {
    return this.sidebarConfigRepo.find();
  }

  async setSidebarConfigs(
    configs: Array<{ roleSlug: string; moduleKey: string; visible: boolean }>,
  ): Promise<void> {
    for (const cfg of configs) {
      const existing = await this.sidebarConfigRepo.findOne({
        where: { roleSlug: cfg.roleSlug, moduleKey: cfg.moduleKey },
      });
      if (existing) {
        existing.visible = cfg.visible;
        await this.sidebarConfigRepo.save(existing);
      } else {
        await this.sidebarConfigRepo.save(this.sidebarConfigRepo.create(cfg));
      }
    }
  }

  async getVisibleModulesForUser(userId: string): Promise<string[]> {
    const primary = await this.userRoleRepo.findOne({
      where: { userId, isPrimary: true },
      relations: ['role'],
    });
    const roleSlug = primary?.role?.slug ?? ROLE_SLUGS.STAFF;
    const configs = await this.sidebarConfigRepo.find({ where: { roleSlug } });
    const hiddenModules = new Set(
      configs.filter((c) => !c.visible).map((c) => c.moduleKey),
    );

    const { SIDEBAR_MODULE_PERMISSIONS } =
      await import('./permission-registry.js');
    const userPerms = await this.getPermissionKeysForUser(userId);

    const visible: string[] = [];
    for (const [moduleKey, requiredPerm] of Object.entries(
      SIDEBAR_MODULE_PERMISSIONS,
    )) {
      if (hiddenModules.has(moduleKey)) continue;
      if (!userPerms.has(requiredPerm)) continue;
      visible.push(moduleKey);
    }
    return visible;
  }
}
