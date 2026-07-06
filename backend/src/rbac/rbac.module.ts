import {
  forwardRef,
  Global,
  Injectable,
  Module,
  OnModuleInit,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../auth/entities/organization.entity.js';
import { OrganizationMember } from '../auth/entities/organization-member.entity.js';
import { User } from '../auth/entities/user.entity.js';
import { Permission } from './entities/permission.entity.js';
import { RolePermission } from './entities/role-permission.entity.js';
import { Role } from './entities/role.entity.js';
import { SidebarModuleConfig } from './entities/sidebar-module-config.entity.js';
import { UserRoleAssignment } from './entities/user-role-assignment.entity.js';
import { AuthModule } from '../auth/auth.module.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { RbacAdminController } from './rbac-admin.controller.js';
import { RbacRolesController } from './rbac-roles.controller.js';
import { RbacSeedService } from './rbac-seed.service.js';
import { RbacService } from './rbac.service.js';

@Injectable()
class RbacBootstrap implements OnModuleInit {
  constructor(private readonly seed: RbacSeedService) {}

  async onModuleInit(): Promise<void> {
    await this.seed.seedDemoUsers();
  }
}

@Global()
@Module({
  imports: [
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([
      Role,
      Permission,
      RolePermission,
      UserRoleAssignment,
      SidebarModuleConfig,
      User,
      Organization,
      OrganizationMember,
    ]),
  ],
  controllers: [RbacAdminController, RbacRolesController],
  providers: [RbacService, RbacSeedService, PermissionsGuard, RbacBootstrap],
  exports: [RbacService, RbacSeedService, PermissionsGuard, TypeOrmModule],
})
export class RbacModule {}
