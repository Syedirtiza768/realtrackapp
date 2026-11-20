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
exports.AutomotiveAccessScopeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const user_organization_service_js_1 = require("./user-organization.service.js");
let AutomotiveAccessScopeService = class AutomotiveAccessScopeService {
    userOrganizations;
    config;
    constructor(userOrganizations, config) {
        this.userOrganizations = userOrganizations;
        this.config = config;
    }
    async buildFilter(user, alias) {
        if (!user)
            return null;
        let organizations = await this.userOrganizations.listForUser(user.id);
        if (organizations.length === 0) {
            organizations = [
                await this.userOrganizations.ensureDefaultForUser(user.id),
            ];
        }
        const organizationIds = organizations.map((org) => org.organizationId);
        const legacyOrganizationId = this.config.get('LEGACY_AUTOMOTIVE_ORGANIZATION_ID');
        const mayReadLegacy = Boolean(legacyOrganizationId && organizationIds.includes(legacyOrganizationId));
        const organizationSql = mayReadLegacy
            ? `(${alias}.organizationId IN (:...automotiveOrganizationIds) OR ${alias}.organizationId IS NULL)`
            : `${alias}.organizationId IN (:...automotiveOrganizationIds)`;
        return {
            sql: `(${alias}.vertical = :automotiveVertical OR ${alias}.vertical IS NULL) AND ${organizationSql}`,
            params: {
                automotiveVertical: 'automotive',
                automotiveOrganizationIds: organizationIds,
            },
        };
    }
    async resolveWriteOrganizationId(user) {
        const organizations = await this.userOrganizations.listForUser(user.id);
        const legacyOrganizationId = this.config.get('LEGACY_AUTOMOTIVE_ORGANIZATION_ID');
        if (legacyOrganizationId &&
            organizations.some((org) => org.organizationId === legacyOrganizationId)) {
            return legacyOrganizationId;
        }
        return (await this.userOrganizations.resolveOrganizationId(user.id))
            .organizationId;
    }
    resolveSystemWriteOrganizationId(organizationId) {
        if (organizationId)
            return organizationId;
        const legacyOrganizationId = this.config.get('LEGACY_AUTOMOTIVE_ORGANIZATION_ID');
        if (!legacyOrganizationId) {
            throw new common_1.ServiceUnavailableException('Legacy automotive organization is not configured');
        }
        return legacyOrganizationId;
    }
};
exports.AutomotiveAccessScopeService = AutomotiveAccessScopeService;
exports.AutomotiveAccessScopeService = AutomotiveAccessScopeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [user_organization_service_js_1.UserOrganizationService,
        config_1.ConfigService])
], AutomotiveAccessScopeService);
//# sourceMappingURL=automotive-access-scope.service.js.map