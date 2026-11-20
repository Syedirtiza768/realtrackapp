import { SettingsService } from './settings.service.js';
import { UpdateSettingDto, CreateShippingProfileDto, UpdateShippingProfileDto, CreatePricingRuleDto, UpdatePricingRuleDto } from './dto/settings.dto.js';
export declare class SettingsController {
    private readonly settingsService;
    constructor(settingsService: SettingsService);
    getAll(): Promise<Record<string, Record<string, unknown>>>;
    getByCategory(category: string): Promise<Record<string, unknown>>;
    update(category: string, key: string, dto: UpdateSettingDto): Promise<import("./entities/tenant-setting.entity.js").TenantSetting>;
    getShippingProfiles(): Promise<import("./entities/shipping-profile.entity.js").ShippingProfile[]>;
    createShippingProfile(dto: CreateShippingProfileDto): Promise<import("./entities/shipping-profile.entity.js").ShippingProfile>;
    updateShippingProfile(id: string, dto: UpdateShippingProfileDto): Promise<import("./entities/shipping-profile.entity.js").ShippingProfile>;
    deleteShippingProfile(id: string): Promise<void>;
    getPricingRules(): Promise<import("./entities/pricing-rule.entity.js").PricingRule[]>;
    createPricingRule(dto: CreatePricingRuleDto): Promise<import("./entities/pricing-rule.entity.js").PricingRule>;
    updatePricingRule(id: string, dto: UpdatePricingRuleDto): Promise<import("./entities/pricing-rule.entity.js").PricingRule>;
    deletePricingRule(id: string): Promise<void>;
}
