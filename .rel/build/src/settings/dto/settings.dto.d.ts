export declare class UpdateSettingDto {
    value: unknown;
}
export declare class CreateShippingProfileDto {
    name: string;
    carrier: string;
    service: string;
    handlingTime?: number;
    costType: 'flat' | 'calculated' | 'free';
    flatCost?: string;
    weightBased?: boolean;
    domesticOnly?: boolean;
    isDefault?: boolean;
}
export declare class UpdateShippingProfileDto {
    name?: string;
    carrier?: string;
    service?: string;
    handlingTime?: number;
    costType?: 'flat' | 'calculated' | 'free';
    flatCost?: string;
    weightBased?: boolean;
    domesticOnly?: boolean;
    isDefault?: boolean;
    active?: boolean;
}
export declare class CreatePricingRuleDto {
    name: string;
    ruleType: 'markup' | 'markdown' | 'round' | 'min_margin' | 'competitive';
    channel?: string;
    storeId?: string;
    categoryId?: string;
    brand?: string;
    parameters: Record<string, unknown>;
    priority?: number;
    active?: boolean;
}
export declare class UpdatePricingRuleDto {
    name?: string;
    ruleType?: 'markup' | 'markdown' | 'round' | 'min_margin' | 'competitive';
    channel?: string;
    storeId?: string;
    categoryId?: string;
    brand?: string;
    parameters?: Record<string, unknown>;
    priority?: number;
    active?: boolean;
}
