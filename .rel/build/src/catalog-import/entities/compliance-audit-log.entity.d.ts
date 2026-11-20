export type AuditAction = 'validation' | 'auto_correction' | 'rejection' | 'title_optimization' | 'description_enhancement' | 'category_mapping' | 'item_specifics_fill' | 'fitment_normalization' | 'image_validation' | 'pricing_check';
export declare class ComplianceAuditLog {
    id: string;
    productId: string | null;
    importId: string | null;
    action: AuditAction;
    field: string;
    originalValue: string | null;
    newValue: string | null;
    reason: string | null;
    severity: string;
    complianceScore: number | null;
    autoFixed: boolean;
    createdAt: Date;
}
