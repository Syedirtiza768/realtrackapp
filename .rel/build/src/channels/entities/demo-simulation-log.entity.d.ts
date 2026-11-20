export declare class DemoSimulationLog {
    id: string;
    operationType: 'publish' | 'update' | 'end_listing' | 'sync_inventory' | 'order_received' | 'webhook_simulated' | 'auth_simulated' | 'token_refresh';
    channel: string;
    storeId: string | null;
    listingId: string | null;
    instanceId: string | null;
    simulatedExternalId: string | null;
    requestPayload: Record<string, unknown>;
    responsePayload: Record<string, unknown>;
    simulatedLatencyMs: number;
    simulatedSuccess: boolean;
    simulatedError: string | null;
    notes: string | null;
    createdAt: Date;
}
