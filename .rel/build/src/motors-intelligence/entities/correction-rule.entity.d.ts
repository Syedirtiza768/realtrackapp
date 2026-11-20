export declare enum CorrectionType {
    CHAR_SUBSTITUTION = "char_substitution",
    HYPHEN_NORMALIZATION = "hyphen_normalization",
    SUPERSESSION = "supersession",
    BRAND_ALIAS = "brand_alias",
    BRAND_FORMAT = "brand_format",
    PAIR_SINGLE = "pair_single",
    SIDE_ORIENTATION = "side_orientation",
    FRONT_REAR = "front_rear",
    PRODUCT_TYPE_ALIAS = "product_type_alias",
    FITMENT_NORMALIZATION = "fitment_normalization",
    TITLE_PATTERN = "title_pattern"
}
export declare class CorrectionRule {
    id: string;
    correctionType: CorrectionType;
    brand: string | null;
    productType: string | null;
    inputPattern: string;
    correctedValue: string;
    isRegex: boolean;
    description: string | null;
    source: string | null;
    sourceReviewTaskId: string | null;
    applicationCount: number;
    active: boolean;
    priority: number;
    createdAt: Date;
}
