import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { PricingRule } from '../settings/entities/pricing-rule.entity.js';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';
export declare class PricingPushService {
    private readonly channelsQueue;
    private readonly pricingRuleRepo;
    private readonly featureFlags;
    private readonly logger;
    constructor(channelsQueue: Queue, pricingRuleRepo: Repository<PricingRule>, featureFlags: FeatureFlagService);
    handlePricingRuleChange(payload: {
        ruleId: string;
        ruleType: string;
        channel?: string;
    }): Promise<void>;
    calculateEffectivePrice(basePrice: number, channel?: string, categoryId?: string, brand?: string, storeId?: string): Promise<{
        effectivePrice: number;
        appliedRules: string[];
    }>;
}
