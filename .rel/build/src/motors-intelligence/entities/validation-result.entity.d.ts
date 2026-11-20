export declare enum ValidationSeverity {
    ERROR = "error",
    WARNING = "warning",
    INFO = "info"
}
export declare class ValidationResult {
    id: string;
    motorsProductId: string;
    version: number;
    publishable: boolean;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    infos: ValidationIssue[];
    duplicateDetected: boolean;
    duplicateOfListingId: string | null;
    duplicateMatchType: string | null;
    overallComplianceScore: number | null;
    aspectCoverage: Record<string, any> | null;
    fullPayload: Record<string, any> | null;
    createdAt: Date;
}
export interface ValidationIssue {
    code: string;
    field: string;
    message: string;
    severity: ValidationSeverity;
    suggestion?: string;
}
