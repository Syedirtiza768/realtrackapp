import { Repository } from 'typeorm';
import { ComplianceAuditLog } from '../../catalog-import/entities/compliance-audit-log.entity.js';
export declare class ListingGuardAuditService {
    private readonly auditRepo;
    private readonly logger;
    constructor(auditRepo: Repository<ComplianceAuditLog>);
    logGuardFixes(fixes: string[], context: {
        productId?: string | null;
        importId?: string | null;
        sku?: string | null;
        before?: Record<string, unknown>;
        after?: Record<string, unknown>;
    }): Promise<void>;
}
