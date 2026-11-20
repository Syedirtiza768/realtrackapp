export declare class AuditLogQueryDto {
    entityType?: string;
    entityId?: string;
    action?: string;
    actorId?: string;
    since?: string;
    limit?: number;
    offset?: number;
}
export declare class SalesQueryDto {
    channel?: string;
    storeId?: string;
    since?: string;
    until?: string;
    topN?: number;
}
