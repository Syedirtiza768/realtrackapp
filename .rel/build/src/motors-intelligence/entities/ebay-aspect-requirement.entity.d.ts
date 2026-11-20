export declare enum AspectRequirementLevel {
    REQUIRED = "required",
    RECOMMENDED = "recommended",
    OPTIONAL = "optional"
}
export declare class EbayAspectRequirement {
    id: string;
    ebayCategoryId: string;
    aspectName: string;
    requirementLevel: AspectRequirementLevel;
    dataType: string | null;
    allowedValues: string[] | null;
    maxLength: number | null;
    isMultiValue: boolean;
    description: string | null;
    defaultValue: string | null;
    validationRules: Record<string, any> | null;
    createdAt: Date;
    lastSyncedAt: Date | null;
}
