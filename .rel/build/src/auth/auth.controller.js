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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const rbac_service_js_1 = require("../rbac/rbac.service.js");
const auth_audit_service_js_1 = require("./auth-audit.service.js");
const auth_service_1 = require("./auth.service");
const user_organization_service_js_1 = require("./user-organization.service.js");
const jwt_auth_guard_js_1 = require("./guards/jwt-auth.guard.js");
const public_decorator_js_1 = require("./decorators/public.decorator.js");
const current_user_decorator_js_1 = require("./decorators/current-user.decorator.js");
const auth_dto_js_1 = require("./dto/auth.dto.js");
const user_entity_js_1 = require("./entities/user.entity.js");
const allow_password_change_decorator_js_1 = require("./decorators/allow-password-change.decorator.js");
const auth_session_service_js_1 = require("./auth-session.service.js");
let AuthController = class AuthController {
    auth;
    userOrgs;
    rbac;
    authAudit;
    sessions;
    constructor(auth, userOrgs, rbac, authAudit, sessions) {
        this.auth = auth;
        this.userOrgs = userOrgs;
        this.rbac = rbac;
        this.authAudit = authAudit;
        this.sessions = sessions;
    }
    async login(body, req) {
        const result = await this.auth.validateAndSign(body.email, body.password, body.vertical);
        if (!result) {
            await this.authAudit.log('auth.login_failed', {
                metadata: { email: body.email?.toLowerCase() },
                req,
            });
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        await this.authAudit.log('auth.login_success', {
            actorId: result.user.id,
            entityId: result.user.id,
            req,
        });
        return result;
    }
    getPublicConfig() {
        return {
            registrationEnabled: this.auth.isPublicRegistrationEnabled(),
        };
    }
    async register(body, req) {
        const result = await this.auth.register(body.email, body.password, body.name);
        await this.authAudit.log('auth.register', {
            actorId: result.user.id,
            entityId: result.user.id,
            req,
        });
        return result;
    }
    async me(user, req) {
        const profile = await this.rbac.getAuthProfile(user);
        const organizations = await this.userOrgs.listForUser(user.id);
        return {
            user: { ...profile, passwordChangeRequired: user.passwordChangeRequired },
            organizations: organizations.length > 0
                ? organizations
                : [await this.userOrgs.ensureDefaultForUser(user.id)],
        };
    }
    async logout(user, req) {
        await this.sessions.revokeBearerToken(req.headers.authorization);
        await this.authAudit.log('auth.logout', {
            actorId: user.id,
            entityId: user.id,
            req,
        });
        return { ok: true };
    }
    async changePassword(user, body, req) {
        await this.auth.changePassword(user.id, body.currentPassword, body.newPassword);
        await this.authAudit.log('auth.password_changed', {
            actorId: user.id,
            entityId: user.id,
            req,
        });
        return { ok: true };
    }
    async listOrganizations(user) {
        const organizations = await this.userOrgs.listForUser(user.id);
        if (organizations.length === 0) {
            const created = await this.userOrgs.ensureDefaultForUser(user.id);
            return { organizations: [created] };
        }
        return { organizations };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, public_decorator_js_1.Public)(),
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_js_1.LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, public_decorator_js_1.Public)(),
    (0, common_1.Get)('public-config'),
    (0, swagger_1.ApiOperation)({ summary: 'Public auth UI config (registration gate, etc.)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "getPublicConfig", null);
__decorate([
    (0, public_decorator_js_1.Public)(),
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_js_1.RegisterDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, allow_password_change_decorator_js_1.AllowPasswordChange)(),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Current authenticated user with permissions' }),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Logout (client should discard token)' }),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Patch)('change-password'),
    (0, allow_password_change_decorator_js_1.AllowPasswordChange)(),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Change current user password' }),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        auth_dto_js_1.ChangePasswordDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
__decorate([
    (0, common_1.Get)('organizations'),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'List Omni Core workspaces for the signed-in user (internal tenant, not eBay)',
    }),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "listOrganizations", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('auth'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        user_organization_service_js_1.UserOrganizationService,
        rbac_service_js_1.RbacService,
        auth_audit_service_js_1.AuthAuditService,
        auth_session_service_js_1.AuthSessionService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map