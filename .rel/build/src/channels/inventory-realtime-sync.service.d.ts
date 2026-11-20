import { Queue } from 'bullmq';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';
export declare class InventoryRealtimeSyncService {
    private readonly inventoryQueue;
    private readonly featureFlags;
    private readonly logger;
    constructor(inventoryQueue: Queue, featureFlags: FeatureFlagService);
    handleInventoryChange(payload: {
        channel: string;
        externalId: string;
        sku?: string;
        quantityAvailable?: number;
        source: string;
    }): Promise<void>;
    handleOrderCreated(payload: {
        orderId: string;
        channel: string;
        total: string;
    }): Promise<void>;
    processEbayInventoryWebhook(body: Record<string, unknown>): Promise<void>;
    processShopifyInventoryWebhook(topic: string, body: Record<string, unknown>): Promise<void>;
    processAmazonInventoryWebhook(body: Record<string, unknown>): Promise<void>;
    processWalmartInventoryWebhook(body: Record<string, unknown>): Promise<void>;
    private handleWebhookPayload;
}
