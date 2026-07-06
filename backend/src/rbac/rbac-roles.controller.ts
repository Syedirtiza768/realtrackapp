import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { RequirePermissions } from './decorators/require-permissions.decorator.js';
import {
  CreateRoleDto,
  SetRolePermissionsDto,
  SetSidebarConfigDto,
  UpdateRoleDto,
} from './dto/rbac-admin.dto.js';
import { RbacService } from './rbac.service.js';

@ApiTags('rbac-roles')
@ApiBearerAuth()
@Controller('rbac/roles')
export class RbacRolesController {
  constructor(private readonly rbac: RbacService) {}

  // ── Role CRUD ──

  @Post()
  @RequirePermissions('roles.create')
  @ApiOperation({ summary: 'Create a custom role' })
  async createRole(@Body() body: CreateRoleDto) {
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

  @Patch(':id')
  @RequirePermissions('roles.update')
  @ApiOperation({ summary: 'Update role name/description' })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRoleDto,
  ) {
    const role = await this.rbac.updateRole(id, body);
    return {
      id: role.id,
      slug: role.slug,
      name: role.name,
      description: role.description,
    };
  }

  @Delete(':id')
  @RequirePermissions('roles.delete')
  @ApiOperation({ summary: 'Delete a custom role' })
  async deleteRole(@Param('id', ParseUUIDPipe) id: string) {
    await this.rbac.deleteRole(id);
    return { ok: true };
  }

  // ── Role-Permission assignment ──

  @Post(':id/permissions')
  @RequirePermissions('roles.assign_permissions')
  @ApiOperation({
    summary: 'Set all permissions for a role (replaces existing)',
  })
  async setRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetRolePermissionsDto,
  ) {
    const role = await this.rbac.setRolePermissions(id, body.permissionKeys);
    return { ok: true, isCustomized: role.isCustomized };
  }

  @Delete(':id/permissions/:permId')
  @RequirePermissions('roles.assign_permissions')
  @ApiOperation({ summary: 'Remove a permission from a role' })
  async removeRolePermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permId', ParseUUIDPipe) permId: string,
  ) {
    await this.rbac.removeRolePermission(id, permId);
    return { ok: true };
  }

  @Post(':id/reset')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Reset a system role to its default permissions' })
  async resetToDefaults(@Param('id', ParseUUIDPipe) id: string) {
    const role = await this.rbac.resetRoleToDefaults(id);
    return { ok: true, isCustomized: role.isCustomized };
  }

  // ── Sidebar module visibility ──

  @Get('sidebar-config')
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'Get all sidebar module visibility configs' })
  async getSidebarConfigs() {
    return this.rbac.getSidebarConfigs();
  }

  @Patch('sidebar-config')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Set sidebar module visibility for roles' })
  async setSidebarConfigs(@Body() body: SetSidebarConfigDto) {
    await this.rbac.setSidebarConfigs(body.configs);
    return { ok: true };
  }

  @Get('sidebar-config/me')
  @ApiOperation({ summary: 'Get visible sidebar modules for current user' })
  async getMySidebarConfig(@CurrentUser() user: User) {
    const visible = await this.rbac.getVisibleModulesForUser(user.id);
    return { visibleModules: visible };
  }
}
