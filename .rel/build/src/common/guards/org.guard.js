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
var OrgGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrgGuard = exports.ORG_ROLES_KEY = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const organization_member_entity_js_1 = require("../../auth/entities/organization-member.entity.js");
const feature_flag_entity_js_1 = require("../feature-flags/feature-flag.entity.js");
exports.ORG_ROLES_KEY = 'org_roles';
let OrgGuard = OrgGuard_1 = class OrgGuard {
    reflector;
    memberRepo;
    flagRepo;
    logger = new common_1.Logger(OrgGuard_1.name);
    constructor(reflector, memberRepo, flagRepo) {
        this.reflector = reflector;
        this.memberRepo = memberRepo;
        this.flagRepo = flagRepo;
    }
    async canActivate(context) {
        const flag = await this.flagRepo.findOne({
            where: { key: 'multi_tenant' },
        });
        if (!flag?.enabled) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user?.id) {
            return true;
        }
        const orgId = request.headers['x-organization-id'];
        if (!orgId) {
            throw new common_1.ForbiddenException('x-organization-id header is required when multi-tenant mode is enabled');
        }
        const membership = await this.memberRepo.findOne({
            where: { organizationId: orgId, userId: user.id },
        });
        if (!membership) {
            throw new common_1.ForbiddenException('You are not a member of this organization');
        }
        const requiredRoles = this.reflector.get(exports.ORG_ROLES_KEY, context.getHandler());
        if (requiredRoles?.length) {
            if (!requiredRoles.includes(membership.role)) {
                throw new common_1.ForbiddenException(`Requires one of [${requiredRoles.join(', ')}] but you have '${membership.role}'`);
            }
        }
        request.organizationId = orgId;
        request.orgRole = membership.role;
        return true;
    }
};
exports.OrgGuard = OrgGuard;
exports.OrgGuard = OrgGuard = OrgGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(organization_member_entity_js_1.OrganizationMember)),
    __param(2, (0, typeorm_1.InjectRepository)(feature_flag_entity_js_1.FeatureFlag)),
    __metadata("design:paramtypes", [core_1.Reflector,
        typeorm_2.Repository,
        typeorm_2.Repository])
], OrgGuard);
//# sourceMappingURL=org.guard.js.map