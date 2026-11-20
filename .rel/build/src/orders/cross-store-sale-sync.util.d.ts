export declare const CROSS_STORE_SALE_SYNC_FLAG = "ebay_cross_store_sale_sync";
export declare const CROSS_STORE_SALE_SYNC_QUEUE = "ebay-cross-store-sale-sync";
export declare const MAX_TARGETS_PER_SKU = 40;
export declare const MIN_SKU_LENGTH = 3;
export type SkuRejection = 'no_sku' | 'sku_too_short';
export declare function normalizeSku(sku: string | null | undefined): string | null;
export declare function rejectSku(sku: string | null): SkuRejection | null;
export type TargetPlan = {
    action: 'end';
    available: number;
    remaining: 0;
} | {
    action: 'set_quantity';
    available: number;
    remaining: number;
} | {
    action: 'none';
    reason: 'already_zero';
    available: number;
};
export declare function planTarget(available: number, soldQty: number): TargetPlan;
export declare function tradingAvailable(quantity: number | null | undefined, quantitySold: number | null | undefined): number;
export declare function isLiveTradingStatus(status: string | null | undefined): boolean;
export declare function isListingNotFoundError(message: string | null | undefined): boolean;
export type SamePartVerdict = 'part_number' | 'similar_title' | 'shared_words' | 'no_title' | 'different_part_number' | 'different_make' | 'different_size' | 'unrelated_title';
export declare function samePartVerdict(soldTitle: string | null | undefined, otherTitle: string | null | undefined): SamePartVerdict;
export declare function isSamePart(verdict: SamePartVerdict): boolean;
