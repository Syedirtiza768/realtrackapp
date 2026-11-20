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
var PricingPushService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingPushService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const pricing_rule_entity_js_1 = require("../settings/entities/pricing-rule.entity.js");
const feature_flag_service_js_1 = require("../common/feature-flags/feature-flag.service.js");
let PricingPushService = PricingPushService_1 = class PricingPushService {
    channelsQueue;
    pricingRuleRepo;
    featureFlags;
    logger = new common_1.Logger(PricingPushService_1.name);
    constructor(channelsQueue, pricingRuleRepo, featureFlags) {
        this.channelsQueue = channelsQueue;
        this.pricingRuleRepo = pricingRuleRepo;
        this.featureFlags = featureFlags;
    }
    async handlePricingRuleChange(payload) {
        const enabled = await this.featureFlags.isEnabled('pricing_auto_push');
        if (!enabled) {
            this.logger.debug('pricing_auto_push flag is disabled — skipping price push');
            return;
        }
        this.logger.log(`Pricing rule changed (${payload.ruleId}), enqueuing price sync`);
        await this.channelsQueue.add('sync-inventory', {
            trigger: 'pricing_rule_change',
            ruleId: payload.ruleId,
            channel: payload.channel ?? null,
        }, {
            jobId: `price-push-${payload.ruleId}-${Date.now()}`,
            delay: 5000,
            attempts: 3,
            backoff: { type: 'exponential', delay: 10_000 },
        });
    }
    async calculateEffectivePrice(basePrice, channel, categoryId, brand, storeId) {
        const rules = await this.pricingRuleRepo.find({
            where: { active: true },
            order: { priority: 'DESC' },
        });
        let price = basePrice;
        const appliedRules = [];
        for (const rule of rules) {
            if (rule.channel && rule.channel !== channel)
                continue;
            if (rule.storeId && rule.storeId !== storeId)
                continue;
            if (rule.categoryId && rule.categoryId !== categoryId)
                continue;
            if (rule.brand && rule.brand !== brand)
                continue;
            const params = rule.parameters;
            switch (rule.ruleType) {
                case 'markup': {
                    const pct = params.percentage ?? 0;
                    price = price * (1 + pct / 100);
                    appliedRules.push(`${rule.name}: +${pct}%`);
                    break;
                }
                case 'markdown': {
                    const pct = params.percentage ?? 0;
                    price = price * (1 - pct / 100);
                    appliedRules.push(`${rule.name}: -${pct}%`);
                    break;
                }
                case 'round': {
                    const to = params.roundTo ?? 99;
                    price = Math.floor(price) + to / 100;
                    appliedRules.push(`${rule.name}: round to .${to}`);
                    break;
                }
                case 'min_margin': {
                    const minPct = params.minMarginPercent ?? 10;
                    const cost = params.cost ?? 0;
                    const minPrice = cost * (1 + minPct / 100);
                    if (price < minPrice) {
                        price = minPrice;
                        appliedRules.push(`${rule.name}: min margin floor $${minPrice.toFixed(2)}`);
                    }
                    break;
                }
                case 'competitive': {
                    this.logger.debug(`Competitive pricing rule ${rule.name} — requires external data (skipped)`);
                    break;
                }
            }
        }
        return { effectivePrice: Math.round(price * 100) / 100, appliedRules };
    }
};
exports.PricingPushService = PricingPushService;
__decorate([
    (0, event_emitter_1.OnEvent)('pricing_rule.changed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PricingPushService.prototype, "handlePricingRuleChange", null);
exports.PricingPushService = PricingPushService = PricingPushService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)('channels')),
    __param(1, (0, typeorm_1.InjectRepository)(pricing_rule_entity_js_1.PricingRule)),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        typeorm_2.Repository,
        feature_flag_service_js_1.FeatureFlagService])
], PricingPushService);
//# sourceMappingURL=pricing-push.service.js.map