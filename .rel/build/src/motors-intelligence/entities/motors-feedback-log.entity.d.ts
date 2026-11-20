export declare enum FeedbackType {
    REVIEWER_CORRECTION = "reviewer_correction",
    TITLE_EDIT = "title_edit",
    FITMENT_EDIT = "fitment_edit",
    SPECIFICS_EDIT = "specifics_edit",
    EBAY_API_ERROR = "ebay_api_error",
    POLICY_REJECTION = "policy_rejection",
    RETURN_INAD = "return_inad",
    CTR_DATA = "ctr_data",
    SELL_THROUGH = "sell_through",
    BRAND_CORRECTION = "brand_correction",
    MPN_CORRECTION = "mpn_correction",
    CATEGORY_CORRECTION = "category_correction"
}
export declare class MotorsFeedbackLog {
    id: string;
    motorsProductId: string | null;
    reviewTaskId: string | null;
    feedbackType: FeedbackType;
    field: string | null;
    originalValue: string | null;
    correctedValue: string | null;
    context: Record<string, any> | null;
    appliedToRules: boolean;
    generatedCorrectionRuleId: string | null;
    createdBy: string | null;
    createdAt: Date;
}
