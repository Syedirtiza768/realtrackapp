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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var EbayFulfillmentApiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayFulfillmentApiService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const ebay_auth_service_js_1 = require("./ebay-auth.service.js");
let EbayFulfillmentApiService = EbayFulfillmentApiService_1 = class EbayFulfillmentApiService {
    auth;
    logger = new common_1.Logger(EbayFulfillmentApiService_1.name);
    http;
    constructor(auth) {
        this.auth = auth;
        const config = this.auth.getApiConfig();
        this.http = axios_1.default.create({
            baseURL: `${config.baseUrl}/sell/fulfillment/v1`,
            timeout: 30_000,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        });
    }
    async authHeaders(storeId) {
        const token = await this.auth.getAccessToken(storeId);
        return { headers: { Authorization: `Bearer ${token}` } };
    }
    async getOrders(storeId, options = {}) {
        const cfg = await this.authHeaders(storeId);
        const params = {};
        if (options.filter)
            params.filter = options.filter;
        if (options.limit)
            params.limit = options.limit;
        if (options.offset)
            params.offset = options.offset;
        if (options.orderIds?.length) {
            params.orderIds = options.orderIds.join(',');
        }
        const { data } = await this.http.get('/order', {
            ...cfg,
            params,
        });
        return data;
    }
    async getRecentOrders(storeId, sinceDate, limit = 50) {
        const iso = sinceDate.toISOString();
        const filter = `creationdate:[${iso}..] `;
        const page = await this.getOrders(storeId, { filter, limit });
        return page.orders ?? [];
    }
    async getOrder(storeId, orderId) {
        const cfg = await this.authHeaders(storeId);
        const { data } = await this.http.get(`/order/${orderId}`, cfg);
        return data;
    }
    async createShippingFulfillment(storeId, orderId, fulfillment) {
        const cfg = await this.authHeaders(storeId);
        const { data } = await this.http.post(`/order/${orderId}/shipping_fulfillment`, fulfillment, cfg);
        this.logger.log(`Created shipping fulfillment for order ${orderId} on store ${storeId}`);
        return data;
    }
    async getShippingFulfillments(storeId, orderId) {
        const cfg = await this.authHeaders(storeId);
        const { data } = await this.http.get(`/order/${orderId}/shipping_fulfillment`, cfg);
        return data.fulfillments ?? [];
    }
    async getAwaitingShipmentCount(storeId) {
        const filter = `orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}`;
        const page = await this.getOrders(storeId, { filter, limit: 1, offset: 0 });
        return page.total ?? 0;
    }
};
exports.EbayFulfillmentApiService = EbayFulfillmentApiService;
exports.EbayFulfillmentApiService = EbayFulfillmentApiService = EbayFulfillmentApiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ebay_auth_service_js_1.EbayAuthService])
], EbayFulfillmentApiService);
//# sourceMappingURL=ebay-fulfillment-api.service.js.map