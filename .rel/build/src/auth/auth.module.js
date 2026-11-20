"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const audit_log_entity_js_1 = require("../dashboard/entities/audit-log.entity.js");
const rbac_module_js_1 = require("../rbac/rbac.module.js");
const auth_audit_service_js_1 = require("./auth-audit.service.js");
const auth_controller_1 = require("./auth.controller");
const auth_service_1 = require("./auth.service");
const user_organization_service_js_1 = require("./user-organization.service.js");
const jwt_strategy_1 = require("./jwt.strategy");
const user_entity_1 = require("./entities/user.entity");
const organization_entity_1 = require("./entities/organization.entity");
const organization_member_entity_1 = require("./entities/organization-member.entity");
const automotive_access_scope_service_js_1 = require("./automotive-access-scope.service.js");
const auth_session_service_js_1 = require("./auth-session.service.js");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            (0, common_1.forwardRef)(() => rbac_module_js_1.RbacModule),
            passport_1.PassportModule.register({ defaultStrategy: 'jwt' }),
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    secret: config.get('JWT_SECRET', 'dev-secret-change-in-production'),
                    signOptions: {
                        expiresIn: Number(config.get('JWT_EXPIRY_SECONDS', '14400')),
                    },
                }),
            }),
            typeorm_1.TypeOrmModule.forFeature([
                user_entity_1.User,
                organization_entity_1.Organization,
                organization_member_entity_1.OrganizationMember,
                audit_log_entity_js_1.AuditLog,
            ]),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [
            auth_service_1.AuthService,
            user_organization_service_js_1.UserOrganizationService,
            jwt_strategy_1.JwtStrategy,
            auth_audit_service_js_1.AuthAuditService,
            automotive_access_scope_service_js_1.AutomotiveAccessScopeService,
            auth_session_service_js_1.AuthSessionService,
        ],
        exports: [
            auth_service_1.AuthService,
            user_organization_service_js_1.UserOrganizationService,
            auth_audit_service_js_1.AuthAuditService,
            automotive_access_scope_service_js_1.AutomotiveAccessScopeService,
            auth_session_service_js_1.AuthSessionService,
            jwt_1.JwtModule,
            passport_1.PassportModule,
            typeorm_1.TypeOrmModule,
        ],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map