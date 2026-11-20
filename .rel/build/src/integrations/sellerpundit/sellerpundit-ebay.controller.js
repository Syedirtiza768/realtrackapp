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
exports.SellerpunditEbayController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const current_user_decorator_js_1 = require("../../auth/decorators/current-user.decorator.js");
const require_permissions_decorator_js_1 = require("../../rbac/decorators/require-permissions.decorator.js");
const user_entity_js_1 = require("../../auth/entities/user.entity.js");
const connected_ebay_account_entity_js_1 = require("../ebay/entities/connected-ebay-account.entity.js");
const ebay_integration_permissions_service_js_1 = require("../ebay/services/ebay-integration-permissions.service.js");
const sellerpundit_auth_service_js_1 = require("./sellerpundit-auth.service.js");
const sellerpundit_account_sync_service_js_1 = require("./sellerpundit-account-sync.service.js");
const sellerpundit_policy_sync_service_js_1 = require("./sellerpundit-policy-sync.service.js");
let SellerpunditEbayController = class SellerpunditEbayController {
    auth;
    accounts;
    policies;
    permissions;
    accountRepo;
    constructor(auth, accounts, policies, permissions, accountRepo) {
        this.auth = auth;
        this.accounts = accounts;
        this.policies = policies;
        this.permissions = permissions;
        this.accountRepo = accountRepo;
    }
    async getConfig(organizationId, user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        return this.auth.getConfigView(orgId);
    }
    async putConfig(organizationId, body, user) {
        const { organizationId: orgId, member } = await this.permissions.resolveOrganization(user.id, organizationId);
        this.permissions.assertCanConnect(member.role);
        if (body.email && body.password) {
            await this.auth.saveOrgCredentials(orgId, body.email.trim(), body.password);
        }
        if (body.enabled != null) {
            await this.auth.upsertConfig(orgId, { enabled: body.enabled });
        }
        return this.auth.getConfigView(orgId);
    }
    async testConnection(organizationId, user) {
        const { organizationId: orgId, member } = await this.permissions.resolveOrganization(user.id, organizationId);
        this.permissions.assertCanConnect(member.role);
        return this.accounts.testConnection(orgId);
    }
    async syncStores(organizationId, user) {
        const { organizationId: orgId, member } = await this.permissions.resolveOrganization(user.id, organizationId);
        this.permissions.assertCanConnect(member.role);
        return this.accounts.syncStores(orgId, user.id);
    }
    async syncAllPolicies(organizationId, accountId, user) {
        const { organizationId: orgId, member } = await this.permissions.resolveOrganization(user.id, organizationId);
        this.permissions.assertCanManageStorePolicies(member.role);
        if (accountId) {
            const { organizationId: accOrg } = await this.permissions.assertAccountAccess(user.id, accountId, organizationId);
            return this.policies.syncPolicies(accountId, accOrg, user.id);
        }
        const rows = await this.accountRepo.find({
            where: { organizationId: orgId, connectionSource: 'sellerpundit' },
        });
        let total = 0;
        const results = [];
        for (const row of rows) {
            const r = await this.policies.syncPolicies(row.id, orgId, user.id);
            total += r.synced;
            results.push({ accountId: row.id, synced: r.synced, ok: r.ok });
        }
        return { ok: true, synced: total, accounts: results };
    }
    async syncAll(organizationId, user) {
        const { organizationId: orgId, member } = await this.permissions.resolveOrganization(user.id, organizationId);
        this.permissions.assertCanConnect(member.role);
        const stores = await this.accounts.syncStores(orgId, user.id);
        const policies = await this.syncAllPolicies(organizationId, undefined, user);
        return { stores, policies };
    }
};
exports.SellerpunditEbayController = SellerpunditEbayController;
__decorate([
    (0, common_1.Get)('config'),
    (0, swagger_1.ApiOperation)({ summary: 'SellerPundit integration status for workspace' }),
    __param(0, (0, common_1.Query)('organizationId')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], SellerpunditEbayController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Put)('config'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.manage'),
    (0, swagger_1.ApiOperation)({
        summary: 'Save org-level SellerPundit credentials (optional)',
    }),
    __param(0, (0, common_1.Query)('organizationId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], SellerpunditEbayController.prototype, "putConfig", null);
__decorate([
    (0, common_1.Post)('test-connection'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.connect'),
    __param(0, (0, common_1.Query)('organizationId')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], SellerpunditEbayController.prototype, "testConnection", null);
__decorate([
    (0, common_1.Post)('sync/stores'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.connect'),
    (0, swagger_1.ApiOperation)({ summary: 'Import connected eBay stores from SellerPundit' }),
    __param(0, (0, common_1.Query)('organizationId')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], SellerpunditEbayController.prototype, "syncStores", null);
__decorate([
    (0, common_1.Post)('sync/policies'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.sync'),
    (0, swagger_1.ApiOperation)({
        summary: 'Sync SellerPundit policies for all SP accounts in workspace',
    }),
    __param(0, (0, common_1.Query)('organizationId')),
    __param(1, (0, common_1.Query)('accountId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], SellerpunditEbayController.prototype, "syncAllPolicies", null);
__decorate([
    (0, common_1.Post)('sync/all'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.sync'),
    __param(0, (0, common_1.Query)('organizationId')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], SellerpunditEbayController.prototype, "syncAll", null);
exports.SellerpunditEbayController = SellerpunditEbayController = __decorate([
    (0, swagger_1.ApiTags)('integrations-ebay-sellerpundit'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('integrations/ebay/sellerpundit'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.view'),
    __param(4, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __metadata("design:paramtypes", [sellerpundit_auth_service_js_1.SellerpunditAuthService,
        sellerpundit_account_sync_service_js_1.SellerpunditAccountSyncService,
        sellerpundit_policy_sync_service_js_1.SellerpunditPolicySyncService,
        ebay_integration_permissions_service_js_1.EbayIntegrationPermissionsService,
        typeorm_2.Repository])
], SellerpunditEbayController);
//# sourceMappingURL=sellerpundit-ebay.controller.js.map