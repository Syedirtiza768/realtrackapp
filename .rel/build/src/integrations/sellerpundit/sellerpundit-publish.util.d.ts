export type SellerpunditPublishFallbackMode = 'auto' | 'sellerpundit' | 'direct_ebay';
export declare function isSellerpunditGatewayTimeoutError(error?: string, errors?: string[]): boolean;
export declare function isSellerpunditBulkCreatePlatformError(error?: string, errors?: string[]): boolean;
export declare function isSellerpunditRecoverableEbayPublishError(error?: string, errors?: string[]): boolean;
export declare function tagSellerpunditPlatformError(result: {
    success: boolean;
    error?: string;
    errors?: string[];
    platformError?: boolean;
}): {
    platformError?: boolean;
};
export declare function parseSellerpunditPublishFallbackMode(raw: string | undefined): SellerpunditPublishFallbackMode;
export declare function shouldAttemptSellerpunditBulkCreate(fallbackMode: SellerpunditPublishFallbackMode, forceDirectEbay?: boolean): boolean;
export declare function shouldFallbackFromSellerpunditBulkCreate(fallbackMode: SellerpunditPublishFallbackMode, result: {
    success: boolean;
    error?: string;
    errors?: string[];
    platformError?: boolean;
}): boolean;
