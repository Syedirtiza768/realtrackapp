import { EbayComplianceService } from '../services/ebay-compliance.service.js';
import { ComplianceAuditService } from '../services/compliance-audit.service.js';
export declare class ComplianceController {
    private readonly complianceService;
    private readonly auditService;
    constructor(complianceService: EbayComplianceService, auditService: ComplianceAuditService);
    validateBatch(body: {
        productIds: string[];
        autoFix?: boolean;
    }): Promise<import("../services/ebay-compliance.service.js").BatchComplianceResult | {
        error: string;
    }>;
    validateProduct(productId: string, autoFix?: string): Promise<import("../services/ebay-compliance.service.js").ComplianceResult>;
    validateImport(importId: string, autoFix?: string, limit?: number): Promise<import("../services/ebay-compliance.service.js").BatchComplianceResult>;
    getImportAuditLogs(importId: string, limit?: number): Promise<{
        logs: import("../entities/compliance-audit-log.entity.js").ComplianceAuditLog[];
        summary: {
            totalActions: number;
            byAction: Record<string, number>;
            bySeverity: Record<string, number>;
            autoFixedCount: number;
        };
    }>;
    getProductAuditLogs(productId: string, limit?: number): Promise<import("../entities/compliance-audit-log.entity.js").ComplianceAuditLog[]>;
}
