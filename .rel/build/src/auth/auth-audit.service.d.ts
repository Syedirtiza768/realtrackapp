import type { Request } from 'express';
import { Repository } from 'typeorm';
import { AuditLog } from '../dashboard/entities/audit-log.entity.js';
export declare class AuthAuditService {
    private readonly auditRepo;
    constructor(auditRepo: Repository<AuditLog>);
    log(action: string, opts: {
        actorId?: string | null;
        entityType?: string;
        entityId?: string;
        metadata?: Record<string, unknown>;
        req?: Request;
    }): Promise<void>;
}
