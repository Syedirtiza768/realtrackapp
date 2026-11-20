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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const bcrypt = __importStar(require("bcrypt"));
const typeorm_2 = require("typeorm");
const user_entity_1 = require("./entities/user.entity");
const user_organization_service_js_1 = require("./user-organization.service.js");
const rbac_service_js_1 = require("../rbac/rbac.service.js");
const permission_registry_js_1 = require("../rbac/permission-registry.js");
const node_crypto_1 = require("node:crypto");
const SALT_ROUNDS = 12;
let AuthService = class AuthService {
    userRepo;
    jwt;
    userOrgs;
    rbac;
    config;
    constructor(userRepo, jwt, userOrgs, rbac, config) {
        this.userRepo = userRepo;
        this.jwt = jwt;
        this.userOrgs = userOrgs;
        this.rbac = rbac;
        this.config = config;
    }
    isPublicRegistrationEnabled() {
        const explicit = this.config.get('ALLOW_PUBLIC_REGISTRATION');
        if (explicit !== undefined && explicit !== '') {
            return explicit === 'true' || explicit === '1';
        }
        return this.config.get('NODE_ENV', 'development') !== 'production';
    }
    assertPublicRegistrationAllowed() {
        if (!this.isPublicRegistrationEnabled()) {
            throw new common_1.ForbiddenException('Public registration is disabled. Contact an administrator for access.');
        }
    }
    async validateAndSign(email, password, requestedVertical) {
        const user = await this.userRepo.findOne({
            where: { email: email.toLowerCase(), active: true },
            select: [
                'id',
                'email',
                'passwordHash',
                'name',
                'role',
                'passwordChangeRequired',
            ],
        });
        if (!user)
            return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid)
            return null;
        if (requestedVertical) {
            const permission = requestedVertical === 'fashion'
                ? 'fashion.access'
                : requestedVertical === 'business_industrial'
                    ? 'business_industrial.access'
                    : 'dashboard.view';
            if (!(await this.rbac.userHasPermission(user.id, permission))) {
                throw new common_1.ForbiddenException(requestedVertical === 'fashion'
                    ? 'This account is not authorized for the Fashion workspace'
                    : requestedVertical === 'business_industrial'
                        ? 'This account is not authorized for the Business & Industrial workspace'
                        : 'This account is not authorized for the Auto Parts workspace');
            }
        }
        await this.userRepo.update(user.id, { lastLoginAt: new Date() });
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            jti: (0, node_crypto_1.randomUUID)(),
        };
        const accessToken = this.jwt.sign(payload);
        return {
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                passwordChangeRequired: user.passwordChangeRequired,
            },
        };
    }
    async register(email, password, name) {
        this.assertPublicRegistrationAllowed();
        const normalizedEmail = email.toLowerCase();
        const existing = await this.userRepo.findOne({
            where: { email: normalizedEmail },
        });
        if (existing) {
            throw new common_1.ConflictException('Email already registered');
        }
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const user = this.userRepo.create({
            email: normalizedEmail,
            passwordHash,
            name: name ?? null,
            role: 'user',
            storeAccessAll: true,
        });
        const saved = await this.userRepo.save(user);
        await this.userOrgs.ensureDefaultForUser(saved.id);
        await this.rbac.assignPrimaryRole(saved.id, permission_registry_js_1.ROLE_SLUGS.VIEWER);
        const payload = {
            sub: saved.id,
            email: saved.email,
            role: saved.role,
            jti: (0, node_crypto_1.randomUUID)(),
        };
        const accessToken = this.jwt.sign(payload);
        return {
            accessToken,
            user: {
                id: saved.id,
                email: saved.email,
                name: saved.name,
                role: saved.role,
            },
        };
    }
    async changePassword(userId, currentPassword, newPassword) {
        if (Array.from(newPassword).length < 12 ||
            Buffer.byteLength(newPassword, 'utf8') > 72) {
            throw new common_1.BadRequestException('New password must be at least 12 characters and at most 72 UTF-8 bytes');
        }
        const user = await this.userRepo.findOne({
            where: { id: userId, active: true },
            select: ['id', 'passwordHash'],
        });
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) {
            throw new common_1.BadRequestException('Current password is incorrect');
        }
        if (await bcrypt.compare(newPassword, user.passwordHash)) {
            throw new common_1.BadRequestException('New password must be different from the current password');
        }
        const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        const updated = await this.userRepo.update({ id: userId, active: true, passwordHash: user.passwordHash }, { passwordHash, passwordChangeRequired: false });
        if (updated.affected !== 1) {
            throw new common_1.ConflictException('Password changed concurrently. Please try again.');
        }
    }
    async adminResetPassword(userId, newPassword) {
        const user = await this.userRepo.findOne({
            where: { id: userId, active: true },
            select: ['id'],
        });
        if (!user) {
            throw new common_1.ConflictException('User not found or inactive');
        }
        const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await this.userRepo.update(userId, { passwordHash });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        jwt_1.JwtService,
        user_organization_service_js_1.UserOrganizationService,
        rbac_service_js_1.RbacService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map