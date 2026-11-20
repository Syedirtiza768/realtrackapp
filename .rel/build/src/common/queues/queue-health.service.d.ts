import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare const MONITORED_QUEUE_NAMES: readonly ["ingestion", "pipeline", "catalog-import", "openai", "channels", "inventory", "orders", "dashboard", "storage-cleanup", "storage-thumbnails", "fitment", "motors-pipeline", "listing-optimization", "ebay-listing-publish", "ebay-order-sync", "ebay-inventory-sync"];
export type QueueHealthSnapshot = Record<string, {
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
    completed: number;
}>;
export declare class QueueHealthService implements OnModuleDestroy {
    private readonly config;
    private readonly queues;
    constructor(config: ConfigService);
    getSnapshot(): Promise<QueueHealthSnapshot>;
    onModuleDestroy(): Promise<void>;
}
