export declare enum ReviewTaskStatus {
    OPEN = "open",
    IN_PROGRESS = "in_progress",
    APPROVED = "approved",
    REJECTED = "rejected",
    DEFERRED = "deferred",
    AUTO_RESOLVED = "auto_resolved"
}
export declare enum ReviewTaskPriority {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export declare enum ReviewTaskReason {
    MULTIPLE_IDENTITIES = "multiple_identities",
    OCR_CONFLICT = "ocr_conflict",
    MISSING_FITMENT = "missing_fitment",
    LOW_CONFIDENCE = "low_confidence",
    IMAGE_ONLY = "image_only",
    SUPPLIER_CONFLICT = "supplier_conflict",
    BRAND_AMBIGUITY = "brand_ambiguity",
    QUANTITY_AMBIGUITY = "quantity_ambiguity",
    SIDE_ORIENTATION_CONFLICT = "side_orientation_conflict",
    FRONT_REAR_CONFLICT = "front_rear_conflict",
    COMPLIANCE_FAILURE = "compliance_failure",
    MISSING_REQUIRED_ASPECTS = "missing_required_aspects",
    TITLE_QUALITY = "title_quality",
    FITMENT_UNVERIFIED = "fitment_unverified",
    DUPLICATE_DETECTED = "duplicate_detected"
}
export declare class ReviewTask {
    id: string;
    motorsProductId: string;
    organizationId: string | null;
    status: ReviewTaskStatus;
    priority: ReviewTaskPriority;
    reason: ReviewTaskReason;
    reasonDetail: string | null;
    productSnapshot: Record<string, any> | null;
    candidatesSnapshot: any[] | null;
    extractionSnapshot: Record<string, any> | null;
    fitmentSnapshot: any[] | null;
    validationSnapshot: Record<string, any> | null;
    complianceSnapshot: Record<string, any> | null;
    assignedTo: string | null;
    assignedAt: Date | null;
    resolution: string | null;
    resolutionData: Record<string, any> | null;
    resolvedBy: string | null;
    resolvedAt: Date | null;
    dueAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
