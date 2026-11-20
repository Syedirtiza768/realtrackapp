export declare class CreateExportRuleDto {
    name: string;
    description?: string;
    storeId: string;
    filters?: Record<string, unknown>;
    priceMultiplier?: number;
    priceAddition?: number;
    titlePrefix?: string;
    titleSuffix?: string;
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
    scheduleCron?: string;
    autoPublish?: boolean;
}
export declare class UpdateExportRuleDto {
    name?: string;
    description?: string;
    storeId?: string;
    filters?: Record<string, unknown>;
    priceMultiplier?: number;
    priceAddition?: number;
    titlePrefix?: string;
    titleSuffix?: string;
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
    scheduleCron?: string;
    autoPublish?: boolean;
    status?: 'active' | 'paused' | 'disabled';
}
