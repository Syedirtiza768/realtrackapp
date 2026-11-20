export declare class ChannelWebhookLog {
    id: string;
    channel: string;
    eventType: string;
    externalId: string | null;
    payload: Record<string, unknown>;
    processingStatus: string;
    processingError: string | null;
    processedAt: Date | null;
    createdAt: Date;
}
