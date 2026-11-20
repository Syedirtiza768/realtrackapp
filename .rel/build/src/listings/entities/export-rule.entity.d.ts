import { Store } from '../../channels/entities/store.entity.js';
export declare class ExportRule {
    id: string;
    organizationId: string | null;
    name: string;
    description: string | null;
    storeId: string;
    store: Store;
    filters: Record<string, unknown>;
    priceMultiplier: number;
    priceAddition: number;
    titlePrefix: string | null;
    titleSuffix: string | null;
    fulfillmentPolicyId: string | null;
    paymentPolicyId: string | null;
    returnPolicyId: string | null;
    scheduleCron: string | null;
    autoPublish: boolean;
    status: 'active' | 'paused' | 'disabled';
    lastRunAt: Date | null;
    lastRunCount: number;
    totalExported: number;
    createdAt: Date;
    updatedAt: Date;
}
