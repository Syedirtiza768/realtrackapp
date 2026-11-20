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
exports.EbayTradingQuotaService = void 0;
const common_1 = require("@nestjs/common");
const ebay_auth_service_js_1 = require("../../../channels/ebay/ebay-auth.service.js");
let EbayTradingQuotaService = class EbayTradingQuotaService {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    async getPublishCapacity() {
        try {
            const token = await this.auth.getApplicationToken();
            const baseUrl = this.auth.getApiConfig().baseUrl;
            const response = await fetch(`${baseUrl}/developer/analytics/v1_beta/rate_limit/?api_name=tradingapi`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                },
                signal: AbortSignal.timeout(8_000),
            });
            if (!response.ok)
                throw new Error(`Analytics HTTP ${response.status}`);
            const body = (await response.json());
            const rate = body.rateLimits
                ?.flatMap((api) => api.resources ?? [])
                .find((resource) => resource.name === 'AddFixedPriceItem')?.rates?.[0];
            const reset = new Date(rate?.reset ?? '');
            if (!rate ||
                !Number.isFinite(rate.limit) ||
                !Number.isFinite(rate.remaining) ||
                !Number.isFinite(reset.getTime())) {
                throw new Error('AddFixedPriceItem quota is missing from Analytics');
            }
            return {
                remaining: Math.max(0, rate.remaining),
                limit: rate.limit,
                reset,
            };
        }
        catch {
            throw new common_1.ServiceUnavailableException('eBay Trading API allowance is unavailable. Bulk publishing is paused until the allowance can be checked.');
        }
    }
};
exports.EbayTradingQuotaService = EbayTradingQuotaService;
exports.EbayTradingQuotaService = EbayTradingQuotaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ebay_auth_service_js_1.EbayAuthService])
], EbayTradingQuotaService);
//# sourceMappingURL=ebay-trading-quota.service.js.map