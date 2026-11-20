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
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const bcrypt = __importStar(require("bcrypt"));
const app_module_js_1 = require("../app.module.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const organization_entity_js_1 = require("../auth/entities/organization.entity.js");
const organization_member_entity_js_1 = require("../auth/entities/organization-member.entity.js");
const rbac_service_js_1 = require("../rbac/rbac.service.js");
const permission_registry_js_1 = require("../rbac/permission-registry.js");
const SALT_ROUNDS = 12;
async function main() {
    const email = process.env.BUSINESS_INDUSTRIAL_SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.BUSINESS_INDUSTRIAL_SEED_ADMIN_PASSWORD;
    const name = process.env.BUSINESS_INDUSTRIAL_SEED_ADMIN_NAME?.trim() ||
        'Business & Industrial Admin';
    const organizationName = process.env.BUSINESS_INDUSTRIAL_SEED_ADMIN_ORGANIZATION_NAME?.trim() ||
        'Business & Industrial workspace';
    if (!email || !password)
        throw new Error('BUSINESS_INDUSTRIAL_SEED_ADMIN_EMAIL and BUSINESS_INDUSTRIAL_SEED_ADMIN_PASSWORD are required');
    if (password.length < 12)
        throw new Error('BUSINESS_INDUSTRIAL_SEED_ADMIN_PASSWORD must be at least 12 characters');
    const app = await core_1.NestFactory.createApplicationContext(app_module_js_1.AppModule, {
        logger: false,
    });
    try {
        const users = app.get((0, typeorm_1.getRepositoryToken)(user_entity_js_1.User));
        const organizations = app.get((0, typeorm_1.getRepositoryToken)(organization_entity_js_1.Organization));
        const members = app.get((0, typeorm_1.getRepositoryToken)(organization_member_entity_js_1.OrganizationMember));
        const rbac = app.get(rbac_service_js_1.RbacService);
        await rbac.syncFromRegistry();
        let user = await users.findOne({
            where: { email },
            select: [
                'id',
                'email',
                'passwordHash',
                'name',
                'role',
                'active',
                'storeAccessAll',
            ],
        });
        const createdUser = !user;
        if (!user) {
            user = await users.save(users.create({
                email,
                passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
                name,
                role: 'user',
                active: true,
                storeAccessAll: false,
                passwordChangeRequired: true,
            }));
            await rbac.assignPrimaryRole(user.id, permission_registry_js_1.ROLE_SLUGS.BUSINESS_INDUSTRIAL_ADMIN);
        }
        else if (!(await rbac.userHasPermission(user.id, 'business_industrial.access'))) {
            throw new Error('Existing user has no Business & Industrial role; assign one explicitly before rerunning this seed');
        }
        let membership = await members.findOne({
            where: { userId: user.id },
            order: { createdAt: 'ASC' },
        });
        if (!membership) {
            const slug = `business-industrial-${email
                .split('@')[0]
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
                .slice(0, 50) || 'workspace'}`;
            let organization = await organizations.findOne({ where: { slug } });
            if (!organization)
                organization = await organizations.save(organizations.create({
                    name: organizationName,
                    slug,
                    plan: 'free',
                    status: 'active',
                }));
            membership = await members.save(members.create({
                organizationId: organization.id,
                userId: user.id,
                role: 'owner',
            }));
        }
        console.log(`${createdUser ? 'Created' : 'Verified'} Business & Industrial admin ${email} in organization ${membership.organizationId}`);
    }
    finally {
        await app.close();
    }
}
main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
//# sourceMappingURL=seed-business-industrial-admin.js.map