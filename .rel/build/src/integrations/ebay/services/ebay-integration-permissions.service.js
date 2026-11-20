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
exports.EbayIntegrationPermissionsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const organization_member_entity_js_1 = require("../../../auth/entities/organization-member.entity.js");
const user_organization_service_js_1 = require("../../../auth/user-organization.service.js");
const connected_ebay_account_entity_js_1 = require("../entities/connected-ebay-account.entity.js");
let EbayIntegrationPermissionsService = class EbayIntegrationPermissionsService {
    members;
    accounts;
    userOrgs;
    constructor(members, accounts, userOrgs) {
        this.members = members;
        this.accounts = accounts;
        this.userOrgs = userOrgs;
    }
    async resolveOrganization(userId, organizationId) {
        return this.userOrgs.resolveOrganizationId(userId, organizationId);
    }
    async assertOrgMember(userId, organizationId) {
        const m = await this.members.findOne({
            where: { userId, organizationId },
        });
        if (!m) {
            throw new common_1.ForbiddenException('Not a member of this organization');
        }
        return m;
    }
    canConnectEbay(role) {
        return role === 'owner' || role === 'admin' || role === 'editor';
    }
    canPublishListing(_role) {
        return true;
    }
    assertCanConnect(role) {
        if (!this.canConnectEbay(role)) {
            throw new common_1.ForbiddenException('Insufficient permissions to connect eBay');
        }
    }
    assertCanPublish(role) {
        if (!this.canPublishListing(role)) {
            throw new common_1.ForbiddenException('Insufficient permissions to publish');
        }
    }
    canManageStorePolicies(role) {
        return this.canConnectEbay(role);
    }
    assertCanManageStorePolicies(role) {
        if (!this.canManageStorePolicies(role)) {
            throw new common_1.ForbiddenException('Insufficient permissions to manage eBay store policies');
        }
    }
    async assertAccountAccess(userId, accountId, organizationId) {
        const account = await this.accounts.findOne({ where: { id: accountId } });
        if (!account) {
            throw new common_1.NotFoundException('eBay account not found');
        }
        const orgHint = organizationId ?? account.organizationId;
        const { organizationId: resolvedOrgId, member } = await this.resolveOrganization(userId, orgHint);
        if (resolvedOrgId !== account.organizationId) {
            throw new common_1.ForbiddenException('Account does not belong to this workspace');
        }
        return { organizationId: resolvedOrgId, member, account };
    }
};
exports.EbayIntegrationPermissionsService = EbayIntegrationPermissionsService;
exports.EbayIntegrationPermissionsService = EbayIntegrationPermissionsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(organization_member_entity_js_1.OrganizationMember)),
    __param(1, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        user_organization_service_js_1.UserOrganizationService])
], EbayIntegrationPermissionsService);
//# sourceMappingURL=ebay-integration-permissions.service.js.map