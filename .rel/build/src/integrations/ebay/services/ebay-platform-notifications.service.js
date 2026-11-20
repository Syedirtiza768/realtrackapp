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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var EbayPlatformNotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayPlatformNotificationsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const axios_1 = __importDefault(require("axios"));
const typeorm_2 = require("typeorm");
const connected_ebay_account_entity_js_1 = require("../entities/connected-ebay-account.entity.js");
const store_entity_js_1 = require("../../../channels/entities/store.entity.js");
const ebay_auth_service_js_1 = require("../../../channels/ebay/ebay-auth.service.js");
const ebay_platform_notification_util_js_1 = require("./ebay-platform-notification.util.js");
const COALESCE_WINDOW_MS = 10_000;
const SETTLE_DELAY_MS = 3_000;
const RECHECK_DELAY_MS = 30_000;
let EbayPlatformNotificationsService = EbayPlatformNotificationsService_1 = class EbayPlatformNotificationsService {
    config;
    auth;
    accountRepo;
    storeRepo;
    orderSyncQueue;
    logger = new common_1.Logger(EbayPlatformNotificationsService_1.name);
    http;
    constructor(config, auth, accountRepo, storeRepo, orderSyncQueue) {
        this.config = config;
        this.auth = auth;
        this.accountRepo = accountRepo;
        this.storeRepo = storeRepo;
        this.orderSyncQueue = orderSyncQueue;
        this.http = axios_1.default.create({ timeout: 30_000 });
    }
    notificationKeys() {
        const { clientId, clientSecret } = this.auth.getApiConfig();
        const devId = this.config.get('EBAY_DEV_ID', '').trim();
        if (!devId || !clientId || !clientSecret)
            return null;
        return { devId, appId: clientId, certId: clientSecret };
    }
    async handleNotification(rawXml) {
        const parsed = (0, ebay_platform_notification_util_js_1.parsePlatformNotification)(rawXml);
        if (!parsed) {
            throw new common_1.BadRequestException('Expected an eBay SOAP notification');
        }
        const keys = this.notificationKeys();
        if (!keys) {
            this.logger.error('eBay notification rejected: EBAY_DEV_ID / EBAY_CLIENT_ID / EBAY_CLIENT_SECRET not all set, cannot verify NotificationSignature');
            throw new common_1.ServiceUnavailableException('eBay notification verification is not configured');
        }
        const check = (0, ebay_platform_notification_util_js_1.verifyNotificationSignature)({
            signature: parsed.signature,
            timestamp: parsed.timestamp,
            keys,
        });
        if (!check.ok) {
            this.logger.warn(`eBay notification rejected (${check.reason}): event=${parsed.eventName ?? '?'} timestamp=${parsed.timestamp ?? '?'}`);
            throw new common_1.UnauthorizedException('Invalid eBay notification signature');
        }
        if (!(0, ebay_platform_notification_util_js_1.isOrderNotificationEvent)(parsed.eventName)) {
            return {
                status: 'ignored',
                reason: 'not an order event',
                eventName: parsed.eventName,
            };
        }
        const sellerUserId = parsed.recipientUserId ?? parsed.sellerUserId;
        if (!sellerUserId) {
            this.logger.warn(`eBay ${parsed.eventName} notification has no RecipientUserID — left to the order poll`);
            return {
                status: 'ignored',
                reason: 'no seller in payload',
                eventName: parsed.eventName,
            };
        }
        const accounts = await this.resolveAccountsForSeller(sellerUserId);
        if (!accounts.length) {
            this.logger.warn(`eBay ${parsed.eventName} for seller "${sellerUserId}" matches no active connected account — ignored`);
            return {
                status: 'ignored',
                reason: 'unknown seller',
                eventName: parsed.eventName,
            };
        }
        for (const account of accounts) {
            await this.queueOrderImport(account);
        }
        this.logger.log(`eBay ${parsed.eventName} for seller "${sellerUserId}" (item ${parsed.itemId ?? '?'}) → order import queued for ${accounts.length} account(s)`);
        return {
            status: 'queued',
            eventName: parsed.eventName,
            ebayAccountIds: accounts.map((a) => a.id),
        };
    }
    async resolveAccountsForSeller(sellerUserId) {
        const wanted = sellerUserId.trim().toLowerCase();
        if (!wanted)
            return [];
        const active = await this.accountRepo.find({
            where: { connectionStatus: 'active' },
        });
        const matches = active.filter((a) => a.ebayUsername?.trim().toLowerCase() === wanted ||
            a.ebayUserId?.trim().toLowerCase() === wanted);
        if (!matches.length)
            return [];
        const stores = await this.storeRepo.find({
            where: {
                id: (0, typeorm_2.In)([...new Set(matches.map((a) => a.primaryStoreId))]),
                channel: 'ebay',
                status: (0, typeorm_2.Not)('archived'),
            },
        });
        const usable = new Set(stores.map((s) => s.id));
        return matches.filter((a) => usable.has(a.primaryStoreId));
    }
    async queueOrderImport(account) {
        const now = Date.now();
        const window = Math.floor(now / COALESCE_WINDOW_MS);
        const runAt = (window + 1) * COALESCE_WINDOW_MS + SETTLE_DELAY_MS;
        const payload = {
            ebayAccountId: account.id,
            organizationId: account.organizationId,
            userId: null,
        };
        const options = {
            attempts: 3,
            backoff: { type: 'exponential', delay: 15_000 },
            removeOnComplete: 100,
            removeOnFail: 200,
        };
        await this.orderSyncQueue.add('sync-orders', payload, {
            ...options,
            jobId: `ebay-notify-orders-${account.id}-${window}`,
            delay: runAt - now,
        });
        await this.orderSyncQueue.add('sync-orders', payload, {
            ...options,
            jobId: `ebay-notify-orders-${account.id}-${window}-recheck`,
            delay: runAt - now + RECHECK_DELAY_MS,
        });
    }
    expectedUrl() {
        const url = this.config
            .get('EBAY_PLATFORM_NOTIFICATION_URL', '')
            .trim();
        return url || null;
    }
    async loadAccount(ebayAccountId, organizationId) {
        const account = await this.accountRepo.findOne({
            where: { id: ebayAccountId, organizationId },
        });
        if (!account)
            throw new common_1.NotFoundException('eBay account not found');
        if (account.connectionStatus !== 'active') {
            throw new common_1.BadRequestException(`eBay account is not active (${account.connectionStatus}) — reconnect it first`);
        }
        if (account.connectionSource === 'sellerpundit') {
            throw new common_1.BadRequestException('This account is connected through SellerPundit. Connect it with native eBay OAuth to receive sale notifications.');
        }
        return account;
    }
    async postTrading(account, callName, body) {
        const token = await this.auth.getAccessToken(account.primaryStoreId);
        const baseUrl = await this.auth.getApiBaseUrlForStore(account.primaryStoreId);
        let xml;
        try {
            const { data } = await this.http.post(`${baseUrl}/ws/api.dll`, body, {
                headers: {
                    'Content-Type': 'text/xml',
                    'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
                    'X-EBAY-API-CALL-NAME': callName,
                    'X-EBAY-API-SITEID': '0',
                    'X-EBAY-API-IAF-TOKEN': token,
                },
                responseType: 'text',
                transformResponse: [(r) => r],
            });
            xml = String(data);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new common_1.BadGatewayException(`eBay ${callName} request failed: ${msg}`);
        }
        const failure = (0, ebay_platform_notification_util_js_1.tradingFailure)(xml);
        if (failure) {
            throw new common_1.BadGatewayException(`eBay ${callName} failed: ${failure}`);
        }
        return xml;
    }
    async getPreferences(account, level) {
        try {
            return await this.postTrading(account, 'GetNotificationPreferences', (0, ebay_platform_notification_util_js_1.buildGetNotificationPreferencesRequest)(level));
        }
        catch (err) {
            if ((0, ebay_platform_notification_util_js_1.isNoPreferencesError)(err))
                return '';
            throw err;
        }
    }
    async getStatus(ebayAccountId, organizationId) {
        const account = await this.loadAccount(ebayAccountId, organizationId);
        return this.readStatus(account);
    }
    async readStatus(account) {
        const appXml = await this.getPreferences(account, 'Application');
        const userXml = await this.getPreferences(account, 'User');
        const app = (0, ebay_platform_notification_util_js_1.parseApplicationPreferences)(appXml);
        const userEvents = (0, ebay_platform_notification_util_js_1.parseUserEventPreferences)(userXml);
        const events = Object.fromEntries(ebay_platform_notification_util_js_1.ORDER_NOTIFICATION_EVENTS.map((e) => [e, userEvents[e] === true]));
        const expectedUrl = this.expectedUrl();
        return {
            ebayAccountId: account.id,
            ebayUsername: account.ebayUsername?.trim() || null,
            expectedUrl,
            applicationUrl: app.applicationUrl,
            applicationEnabled: app.applicationEnabled,
            events,
            subscribed: !!account.ebayUsername?.trim() &&
                !!expectedUrl &&
                app.applicationUrl === expectedUrl &&
                app.applicationEnabled &&
                Object.values(events).every(Boolean),
        };
    }
    async subscribe(ebayAccountId, organizationId, options) {
        const expectedUrl = this.expectedUrl();
        if (!expectedUrl || !/^https:\/\/[^\s]+$/i.test(expectedUrl)) {
            throw new common_1.BadRequestException('Set EBAY_PLATFORM_NOTIFICATION_URL to the public https URL of POST /api/integrations/ebay/platform-notifications first');
        }
        if (!this.notificationKeys()) {
            throw new common_1.BadRequestException('Set EBAY_DEV_ID (with EBAY_CLIENT_ID / EBAY_CLIENT_SECRET) first — without it incoming notifications cannot be verified');
        }
        const account = await this.loadAccount(ebayAccountId, organizationId);
        await this.recordSellerLogin(account);
        const current = (0, ebay_platform_notification_util_js_1.parseApplicationPreferences)(await this.getPreferences(account, 'Application'));
        if (current.applicationUrl &&
            current.applicationUrl !== expectedUrl &&
            !options.replaceApplicationUrl) {
            throw new common_1.ConflictException(`This eBay app already delivers notifications to ${current.applicationUrl}. That URL is shared by every seller on the app. Send replaceApplicationUrl: true to move it to ${expectedUrl}.`);
        }
        await this.postTrading(account, 'SetNotificationPreferences', (0, ebay_platform_notification_util_js_1.buildSetNotificationPreferencesRequest)({
            enable: true,
            applicationUrl: expectedUrl,
        }));
        this.logger.log(`eBay sale notifications enabled for account ${account.id} (${account.ebayUsername ?? account.ebayUserId}) → ${expectedUrl}` +
            (current.applicationUrl && current.applicationUrl !== expectedUrl
                ? ` (app URL moved from ${current.applicationUrl})`
                : '') +
            ` by user ${options.actorUserId ?? 'unknown'}`);
        return this.readStatus(account);
    }
    async recordSellerLogin(account) {
        const login = (0, ebay_platform_notification_util_js_1.parseGetUserLogin)(await this.postTrading(account, 'GetUser', (0, ebay_platform_notification_util_js_1.buildGetUserRequest)()));
        const stored = account.ebayUsername?.trim() || null;
        if (!login) {
            if (stored)
                return;
            throw new common_1.BadGatewayException("eBay GetUser did not return the seller's username, so notifications could not be matched to this account");
        }
        if (stored?.toLowerCase() === login.toLowerCase())
            return;
        await this.accountRepo.update(account.id, { ebayUsername: login });
        this.logger.log(`eBay account ${account.id}: ebay_username ${stored ?? '(none)'} → ${login} (from GetUser)`);
        account.ebayUsername = login;
    }
    async unsubscribe(ebayAccountId, organizationId, options = {}) {
        const account = await this.loadAccount(ebayAccountId, organizationId);
        await this.postTrading(account, 'SetNotificationPreferences', (0, ebay_platform_notification_util_js_1.buildSetNotificationPreferencesRequest)({ enable: false }));
        this.logger.log(`eBay sale notifications disabled for account ${account.id} (${account.ebayUsername ?? account.ebayUserId}) by user ${options.actorUserId ?? 'unknown'}`);
        return this.readStatus(account);
    }
};
exports.EbayPlatformNotificationsService = EbayPlatformNotificationsService;
exports.EbayPlatformNotificationsService = EbayPlatformNotificationsService = EbayPlatformNotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(3, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __param(4, (0, bullmq_1.InjectQueue)('ebay-order-sync')),
    __metadata("design:paramtypes", [config_1.ConfigService,
        ebay_auth_service_js_1.EbayAuthService,
        typeorm_2.Repository,
        typeorm_2.Repository, Function])
], EbayPlatformNotificationsService);
//# sourceMappingURL=ebay-platform-notifications.service.js.map