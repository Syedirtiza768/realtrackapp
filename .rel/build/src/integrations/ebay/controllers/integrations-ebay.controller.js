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
var IntegrationsEbayController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationsEbayController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const config_1 = require("@nestjs/config");
const public_decorator_js_1 = require("../../../auth/decorators/public.decorator.js");
const current_user_decorator_js_1 = require("../../../auth/decorators/current-user.decorator.js");
const require_permissions_decorator_js_1 = require("../../../rbac/decorators/require-permissions.decorator.js");
const user_entity_js_1 = require("../../../auth/entities/user.entity.js");
const ebay_integrations_dto_js_1 = require("../dto/ebay-integrations.dto.js");
const ebay_integrations_oauth_service_js_1 = require("../services/ebay-integrations-oauth.service.js");
const ebay_integration_permissions_service_js_1 = require("../services/ebay-integration-permissions.service.js");
const ebay_integration_account_service_js_1 = require("../services/ebay-integration-account.service.js");
const ebay_policy_sync_service_js_1 = require("../services/ebay-policy-sync.service.js");
const ebay_sync_service_js_1 = require("../services/ebay-sync.service.js");
const ebay_api_audit_service_js_1 = require("../services/ebay-api-audit.service.js");
const user_organization_service_js_1 = require("../../../auth/user-organization.service.js");
let IntegrationsEbayController = IntegrationsEbayController_1 = class IntegrationsEbayController {
    oauth;
    permissions;
    accounts;
    policySync;
    ebaySync;
    apiAuditService;
    config;
    userOrgs;
    logger = new common_1.Logger(IntegrationsEbayController_1.name);
    constructor(oauth, permissions, accounts, policySync, ebaySync, apiAuditService, config, userOrgs) {
        this.oauth = oauth;
        this.permissions = permissions;
        this.accounts = accounts;
        this.policySync = policySync;
        this.ebaySync = ebaySync;
        this.apiAuditService = apiAuditService;
        this.config = config;
        this.userOrgs = userOrgs;
    }
    async workspace(user) {
        return this.userOrgs.getWorkspaceContext(user.id);
    }
    async oauthStart(dto, user) {
        const { organizationId, member } = await this.permissions.resolveOrganization(user.id, dto.organizationId);
        this.permissions.assertCanConnect(member.role);
        return this.oauth.startOAuth({
            userId: user.id,
            organizationId,
            internalStoreId: dto.internalStoreId ?? null,
            marketplaceId: dto.marketplaceId,
            environment: dto.environment,
            accountDisplayName: dto.accountDisplayName?.trim() || 'eBay store',
        });
    }
    async oauthCallback(code, state, res) {
        const configuredBase = this.config.get('FRONTEND_BASE_URL');
        const base = (configuredBase?.trim() ||
            (process.env.NODE_ENV === 'production'
                ? 'https://app.omnicoreholding.com'
                : 'http://localhost:3911')).replace(/\/+$/, '');
        try {
            if (!code || !state) {
                res.redirect(`${base}/settings/integrations/ebay?error=missing_code_or_state`);
                return;
            }
            const result = await this.oauth.handleCallback({ code, state });
            const destination = result.redirectUrl ?? '/settings/integrations/ebay';
            res.redirect(base +
                destination +
                '?success=1&accountId=' +
                result.connectedEbayAccountId);
        }
        catch (err) {
            this.logger.error({ err, code: !!code, state: !!state }, 'eBay OAuth callback failed');
            if (err instanceof ebay_integrations_oauth_service_js_1.EbayOAuthCallbackFailure) {
                const query = new URLSearchParams({ error: err.reason });
                if (err.userMessage)
                    query.set('message', err.userMessage);
                res.redirect(`${base}${err.redirectPath}?${query.toString()}`);
                return;
            }
            res.redirect(`${base}/settings/integrations/ebay?error=oauth_failed`);
        }
    }
    async listAccounts(organizationId, user) {
        const { organizationId: orgId } = await this.permissions.resolveOrganization(user.id, organizationId);
        return this.accounts.listForOrganization(orgId);
    }
    async getAccount(id, organizationId, user) {
        const { organizationId: orgId } = await this.permissions.assertAccountAccess(user.id, id, organizationId);
        return this.accounts.getOne(id, orgId);
    }
    async patchAccount(id, organizationId, user, body) {
        const { organizationId: orgId } = await this.permissions.assertAccountAccess(user.id, id, organizationId);
        return this.accounts.patch(id, orgId, body);
    }
    async getPolicies(id, organizationId, user) {
        const { organizationId: orgId } = await this.permissions.assertAccountAccess(user.id, id, organizationId);
        const account = await this.accounts.getOne(id, orgId);
        const policies = await this.accounts.getPolicies(id, orgId);
        return { account, ...policies };
    }
    async patchDefaultPolicies(id, organizationId, body, user, xf, ua) {
        const { organizationId: orgId, member } = await this.permissions.assertAccountAccess(user.id, id, organizationId);
        this.permissions.assertCanManageStorePolicies(member.role);
        return this.accounts.patchDefaultPolicies(id, orgId, body, {
            userId: user.id,
            ip: xf ?? null,
            userAgent: ua ?? null,
        });
    }
    async disconnect(id, organizationId, user, xf, ua) {
        const { organizationId: orgId, member } = await this.permissions.assertAccountAccess(user.id, id, organizationId);
        this.permissions.assertCanConnect(member.role);
        return this.accounts.disconnect(id, orgId, user.id, {
            ip: xf ?? null,
            userAgent: ua ?? null,
        });
    }
    async reconnect(id, organizationId, body, user) {
        const { organizationId: orgId, member } = await this.permissions.assertAccountAccess(user.id, id, organizationId);
        this.permissions.assertCanConnect(member.role);
        const account = await this.accounts.getOne(id, orgId);
        if (account.connectionSource === 'sellerpundit')
            throw new common_1.BadRequestException('SellerPundit connections are re-authorized through SellerPundit');
        return this.oauth.startOAuth({
            userId: user.id,
            organizationId: orgId,
            internalStoreId: body?.internalStoreId ?? account.internalStoreId ?? null,
            marketplaceId: body?.marketplaceId ||
                account.marketplaces.find((m) => m.enabled)?.marketplaceId ||
                'EBAY_US',
            environment: body?.environment ?? account.environment,
            accountDisplayName: body?.accountDisplayName?.trim() || account.accountDisplayName,
            reconnectAccountId: id,
        });
    }
    async syncListings(id, organizationId, marketplaceId, user) {
        const { organizationId: orgId, member } = await this.permissions.assertAccountAccess(user.id, id, organizationId);
        this.permissions.assertCanManageStorePolicies(member.role);
        return this.ebaySync.enqueueListingSync(id, orgId, user.id, marketplaceId);
    }
    async syncOrders(id, organizationId, user) {
        const { organizationId: orgId, member } = await this.permissions.assertAccountAccess(user.id, id, organizationId);
        this.permissions.assertCanManageStorePolicies(member.role);
        return this.ebaySync.enqueueOrderSync(id, orgId, user.id);
    }
    async syncLogs(id, organizationId, user) {
        const { organizationId: orgId } = await this.permissions.assertAccountAccess(user.id, id, organizationId);
        await this.accounts.getOne(id, orgId);
        return this.ebaySync.listSyncLogs(id, orgId);
    }
    async listApiAudit(id, organizationId, user) {
        const { organizationId: orgId } = await this.permissions.assertAccountAccess(user.id, id, organizationId);
        return this.apiAuditService.listForAccount(id, orgId);
    }
    async syncPolicies(id, organizationId, user) {
        const { organizationId: orgId, member } = await this.permissions.assertAccountAccess(user.id, id, organizationId);
        this.permissions.assertCanManageStorePolicies(member.role);
        return this.policySync.syncPolicies(id, orgId, user.id);
    }
};
exports.IntegrationsEbayController = IntegrationsEbayController;
__decorate([
    (0, common_1.Get)('workspace'),
    (0, swagger_1.ApiOperation)({
        summary: 'Resolve Omni Core workspace for the signed-in user (not an eBay seller ID)',
    }),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], IntegrationsEbayController.prototype, "workspace", null);
__decorate([
    (0, common_1.Post)('oauth/start'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.connect'),
    (0, swagger_1.ApiOperation)({ summary: 'Start eBay OAuth (returns consent URL)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ebay_integrations_dto_js_1.EbayOAuthStartDto, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], IntegrationsEbayController.prototype, "oauthStart", null);
__decorate([
    (0, public_decorator_js_1.Public)(),
    (0, common_1.Get)('oauth/callback'),
    (0, swagger_1.ApiOperation)({ summary: 'OAuth callback (browser redirect, no JWT)' }),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Query)('state')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], IntegrationsEbayController.prototype, "oauthCallback", null);
__decorate([
    (0, common_1.Get)('accounts'),
    (0, swagger_1.ApiOperation)({
        summary: 'List connected eBay seller accounts for your workspace',
    }),
    __param(0, (0, common_1.Query)('organizationId')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], IntegrationsEbayController.prototype, "listAccounts", null);
__decorate([
    (0, common_1.Get)('accounts/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get one connected eBay account' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], IntegrationsEbayController.prototype, "getAccount", null);
__decorate([
    (0, common_1.Patch)('accounts/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Update connected eBay account metadata' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User, Object]),
    __metadata("design:returntype", Promise)
], IntegrationsEbayController.prototype, "patchAccount", null);
__decorate([
    (0, common_1.Get)('accounts/:id/policies'),
    (0, swagger_1.ApiOperation)({ summary: 'List cached business policies for an account' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], IntegrationsEbayController.prototype, "getPolicies", null);
__decorate([
    (0, common_1.Patch)('accounts/:id/default-policies'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.manage'),
    (0, swagger_1.ApiOperation)({
        summary: 'Set default payment/return/fulfillment/location for a marketplace',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(4, (0, common_1.Headers)('x-forwarded-for')),
    __param(5, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, ebay_integrations_dto_js_1.EbayDefaultPoliciesPatchDto,
        user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], IntegrationsEbayController.prototype, "patchDefaultPolicies", null);
__decorate([
    (0, common_1.Post)('accounts/:id/disconnect'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Disable a connected eBay account' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(3, (0, common_1.Headers)('x-forwarded-for')),
    __param(4, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User, String, String]),
    __metadata("design:returntype", Promise)
], IntegrationsEbayController.prototype, "disconnect", null);
__decorate([
    (0, common_1.Post)('accounts/:id/reconnect'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.connect'),
    (0, swagger_1.ApiOperation)({ summary: 'Start OAuth again for reconnect' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], IntegrationsEbayController.prototype, "reconnect", null);
__decorate([
    (0, common_1.Post)('accounts/:id/sync-listings'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.sync'),
    (0, swagger_1.ApiOperation)({ summary: 'Enqueue background sync of eBay inventory/offers' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, common_1.Query)('marketplaceId')),
    __param(3, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], IntegrationsEbayController.prototype, "syncListings", null);
__decorate([
    (0, common_1.Post)('accounts/:id/sync-orders'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.sync'),
    (0, swagger_1.ApiOperation)({
        summary: 'Enqueue background import of eBay orders (Fulfillment API)',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], IntegrationsEbayController.prototype, "syncOrders", null);
__decorate([
    (0, common_1.Get)('accounts/:id/sync-logs'),
    (0, swagger_1.ApiOperation)({ summary: 'Recent listing/policy sync logs for an account' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], IntegrationsEbayController.prototype, "syncLogs", null);
__decorate([
    (0, common_1.Get)('accounts/:id/api-audit'),
    (0, swagger_1.ApiOperation)({ summary: 'Recent eBay API audit log entries (no secrets)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], IntegrationsEbayController.prototype, "listApiAudit", null);
__decorate([
    (0, common_1.Post)('accounts/:id/sync-policies'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.sync'),
    (0, swagger_1.ApiOperation)({ summary: 'Sync business policies from eBay Account API' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], IntegrationsEbayController.prototype, "syncPolicies", null);
exports.IntegrationsEbayController = IntegrationsEbayController = IntegrationsEbayController_1 = __decorate([
    (0, swagger_1.ApiTags)('integrations-ebay'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('integrations/ebay'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.view'),
    __metadata("design:paramtypes", [ebay_integrations_oauth_service_js_1.EbayIntegrationsOAuthService,
        ebay_integration_permissions_service_js_1.EbayIntegrationPermissionsService,
        ebay_integration_account_service_js_1.EbayIntegrationAccountService,
        ebay_policy_sync_service_js_1.EbayPolicySyncService,
        ebay_sync_service_js_1.EbaySyncService,
        ebay_api_audit_service_js_1.EbayApiAuditService,
        config_1.ConfigService,
        user_organization_service_js_1.UserOrganizationService])
], IntegrationsEbayController);
//# sourceMappingURL=integrations-ebay.controller.js.map