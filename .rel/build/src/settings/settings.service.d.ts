import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantSetting } from './entities/tenant-setting.entity.js';
import { ShippingProfile } from './entities/shipping-profile.entity.js';
import { PricingRule } from './entities/pricing-rule.entity.js';
import type { CreateShippingProfileDto, UpdateShippingProfileDto, CreatePricingRuleDto, UpdatePricingRuleDto } from './dto/settings.dto.js';
export declare class SettingsService {
    private readonly settingRepo;
    private readonly shippingRepo;
    private readonly pricingRepo;
    private readonly eventEmitter;
    private readonly logger;
    private cache;
    constructor(settingRepo: Repository<TenantSetting>, shippingRepo: Repository<ShippingProfile>, pricingRepo: Repository<PricingRule>, eventEmitter: EventEmitter2);
    getAll(): Promise<Record<string, Record<string, unknown>>>;
    getByCategory(category: string): Promise<Record<string, unknown>>;
    getSetting(category: string, key: string): Promise<unknown>;
    updateSetting(category: string, key: string, value: unknown, updatedBy?: string): Promise<TenantSetting>;
    getShippingProfiles(): Promise<ShippingProfile[]>;
    createShippingProfile(dto: CreateShippingProfileDto): Promise<ShippingProfile>;
    updateShippingProfile(id: string, dto: UpdateShippingProfileDto): Promise<ShippingProfile>;
    deleteShippingProfile(id: string): Promise<void>;
    getPricingRules(): Promise<PricingRule[]>;
    createPricingRule(dto: CreatePricingRuleDto): Promise<PricingRule>;
    updatePricingRule(id: string, dto: UpdatePricingRuleDto): Promise<PricingRule>;
    deletePricingRule(id: string): Promise<void>;
}
