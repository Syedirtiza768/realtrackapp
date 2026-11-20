export declare enum MotorsProductStatus {
    PENDING = "pending",
    EXTRACTING = "extracting",
    IDENTIFYING = "identifying",
    RESOLVING_FITMENT = "resolving_fitment",
    GENERATING_LISTING = "generating_listing",
    VALIDATING = "validating",
    REVIEW_REQUIRED = "review_required",
    APPROVED = "approved",
    PUBLISHING = "publishing",
    PUBLISHED = "published",
    FAILED = "failed",
    REJECTED = "rejected"
}
export declare enum MotorsSourceType {
    IMAGE_UPLOAD = "image_upload",
    MPN_INPUT = "mpn_input",
    OEM_INPUT = "oem_input",
    CSV_IMPORT = "csv_import",
    EXCEL_IMPORT = "excel_import",
    SUPPLIER_FEED = "supplier_feed",
    MARKETPLACE_REFERENCE = "marketplace_reference",
    CATALOG_PRODUCT = "catalog_product"
}
export declare class MotorsProduct {
    id: string;
    organizationId: string | null;
    listingId: string | null;
    catalogProductId: string | null;
    status: MotorsProductStatus;
    sourceType: MotorsSourceType;
    sourcePayload: Record<string, any> | null;
    sourceFileName: string | null;
    sourceFilePath: string | null;
    sourceRowNumber: number | null;
    brand: string | null;
    brandNormalized: string | null;
    mpn: string | null;
    mpnNormalized: string | null;
    oemPartNumber: string | null;
    upc: string | null;
    epid: string | null;
    productType: string | null;
    productFamily: string | null;
    placement: string | null;
    material: string | null;
    finish: string | null;
    condition: string | null;
    features: string[] | null;
    includes: string[] | null;
    dimensions: Record<string, any> | null;
    quantityPerPack: string | null;
    sideOrientation: string | null;
    frontRear: string | null;
    ebayCategoryId: string | null;
    ebayCategoryName: string | null;
    compatibilityRequired: boolean;
    identityConfidence: number | null;
    fitmentConfidence: number | null;
    complianceConfidence: number | null;
    contentQualityScore: number | null;
    generatedTitle: string | null;
    generatedItemSpecifics: Record<string, string> | null;
    generatedBulletFeatures: string[] | null;
    generatedHtmlDescription: string | null;
    generatedKeywordRationale: string | null;
    generatedSearchTags: string[] | null;
    fitmentRows: any[] | null;
    compatibleVehicleSummary: string | null;
    imageUrls: string[] | null;
    imageAssetIds: string[] | null;
    price: number | null;
    quantity: number | null;
    ebayListingId: string | null;
    publishError: string | null;
    publishedAt: Date | null;
    createdBy: string | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}
