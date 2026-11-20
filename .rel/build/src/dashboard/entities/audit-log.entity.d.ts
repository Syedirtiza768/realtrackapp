export declare class AuditLog {
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    actorId: string | null;
    actorType: string;
    changes: Record<string, {
        old: unknown;
        new: unknown;
    }> | null;
    metadata: Record<string, unknown>;
    ipAddress: string | null;
    createdAt: Date;
}
