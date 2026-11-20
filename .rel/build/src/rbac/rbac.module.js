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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RbacModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const organization_entity_js_1 = require("../auth/entities/organization.entity.js");
const organization_member_entity_js_1 = require("../auth/entities/organization-member.entity.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const permission_entity_js_1 = require("./entities/permission.entity.js");
const role_permission_entity_js_1 = require("./entities/role-permission.entity.js");
const role_entity_js_1 = require("./entities/role.entity.js");
const sidebar_module_config_entity_js_1 = require("./entities/sidebar-module-config.entity.js");
const user_role_assignment_entity_js_1 = require("./entities/user-role-assignment.entity.js");
const auth_module_js_1 = require("../auth/auth.module.js");
const permissions_guard_js_1 = require("./guards/permissions.guard.js");
const rbac_admin_controller_js_1 = require("./rbac-admin.controller.js");
const rbac_roles_controller_js_1 = require("./rbac-roles.controller.js");
const rbac_seed_service_js_1 = require("./rbac-seed.service.js");
const rbac_service_js_1 = require("./rbac.service.js");
let RbacBootstrap = class RbacBootstrap {
    seed;
    constructor(seed) {
        this.seed = seed;
    }
    async onModuleInit() {
        await this.seed.seedDemoUsers();
    }
};
RbacBootstrap = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [rbac_seed_service_js_1.RbacSeedService])
], RbacBootstrap);
let RbacModule = class RbacModule {
};
exports.RbacModule = RbacModule;
exports.RbacModule = RbacModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            (0, common_1.forwardRef)(() => auth_module_js_1.AuthModule),
            typeorm_1.TypeOrmModule.forFeature([
                role_entity_js_1.Role,
                permission_entity_js_1.Permission,
                role_permission_entity_js_1.RolePermission,
                user_role_assignment_entity_js_1.UserRoleAssignment,
                sidebar_module_config_entity_js_1.SidebarModuleConfig,
                user_entity_js_1.User,
                organization_entity_js_1.Organization,
                organization_member_entity_js_1.OrganizationMember,
            ]),
        ],
        controllers: [rbac_admin_controller_js_1.RbacAdminController, rbac_roles_controller_js_1.RbacRolesController],
        providers: [rbac_service_js_1.RbacService, rbac_seed_service_js_1.RbacSeedService, permissions_guard_js_1.PermissionsGuard, RbacBootstrap],
        exports: [rbac_service_js_1.RbacService, rbac_seed_service_js_1.RbacSeedService, permissions_guard_js_1.PermissionsGuard, typeorm_1.TypeOrmModule],
    })
], RbacModule);
//# sourceMappingURL=rbac.module.js.map