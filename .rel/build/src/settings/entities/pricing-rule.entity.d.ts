export declare class PricingRule {
    id: string;
    name: string;
    ruleType: 'markup' | 'markdown' | 'round' | 'min_margin' | 'competitive';
    channel: string | null;
    storeId: string | null;
    categoryId: string | null;
    brand: string | null;
    parameters: Record<string, unknown>;
    priority: number;
    active: boolean;
    createdAt: Date;
}
