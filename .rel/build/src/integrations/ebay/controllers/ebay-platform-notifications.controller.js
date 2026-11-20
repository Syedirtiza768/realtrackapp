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
exports.EbayPlatformNotificationsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const public_decorator_js_1 = require("../../../auth/decorators/public.decorator.js");
const current_user_decorator_js_1 = require("../../../auth/decorators/current-user.decorator.js");
const require_permissions_decorator_js_1 = require("../../../rbac/decorators/require-permissions.decorator.js");
const user_entity_js_1 = require("../../../auth/entities/user.entity.js");
const ebay_integration_permissions_service_js_1 = require("../services/ebay-integration-permissions.service.js");
const ebay_platform_notifications_service_js_1 = require("../services/ebay-platform-notifications.service.js");
const ebay_order_notifications_dto_js_1 = require("../dto/ebay-order-notifications.dto.js");
let EbayPlatformNotificationsController = class EbayPlatformNotificationsController {
    notifications;
    permissions;
    constructor(notifications, permissions) {
        this.notifications = notifications;
        this.permissions = permissions;
    }
    async receive(req) {
        const body = req.body;
        const xml = req.rawBody?.toString('utf8') ?? (typeof body === 'string' ? body : '');
        return this.notifications.handleNotification(xml);
    }
    async status(id, organizationId, user) {
        const { organizationId: orgId, member } = await this.permissions.assertAccountAccess(user.id, id, organizationId);
        this.permissions.assertCanConnect(member.role);
        return this.notifications.getStatus(id, orgId);
    }
    async subscribe(id, organizationId, dto, user) {
        const { organizationId: orgId, member } = await this.permissions.assertAccountAccess(user.id, id, organizationId);
        this.permissions.assertCanConnect(member.role);
        return this.notifications.subscribe(id, orgId, {
            replaceApplicationUrl: dto.replaceApplicationUrl === true,
            actorUserId: user.id,
        });
    }
    async unsubscribe(id, organizationId, user) {
        const { organizationId: orgId, member } = await this.permissions.assertAccountAccess(user.id, id, organizationId);
        this.permissions.assertCanConnect(member.role);
        return this.notifications.unsubscribe(id, orgId, { actorUserId: user.id });
    }
};
exports.EbayPlatformNotificationsController = EbayPlatformNotificationsController;
__decorate([
    (0, public_decorator_js_1.Public)(),
    (0, throttler_1.SkipThrottle)({ short: true, medium: true, long: true }),
    (0, common_1.Post)('platform-notifications'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'eBay Platform Notification receiver (SOAP XML; FixedPriceTransaction / AuctionCheckoutComplete / ItemSold queue an order import)',
    }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EbayPlatformNotificationsController.prototype, "receive", null);
__decorate([
    (0, common_1.Get)('accounts/:id/order-notifications'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.notifications.manage'),
    (0, swagger_1.ApiOperation)({
        summary: 'Read eBay sale-notification settings for a connected account',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], EbayPlatformNotificationsController.prototype, "status", null);
__decorate([
    (0, common_1.Post)('accounts/:id/order-notifications'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.notifications.manage'),
    (0, swagger_1.ApiOperation)({
        summary: 'Subscribe a connected eBay account to sale notifications (changes settings on eBay)',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, ebay_order_notifications_dto_js_1.EbayOrderNotificationsSubscribeDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], EbayPlatformNotificationsController.prototype, "subscribe", null);
__decorate([
    (0, common_1.Delete)('accounts/:id/order-notifications'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.notifications.manage'),
    (0, swagger_1.ApiOperation)({
        summary: 'Turn off sale notifications for a connected eBay account (changes settings on eBay)',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], EbayPlatformNotificationsController.prototype, "unsubscribe", null);
exports.EbayPlatformNotificationsController = EbayPlatformNotificationsController = __decorate([
    (0, swagger_1.ApiTags)('integrations-ebay'),
    (0, common_1.Controller)('integrations/ebay'),
    __metadata("design:paramtypes", [ebay_platform_notifications_service_js_1.EbayPlatformNotificationsService,
        ebay_integration_permissions_service_js_1.EbayIntegrationPermissionsService])
], EbayPlatformNotificationsController);
//# sourceMappingURL=ebay-platform-notifications.controller.js.map