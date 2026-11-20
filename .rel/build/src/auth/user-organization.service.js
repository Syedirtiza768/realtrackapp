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
exports.UserOrganizationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto = __importStar(require("crypto"));
const organization_entity_js_1 = require("./entities/organization.entity.js");
const organization_member_entity_js_1 = require("./entities/organization-member.entity.js");
const user_entity_js_1 = require("./entities/user.entity.js");
let UserOrganizationService = class UserOrganizationService {
    orgRepo;
    memberRepo;
    userRepo;
    constructor(orgRepo, memberRepo, userRepo) {
        this.orgRepo = orgRepo;
        this.memberRepo = memberRepo;
        this.userRepo = userRepo;
    }
    async listForUser(userId) {
        const rows = await this.memberRepo.find({
            where: { userId },
            relations: ['organization'],
            order: { createdAt: 'ASC' },
        });
        return rows.map((m) => ({
            organizationId: m.organizationId,
            name: m.organization?.name ?? 'Workspace',
            slug: m.organization?.slug ?? '',
            role: m.role,
        }));
    }
    async ensureDefaultForUser(userId) {
        const existing = await this.listForUser(userId);
        if (existing.length > 0)
            return existing[0];
        const user = await this.userRepo.findOne({ where: { id: userId } });
        const label = user?.name?.trim() ||
            user?.email?.split('@')[0]?.trim() ||
            'My workspace';
        const slug = `ws-${crypto.randomBytes(8).toString('hex')}`;
        const org = await this.orgRepo.save(this.orgRepo.create({
            name: label,
            slug,
            plan: 'free',
            status: 'active',
        }));
        await this.memberRepo.save(this.memberRepo.create({
            organizationId: org.id,
            userId,
            role: 'owner',
        }));
        return {
            organizationId: org.id,
            name: org.name,
            slug: org.slug,
            role: 'owner',
        };
    }
    async resolveOrganizationId(userId, organizationId) {
        if (organizationId) {
            const member = await this.memberRepo.findOne({
                where: { userId, organizationId },
            });
            if (!member) {
                throw new common_1.ForbiddenException('Not a member of this workspace');
            }
            return { organizationId, member };
        }
        const orgs = await this.listForUser(userId);
        if (orgs.length === 0) {
            const created = await this.ensureDefaultForUser(userId);
            const member = await this.memberRepo.findOneOrFail({
                where: { userId, organizationId: created.organizationId },
            });
            return { organizationId: created.organizationId, member };
        }
        const member = await this.memberRepo.findOneOrFail({
            where: { userId, organizationId: orgs[0].organizationId },
        });
        return { organizationId: orgs[0].organizationId, member };
    }
    async getWorkspaceContext(userId) {
        let organizations = await this.listForUser(userId);
        if (organizations.length === 0) {
            const created = await this.ensureDefaultForUser(userId);
            organizations = [created];
        }
        const active = organizations[0];
        return {
            organizationId: active.organizationId,
            organizationName: active.name,
            organizations,
        };
    }
};
exports.UserOrganizationService = UserOrganizationService;
exports.UserOrganizationService = UserOrganizationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(organization_entity_js_1.Organization)),
    __param(1, (0, typeorm_1.InjectRepository)(organization_member_entity_js_1.OrganizationMember)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_js_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], UserOrganizationService);
//# sourceMappingURL=user-organization.service.js.map