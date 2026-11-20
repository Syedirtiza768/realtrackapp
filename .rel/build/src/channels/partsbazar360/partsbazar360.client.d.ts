import { ConfigService } from '@nestjs/config';
import type { PartsBazarPushItem, PartsBazarPushItemResult, PartsBazarStatusResponse } from './partsbazar360.types.js';
export declare class PartsBazarApiError extends Error {
    readonly status: number | null;
    readonly retryable: boolean;
    constructor(message: string, status: number | null, retryable: boolean);
}
export declare class PartsBazar360Client {
    private readonly config;
    private readonly logger;
    constructor(config: ConfigService);
    get baseUrl(): string;
    private get apiKey();
    isConfigured(): boolean;
    health(storeId?: string): Promise<{
        ok: boolean;
        seller: {
            id: string;
            name: string;
        } | null;
    }>;
    push(storeId: string, items: PartsBazarPushItem[]): Promise<PartsBazarPushItemResult[]>;
    end(storeId: string, sourceListingIds: string[]): Promise<Array<{
        sourceListingId: string;
        status: string;
    }>>;
    status(storeId: string, sourceListingId: string): Promise<PartsBazarStatusResponse>;
    private request;
    private retryDelay;
    private errorDetail;
    private number;
    private sleep;
}
