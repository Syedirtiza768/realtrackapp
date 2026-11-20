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
var RbacSeedService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RbacSeedService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const bcrypt = __importStar(require("bcrypt"));
const crypto = __importStar(require("crypto"));
const typeorm_2 = require("typeorm");
const organization_entity_js_1 = require("../auth/entities/organization.entity.js");
const organization_member_entity_js_1 = require("../auth/entities/organization-member.entity.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const permission_registry_js_1 = require("./permission-registry.js");
const rbac_service_js_1 = require("./rbac.service.js");
const SALT_ROUNDS = 12;
let RbacSeedService = RbacSeedService_1 = class RbacSeedService {
    userRepo;
    orgRepo;
    memberRepo;
    rbac;
    config;
    logger = new common_1.Logger(RbacSeedService_1.name);
    constructor(userRepo, orgRepo, memberRepo, rbac, config) {
        this.userRepo = userRepo;
        this.orgRepo = orgRepo;
        this.memberRepo = memberRepo;
        this.rbac = rbac;
        this.config = config;
    }
    async seedDemoUsers() {
        const enabled = this.shouldSeedDemoUsers();
        if (!enabled) {
            this.logger.log('Demo user seeding skipped (SEED_DEMO_USERS=false or production)');
            return;
        }
        await this.rbac.syncFromRegistry();
        const users = [
            {
                slug: permission_registry_js_1.ROLE_SLUGS.SUPER_ADMIN,
                legacyRole: 'super_admin',
                emailEnv: 'DEFAULT_SUPER_ADMIN_EMAIL',
                passwordEnv: 'DEFAULT_SUPER_ADMIN_PASSWORD',
                nameEnv: 'DEFAULT_SUPER_ADMIN_NAME',
                defaultEmail: 'superadmin@realtrack.local',
                defaultName: 'Super Admin',
            },
            {
                slug: permission_registry_js_1.ROLE_SLUGS.ADMIN,
                legacyRole: 'admin',
                emailEnv: 'DEFAULT_ADMIN_EMAIL',
                passwordEnv: 'DEFAULT_ADMIN_PASSWORD',
                nameEnv: 'DEFAULT_ADMIN_NAME',
                defaultEmail: 'admin@realtrack.local',
                defaultName: 'Admin User',
            },
            {
                slug: permission_registry_js_1.ROLE_SLUGS.MANAGER,
                legacyRole: 'manager',
                emailEnv: 'DEFAULT_MANAGER_EMAIL',
                passwordEnv: 'DEFAULT_MANAGER_PASSWORD',
                nameEnv: 'DEFAULT_MANAGER_NAME',
                defaultEmail: 'manager@realtrack.local',
                defaultName: 'Manager User',
            },
            {
                slug: permission_registry_js_1.ROLE_SLUGS.STAFF,
                legacyRole: 'user',
                emailEnv: 'DEFAULT_STAFF_EMAIL',
                passwordEnv: 'DEFAULT_STAFF_PASSWORD',
                nameEnv: 'DEFAULT_STAFF_NAME',
                defaultEmail: 'staff@realtrack.local',
                defaultName: 'Staff User',
            },
            {
                slug: permission_registry_js_1.ROLE_SLUGS.VIEWER,
                legacyRole: 'viewer',
                emailEnv: 'DEFAULT_VIEWER_EMAIL',
                passwordEnv: 'DEFAULT_VIEWER_PASSWORD',
                nameEnv: 'DEFAULT_VIEWER_NAME',
                defaultEmail: 'viewer@realtrack.local',
                defaultName: 'Viewer User',
            },
        ];
        for (const spec of users) {
            const email = (this.config.get(spec.emailEnv) ?? spec.defaultEmail).toLowerCase();
            const password = this.config.get(spec.passwordEnv);
            if (!password) {
                this.logger.warn(`Skipping seed for ${spec.slug}: set ${spec.passwordEnv} in environment`);
                continue;
            }
            const name = this.config.get(spec.nameEnv) ?? spec.defaultName;
            let user = await this.userRepo.findOne({ where: { email } });
            const storeAccessAll = true;
            if (!user) {
                user = await this.userRepo.save(this.userRepo.create({
                    email,
                    name,
                    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
                    role: spec.legacyRole,
                    active: true,
                    storeAccessAll,
                }));
                this.logger.log(`Created seed user ${email} (${spec.slug})`);
            }
            else {
                user.role = spec.legacyRole;
                user.active = true;
                user.storeAccessAll = storeAccessAll;
                await this.userRepo.save(user);
            }
            await this.rbac.assignPrimaryRole(user.id, spec.slug);
            await this.ensureDefaultWorkspace(user.id, name, email);
        }
    }
    async ensureDefaultWorkspace(userId, name, email) {
        const existing = await this.memberRepo.findOne({ where: { userId } });
        if (existing)
            return;
        const label = name?.trim() || email.split('@')[0] || 'My workspace';
        const org = await this.orgRepo.save(this.orgRepo.create({
            name: label,
            slug: `ws-${crypto.randomBytes(8).toString('hex')}`,
            plan: 'free',
            status: 'active',
        }));
        await this.memberRepo.save(this.memberRepo.create({
            organizationId: org.id,
            userId,
            role: 'owner',
        }));
    }
    shouldSeedDemoUsers() {
        const explicit = this.config.get('SEED_DEMO_USERS');
        if (explicit === 'true')
            return true;
        if (explicit === 'false')
            return false;
        return this.config.get('NODE_ENV', 'development') !== 'production';
    }
};
exports.RbacSeedService = RbacSeedService;
exports.RbacSeedService = RbacSeedService = RbacSeedService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_js_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(organization_entity_js_1.Organization)),
    __param(2, (0, typeorm_1.InjectRepository)(organization_member_entity_js_1.OrganizationMember)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        rbac_service_js_1.RbacService,
        config_1.ConfigService])
], RbacSeedService);
//# sourceMappingURL=rbac-seed.service.js.map