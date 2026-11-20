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
exports.ChannelsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const channels_service_js_1 = require("./channels.service.js");
const stores_service_js_1 = require("./stores.service.js");
const inventory_realtime_sync_service_js_1 = require("./inventory-realtime-sync.service.js");
const channel_dto_js_1 = require("./dto/channel.dto.js");
const public_decorator_js_1 = require("../auth/decorators/public.decorator.js");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
let ChannelsController = class ChannelsController {
    channelsService;
    storesService;
    inventorySync;
    constructor(channelsService, storesService, inventorySync) {
        this.channelsService = channelsService;
        this.storesService = storesService;
        this.inventorySync = inventorySync;
    }
    getConnections(user) {
        return this.channelsService.getConnections(user.id);
    }
    getAuthUrl(channel, state) {
        if (channel === 'ebay') {
            throw new common_1.BadRequestException({
                message: 'Legacy eBay OAuth is retired. Sign in to Omni Core, then POST /api/integrations/ebay/oauth/start (JWT). Seller identity comes from Sign in with eBay.',
                migration: 'integrations-ebay-oauth',
                replacement: {
                    method: 'POST',
                    path: '/api/integrations/ebay/oauth/start',
                },
            });
        }
        const url = this.channelsService.getAuthUrl(channel, state);
        return { url };
    }
    async handleCallback(channel, code, state, res) {
        if (channel === 'ebay') {
            const qs = new URLSearchParams();
            if (code)
                qs.set('code', code);
            if (state)
                qs.set('state', state);
            const suffix = qs.toString() ? `?${qs.toString()}` : '';
            res.redirect(302, `/api/integrations/ebay/oauth/callback${suffix}`);
            return;
        }
        const userId = state.split(':')[1] ?? 'system';
        const result = await this.channelsService.handleOAuthCallback(channel, code, userId);
        res.json(result);
    }
    disconnect(connectionId, user) {
        return this.channelsService.disconnectChannel(connectionId, user.id);
    }
    testConnection(connectionId, user) {
        return this.channelsService.testConnection(connectionId, user.id);
    }
    publish(dto) {
        return this.channelsService.enqueuePublish(dto.connectionId, dto.listingId);
    }
    syncInventory(dto) {
        return this.channelsService.enqueueSync(dto.connectionId);
    }
    getChannelListings(connectionId) {
        return this.channelsService.getChannelListings(connectionId);
    }
    getListingChannels(listingId) {
        return this.channelsService.getListingChannelStatuses(listingId);
    }
    publishMulti(dto) {
        return this.channelsService.publishMulti(dto.listingId, dto.channels, dto.overrides, dto.storeId);
    }
    updateChannelListing(listingId, channel) {
        return this.channelsService.updateChannelListing(listingId, channel);
    }
    endChannelListing(listingId, channel) {
        return this.channelsService.endChannelListing(listingId, channel);
    }
    bulkPublish(dto) {
        return this.channelsService.bulkPublish(dto.listingIds, dto.channels, dto.storeId);
    }
    async seedDemoEbay() {
        return this.channelsService.seedDemoEbayConnection(this.storesService);
    }
    async connectEbayLegacyToken(body, user) {
        if (!body?.token?.trim()) {
            return { ok: false, error: 'token is required' };
        }
        try {
            const result = await this.channelsService.connectEbayLegacyToken(body.token.trim(), this.storesService, user.id);
            return { ok: true, ...result };
        }
        catch (error) {
            const msg = error?.response?.data?.error_description ??
                error?.response?.data?.message ??
                error?.message ??
                'Failed to connect eBay token';
            return { ok: false, error: msg };
        }
    }
    async ebayWebhook(req, signature, body) {
        const sellerUsername = body['notification']?.sellerUsername ??
            body['notification']?.userId;
        const storeId = await this.channelsService.resolveStoreFromWebhook('ebay', sellerUsername);
        await this.channelsService.logWebhook('ebay', body['metadata']?.topic ?? 'unknown', body, body['notification']?.itemId, storeId ?? undefined);
        await this.inventorySync.processEbayInventoryWebhook(body);
        return { status: 'received' };
    }
    async shopifyWebhook(req, signature, topic, shopDomain, body) {
        const storeId = await this.channelsService.resolveStoreFromWebhook('shopify', shopDomain);
        await this.channelsService.logWebhook('shopify', topic ?? 'unknown', body, body['id'] ? String(body['id']) : undefined, storeId ?? undefined);
        await this.inventorySync.processShopifyInventoryWebhook(topic ?? '', body);
        return { status: 'received' };
    }
    async amazonWebhook(body) {
        const sellerId = body['detail']?.SellerId ?? body['detail']?.MerchantId;
        const storeId = await this.channelsService.resolveStoreFromWebhook('amazon', sellerId);
        await this.channelsService.logWebhook('amazon', body['detail-type'] ?? 'unknown', body, body['detail']?.SellerSKU, storeId ?? undefined);
        await this.inventorySync.processAmazonInventoryWebhook(body);
        return { status: 'received' };
    }
    async walmartWebhook(signature, body) {
        const partnerId = body['partnerId'] ?? body['sellerId'];
        const storeId = await this.channelsService.resolveStoreFromWebhook('walmart', partnerId ? String(partnerId) : undefined);
        await this.channelsService.logWebhook('walmart', body['eventType'] ?? 'unknown', body, body['sku'] ? String(body['sku']) : undefined, storeId ?? undefined);
        await this.inventorySync.processWalmartInventoryWebhook(body);
        return { status: 'received' };
    }
};
exports.ChannelsController = ChannelsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'List connected channels for the authenticated user',
    }),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], ChannelsController.prototype, "getConnections", null);
__decorate([
    (0, public_decorator_js_1.Public)(),
    (0, common_1.Get)(':channel/auth-url'),
    (0, swagger_1.ApiOperation)({ summary: 'Get OAuth authorization URL for a channel' }),
    __param(0, (0, common_1.Param)('channel')),
    __param(1, (0, common_1.Query)('state')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ChannelsController.prototype, "getAuthUrl", null);
__decorate([
    (0, public_decorator_js_1.Public)(),
    (0, common_1.Get)(':channel/callback'),
    (0, swagger_1.ApiOperation)({ summary: 'Handle OAuth callback' }),
    __param(0, (0, common_1.Param)('channel')),
    __param(1, (0, common_1.Query)('code')),
    __param(2, (0, common_1.Query)('state')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], ChannelsController.prototype, "handleCallback", null);
__decorate([
    (0, common_1.Delete)(':connectionId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('channels.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Disconnect a channel' }),
    __param(0, (0, common_1.Param)('connectionId', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], ChannelsController.prototype, "disconnect", null);
__decorate([
    (0, common_1.Post)(':connectionId/test'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('channels.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Test a channel connection' }),
    __param(0, (0, common_1.Param)('connectionId', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], ChannelsController.prototype, "testConnection", null);
__decorate([
    (0, common_1.Post)('publish'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('channels.publish'),
    (0, swagger_1.ApiOperation)({
        summary: 'Publish a listing to a marketplace (async via queue)',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [channel_dto_js_1.PublishListingDto]),
    __metadata("design:returntype", void 0)
], ChannelsController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)('sync'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('channels.sync'),
    (0, swagger_1.ApiOperation)({
        summary: 'Sync inventory to a marketplace (async via queue)',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [channel_dto_js_1.SyncInventoryDto]),
    __metadata("design:returntype", void 0)
], ChannelsController.prototype, "syncInventory", null);
__decorate([
    (0, common_1.Get)(':connectionId/listings'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all channel listings for a connection' }),
    __param(0, (0, common_1.Param)('connectionId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ChannelsController.prototype, "getChannelListings", null);
__decorate([
    (0, common_1.Get)('listings/:listingId/channels'),
    (0, swagger_1.ApiOperation)({ summary: 'Get channel statuses for a specific listing/SKU' }),
    __param(0, (0, common_1.Param)('listingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ChannelsController.prototype, "getListingChannels", null);
__decorate([
    (0, common_1.Post)('publish-multi'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('channels.publish'),
    (0, swagger_1.ApiOperation)({ summary: 'Publish a listing to multiple channels at once' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [channel_dto_js_1.PublishMultiDto]),
    __metadata("design:returntype", void 0)
], ChannelsController.prototype, "publishMulti", null);
__decorate([
    (0, common_1.Post)('listings/:listingId/channel/:channel/update'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('channels.publish'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a listing on a specific channel' }),
    __param(0, (0, common_1.Param)('listingId')),
    __param(1, (0, common_1.Param)('channel')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ChannelsController.prototype, "updateChannelListing", null);
__decorate([
    (0, common_1.Post)('listings/:listingId/channel/:channel/end'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('channels.publish'),
    (0, swagger_1.ApiOperation)({ summary: 'End/delist a listing on a specific channel' }),
    __param(0, (0, common_1.Param)('listingId')),
    __param(1, (0, common_1.Param)('channel')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ChannelsController.prototype, "endChannelListing", null);
__decorate([
    (0, common_1.Post)('bulk-publish'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('channels.publish'),
    (0, swagger_1.ApiOperation)({ summary: 'Publish multiple listings to multiple channels' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [channel_dto_js_1.BulkPublishDto]),
    __metadata("design:returntype", void 0)
], ChannelsController.prototype, "bulkPublish", null);
__decorate([
    (0, common_1.Post)('demo/seed-ebay'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('channels.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a demo eBay sandbox connection + store' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ChannelsController.prototype, "seedDemoEbay", null);
__decorate([
    (0, common_1.Post)('ebay/connect-legacy-token'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: "Connect eBay using a pre-generated sandbox Auth'n'Auth legacy token",
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], ChannelsController.prototype, "connectEbayLegacyToken", null);
__decorate([
    (0, public_decorator_js_1.Public)(),
    (0, common_1.Post)('webhooks/ebay'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'eBay webhook endpoint' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('x-ebay-signature')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ChannelsController.prototype, "ebayWebhook", null);
__decorate([
    (0, public_decorator_js_1.Public)(),
    (0, common_1.Post)('webhooks/shopify'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Shopify webhook endpoint' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('x-shopify-hmac-sha256')),
    __param(2, (0, common_1.Headers)('x-shopify-topic')),
    __param(3, (0, common_1.Headers)('x-shopify-shop-domain')),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], ChannelsController.prototype, "shopifyWebhook", null);
__decorate([
    (0, public_decorator_js_1.Public)(),
    (0, common_1.Post)('webhooks/amazon'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Amazon EventBridge webhook endpoint' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChannelsController.prototype, "amazonWebhook", null);
__decorate([
    (0, public_decorator_js_1.Public)(),
    (0, common_1.Post)('webhooks/walmart'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Walmart webhook endpoint' }),
    __param(0, (0, common_1.Headers)('wm-partner-signature')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChannelsController.prototype, "walmartWebhook", null);
exports.ChannelsController = ChannelsController = __decorate([
    (0, swagger_1.ApiTags)('channels'),
    (0, common_1.Controller)('channels'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('channels.view'),
    __metadata("design:paramtypes", [channels_service_js_1.ChannelsService,
        stores_service_js_1.StoresService,
        inventory_realtime_sync_service_js_1.InventoryRealtimeSyncService])
], ChannelsController);
//# sourceMappingURL=channels.controller.js.map