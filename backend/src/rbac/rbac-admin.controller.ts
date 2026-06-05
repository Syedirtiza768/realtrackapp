import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { Role } from './entities/role.entity.js';
import { Permission } from './entities/permission.entity.js';
import { RequirePermissions } from './decorators/require-permissions.decorator.js';
import { RbacService } from './rbac.service.js';

class CreateUserDto {
  email: string;
  password: string;
  name?: string;
  roleSlug: string;
}

class AssignRoleDto {
  roleSlug: string;
}

const SALT_ROUNDS = 12;

@ApiTags('rbac-admin')
@ApiBearerAuth()
@Controller('rbac')
export class RbacAdminController {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    private readonly rbac: RbacService,
  ) {}

  @Get('permissions')
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'List all permissions' })
  listPermissions() {
    return this.permissionRepo.find({ order: { module: 'ASC', key: 'ASC' } });
  }

  @Get('roles')
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'List roles with permission keys' })
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
      permissions: (r.rolePermissions ?? [])
        .map((rp) => rp.permission?.key)
        .filter(Boolean),
    }));
  }

  @Get('users')
  @RequirePermissions('users.view')
  @ApiOperation({ summary: 'List users' })
  async listUsers() {
    const users = await this.userRepo.find({ order: { createdAt: 'DESC' } });
    return Promise.all(
      users.map(async (u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        active: u.active,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        profile: await this.rbac.getAuthProfile(u),
      })),
    );
  }

  @Post('users')
  @RequirePermissions('users.create')
  @ApiOperation({ summary: 'Create user' })
  async createUser(@Body() body: CreateUserDto) {
    const email = body.email.toLowerCase();
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      return { error: 'Email already registered' };
    }
    const user = await this.userRepo.save(
      this.userRepo.create({
        email,
        name: body.name ?? null,
        passwordHash: await bcrypt.hash(body.password, SALT_ROUNDS),
        role: body.roleSlug === 'staff' ? 'user' : (body.roleSlug as User['role']),
        active: true,
      }),
    );
    await this.rbac.assignPrimaryRole(user.id, body.roleSlug);
    return this.rbac.getAuthProfile(user);
  }

  @Patch('users/:id/role')
  @RequirePermissions('roles.assign')
  @ApiOperation({ summary: 'Assign primary role to user' })
  async assignRole(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() body: AssignRoleDto,
    @CurrentUser() actor: User,
  ) {
    if (body.roleSlug === 'super_admin' && actor.role !== 'super_admin') {
      return { error: 'Only Super Admin can assign Super Admin role' };
    }
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    user.role =
      body.roleSlug === 'staff'
        ? 'user'
        : (body.roleSlug as User['role']);
    await this.userRepo.save(user);
    await this.rbac.assignPrimaryRole(userId, body.roleSlug);
    return this.rbac.getAuthProfile(user);
  }

  @Patch('users/:id/deactivate')
  @RequirePermissions('users.deactivate')
  @ApiOperation({ summary: 'Deactivate user' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
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
}
