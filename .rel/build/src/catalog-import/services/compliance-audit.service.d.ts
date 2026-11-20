import { Repository } from 'typeorm';
import { ComplianceAuditLog, type AuditAction } from '../entities/compliance-audit-log.entity.js';
export declare class ComplianceAuditService {
    private readonly auditRepo;
    private readonly logger;
    constructor(auditRepo: Repository<ComplianceAuditLog>);
    log(entry: {
        productId?: string | null;
        importId?: string | null;
        action: AuditAction;
        field: string;
        originalValue?: string | null;
        newValue?: string | null;
        reason?: string | null;
        severity?: string;
        complianceScore?: number | null;
        autoFixed?: boolean;
    }): Promise<void>;
    logBatch(entries: Array<{
        productId?: string | null;
        importId?: string | null;
        action: AuditAction;
        field: string;
        originalValue?: string | null;
        newValue?: string | null;
        reason?: string | null;
        severity?: string;
        complianceScore?: number | null;
        autoFixed?: boolean;
    }>): Promise<void>;
    getByProduct(productId: string, limit?: number): Promise<ComplianceAuditLog[]>;
    getByImport(importId: string, limit?: number): Promise<ComplianceAuditLog[]>;
    getImportAuditSummary(importId: string): Promise<{
        totalActions: number;
        byAction: Record<string, number>;
        bySeverity: Record<string, number>;
        autoFixedCount: number;
    }>;
}
