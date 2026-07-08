import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  ForbiddenException,
} from '@nestjs/common';
import { IsString, IsIn } from 'class-validator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { StoreAccessService } from './store-access.service.js';
import { type StoreAccessLevel } from './entities/user-store-assignment.entity.js';

class SetAssignmentDto {
  @IsString()
  userId!: string;

  @IsString()
  storeId!: string;

  @IsString()
  @IsIn(['view', 'operate', 'admin'])
  accessLevel!: StoreAccessLevel;
}

@Controller('store-access')
export class StoreAccessController {
  constructor(private readonly storeAccess: StoreAccessService) {}

  /**
   * Get all store assignments for a user (admin/supervisor use).
   */
  @Get('users/:userId')
  @RequirePermissions('stores.assign')
  async getUserAssignments(@Param('userId') userId: string) {
    const assignments = await this.storeAccess.getUserAssignments(userId);
    return { assignments };
  }

  /**
   * Assign a user to a store.
   */
  @Post('assign')
  @RequirePermissions('stores.assign')
  async assign(@Body() dto: SetAssignmentDto, @CurrentUser() user: User) {
    // Verify the assigning user has admin access to the target store
    await this.storeAccess.assertStoreAccess(user, dto.storeId, 'admin');
    const assignment = await this.storeAccess.setAssignment(
      dto.userId,
      dto.storeId,
      dto.accessLevel,
    );
    return { assignment };
  }

  /**
   * Remove a user's access to a store.
   */
  @Delete('assign/:userId/:storeId')
  @RequirePermissions('stores.assign')
  async unassign(
    @Param('userId') userId: string,
    @Param('storeId') storeId: string,
    @CurrentUser() user: User,
  ) {
    await this.storeAccess.assertStoreAccess(user, storeId, 'admin');
    await this.storeAccess.removeAssignment(userId, storeId);
    return { success: true };
  }

  /**
   * Update a user's access level on a store.
   */
  @Put('assign/:userId/:storeId')
  @RequirePermissions('stores.assign')
  async updateAssignment(
    @Param('userId') userId: string,
    @Param('storeId') storeId: string,
    @Body() dto: { accessLevel: StoreAccessLevel },
    @CurrentUser() user: User,
  ) {
    await this.storeAccess.assertStoreAccess(user, storeId, 'admin');
    const assignment = await this.storeAccess.setAssignment(
      userId,
      storeId,
      dto.accessLevel,
    );
    return { assignment };
  }

  /**
   * Toggle storeAccessAll for a user.
   */
  @Post('access-all/:userId')
  @RequirePermissions('stores.access_all_manage')
  async setAccessAll(
    @Param('userId') userId: string,
    @Body() dto: { enabled: boolean },
  ) {
    await this.storeAccess.setAccessAll(userId, dto.enabled);
    return { success: true };
  }
}
