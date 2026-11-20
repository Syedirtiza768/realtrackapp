export declare enum ExtractionSource {
    OCR = "ocr",
    VISION_AI = "vision_ai",
    REGEX = "regex",
    SUPPLIER_DATA = "supplier_data",
    CATALOG_LOOKUP = "catalog_lookup",
    MANUAL = "manual"
}
export declare class ExtractedAttribute {
    id: string;
    motorsProductId: string;
    extractionSource: ExtractionSource;
    imageAssetId: string | null;
    rawOcrText: string | null;
    rawModelOutput: Record<string, any> | null;
    extractedBrand: string | null;
    extractedMpn: string | null;
    extractedOemNumber: string | null;
    extractedProductType: string | null;
    extractedProductFamily: string | null;
    extractedPlacement: string | null;
    extractedMaterial: string | null;
    extractedFinish: string | null;
    extractedCondition: string | null;
    extractedQuantity: string | null;
    extractedSideOrientation: string | null;
    extractedFrontRear: string | null;
    extractedDimensions: Record<string, any> | null;
    extractedFeatures: string[] | null;
    extractedFitmentRaw: any[] | null;
    visibleTextLines: string[] | null;
    packagingIdentifiers: string[] | null;
    confidenceScores: Record<string, number> | null;
    normalizedOutput: Record<string, any> | null;
    approvedOutput: Record<string, any> | null;
    aiProvider: string | null;
    aiModel: string | null;
    tokensUsed: number | null;
    latencyMs: number | null;
    costUsd: number | null;
    createdAt: Date;
}
