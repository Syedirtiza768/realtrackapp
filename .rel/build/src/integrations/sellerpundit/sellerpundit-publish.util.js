"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSellerpunditGatewayTimeoutError = isSellerpunditGatewayTimeoutError;
exports.isSellerpunditBulkCreatePlatformError = isSellerpunditBulkCreatePlatformError;
exports.isSellerpunditRecoverableEbayPublishError = isSellerpunditRecoverableEbayPublishError;
exports.tagSellerpunditPlatformError = tagSellerpunditPlatformError;
exports.parseSellerpunditPublishFallbackMode = parseSellerpunditPublishFallbackMode;
exports.shouldAttemptSellerpunditBulkCreate = shouldAttemptSellerpunditBulkCreate;
exports.shouldFallbackFromSellerpunditBulkCreate = shouldFallbackFromSellerpunditBulkCreate;
function sellerpunditErrorText(error, errors) {
    return [error, ...(errors ?? [])].filter(Boolean).join(' ');
}
function isSellerpunditGatewayTimeoutError(error, errors) {
    const text = sellerpunditErrorText(error, errors).toLowerCase();
    return (text.includes('504') ||
        text.includes('gateway time-out') ||
        text.includes('gateway timeout') ||
        text.includes('gateway timed out'));
}
function isSellerpunditBulkCreatePlatformError(error, errors) {
    const text = sellerpunditErrorText(error, errors).toLowerCase();
    if (!text.trim())
        return false;
    return (isSellerpunditGatewayTimeoutError(error, errors) ||
        text.includes('tokens.marketplaceid does not exist') ||
        text.includes('column tokens.marketplaceid') ||
        text.includes('marketplaceid does not exist') ||
        text.includes('failed to process file') ||
        text.includes('bulk-create-using-api') ||
        text.includes('bulk create'));
}
function isSellerpunditRecoverableEbayPublishError(error, errors) {
    const text = sellerpunditErrorText(error, errors);
    if (!text.trim())
        return false;
    if (/21919474|inventory-based listing management is not currently supported/i.test(text) ||
        /21919233|maximum compatibilities/i.test(text)) {
        return true;
    }
    if (/non-compliant domestic return policy/i.test(text) ||
        /parts\.?&.?accessories return policy/i.test(text) ||
        /return window to 30-days/i.test(text) ||
        /ShippingCostPaidByOption/i.test(text) ||
        /not P&A-compliant/i.test(text)) {
        return false;
    }
    return (/invalid.*(?:fulfillment|shipping|payment|return) policy/i.test(text) ||
        /status code 400/i.test(text));
}
function tagSellerpunditPlatformError(result) {
    if (result.success)
        return {};
    if (result.platformError ||
        isSellerpunditBulkCreatePlatformError(result.error, result.errors)) {
        return { platformError: true };
    }
    return {};
}
function parseSellerpunditPublishFallbackMode(raw) {
    const mode = (raw ?? 'auto').trim().toLowerCase();
    if (mode === 'sellerpundit' || mode === 'direct_ebay')
        return mode;
    return 'auto';
}
function shouldAttemptSellerpunditBulkCreate(fallbackMode, forceDirectEbay) {
    if (forceDirectEbay || fallbackMode === 'direct_ebay')
        return false;
    return true;
}
function shouldFallbackFromSellerpunditBulkCreate(fallbackMode, result) {
    if (result.success)
        return false;
    if (isSellerpunditRecoverableEbayPublishError(result.error, result.errors)) {
        return true;
    }
    if (fallbackMode === 'sellerpundit')
        return false;
    return (result.platformError === true ||
        isSellerpunditBulkCreatePlatformError(result.error, result.errors));
}
//# sourceMappingURL=sellerpundit-publish.util.js.map