export declare enum ListingGenerationStatus {
    PENDING = "pending",
    GENERATING = "generating",
    GENERATED = "generated",
    APPROVED = "approved",
    REJECTED = "rejected",
    FAILED = "failed"
}
export declare class ListingGeneration {
    id: string;
    motorsProductId: string;
    version: number;
    status: ListingGenerationStatus;
    inputContract: Record<string, any>;
    generatedTitle: string | null;
    generatedItemSpecifics: Record<string, string> | null;
    generatedBulletFeatures: string[] | null;
    generatedHtmlDescription: string | null;
    keywordRationale: string | null;
    searchTags: string[] | null;
    templateId: string | null;
    templateName: string | null;
    aiProvider: string | null;
    aiModel: string | null;
    aiRawResponse: Record<string, any> | null;
    tokensUsed: number | null;
    latencyMs: number | null;
    costUsd: number | null;
    titleQualityScore: number | null;
    descriptionQualityScore: number | null;
    overallQualityScore: number | null;
    createdAt: Date;
}
