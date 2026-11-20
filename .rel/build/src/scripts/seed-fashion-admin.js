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
exports.provisionFashionAdminUser = provisionFashionAdminUser;
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const bcrypt = __importStar(require("bcrypt"));
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const organization_entity_js_1 = require("../auth/entities/organization.entity.js");
const organization_member_entity_js_1 = require("../auth/entities/organization-member.entity.js");
const rbac_service_js_1 = require("../rbac/rbac.service.js");
const permission_registry_js_1 = require("../rbac/permission-registry.js");
const user_role_assignment_entity_js_1 = require("../rbac/entities/user-role-assignment.entity.js");
const SALT_ROUNDS = 12;
async function provisionFashionAdminUser(users, assignments, rbac, options) {
    const user = await users.findOne({ where: { email: options.email } });
    if (user) {
        const roles = await assignments.find({
            where: { userId: user.id },
            relations: ['role'],
        });
        if (!user.active ||
            user.role !== 'user' ||
            !roles.some((assignment) => assignment.role?.slug === permission_registry_js_1.ROLE_SLUGS.FASHION_ADMIN) ||
            roles.some((assignment) => !assignment.role?.slug.startsWith('fashion_'))) {
            throw new Error('Existing account must be an active, exclusively Fashion administrator; seed made no account changes');
        }
        if (options.requirePasswordChange && !user.passwordChangeRequired) {
            await users.update({ id: user.id, active: true }, { passwordChangeRequired: true });
            user.passwordChangeRequired = true;
        }
        return { user, createdUser: false };
    }
    const password = options.password;
    if (!password ||
        Array.from(password).length < 12 ||
        Buffer.byteLength(password, 'utf8') > 72) {
        throw new Error('New admin requires FASHION_SEED_ADMIN_PASSWORD: at least 12 characters, at most 72 UTF-8 bytes');
    }
    const saved = await users.save(users.create({
        email: options.email,
        passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
        name: options.name,
        role: 'user',
        active: true,
        storeAccessAll: true,
        passwordChangeRequired: true,
    }));
    await rbac.assignPrimaryRole(saved.id, permission_registry_js_1.ROLE_SLUGS.FASHION_ADMIN);
    return { user: saved, createdUser: true };
}
async function main() {
    const email = process.env.FASHION_SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.FASHION_SEED_ADMIN_PASSWORD;
    const name = process.env.FASHION_SEED_ADMIN_NAME?.trim() || 'Fashion Admin';
    const organizationName = process.env.FASHION_SEED_ADMIN_ORGANIZATION_NAME?.trim() ||
        'Fashion workspace';
    if (!email)
        throw new Error('FASHION_SEED_ADMIN_EMAIL is required');
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--require-password-change'))
        throw new Error('Unknown seed option');
    const requirePasswordChange = args.includes('--require-password-change');
    const { AppModule } = await import('../app.module.js');
    const app = await core_1.NestFactory.createApplicationContext(AppModule, {
        logger: false,
    });
    try {
        const users = app.get((0, typeorm_1.getRepositoryToken)(user_entity_js_1.User));
        const organizations = app.get((0, typeorm_1.getRepositoryToken)(organization_entity_js_1.Organization));
        const members = app.get((0, typeorm_1.getRepositoryToken)(organization_member_entity_js_1.OrganizationMember));
        const rbac = app.get(rbac_service_js_1.RbacService);
        await rbac.syncFromRegistry();
        const assignments = app.get((0, typeorm_1.getRepositoryToken)(user_role_assignment_entity_js_1.UserRoleAssignment));
        const { user, createdUser } = await provisionFashionAdminUser(users, assignments, rbac, {
            email,
            password,
            name,
            requirePasswordChange,
        });
        let membership = await members.findOne({
            where: { userId: user.id },
            order: { createdAt: 'ASC' },
        });
        if (!membership) {
            const slug = `fashion-${email
                .split('@')[0]
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
                .slice(0, 60) || 'workspace'}`;
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
        console.log(`${createdUser ? 'Created' : 'Verified'} Fashion admin ${email} in organization ${membership.organizationId}`);
    }
    finally {
        await app.close();
    }
}
if (require.main === module) {
    main().catch(() => {
        console.error('Fashion admin seed failed. Verify configuration, migration and account role requirements.');
        process.exitCode = 1;
    });
}
//# sourceMappingURL=seed-fashion-admin.js.map