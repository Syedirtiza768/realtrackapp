"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toContentLanguage = toContentLanguage;
exports.toEbayInventoryApiMarketplaceId = toEbayInventoryApiMarketplaceId;
exports.resolveMarketplaceId = resolveMarketplaceId;
exports.marketplaceRequestHeaders = marketplaceRequestHeaders;
function toContentLanguage(locale) {
    return locale.replace(/_/g, '-');
}
const INVENTORY_OFFER_MARKETPLACE = {
    EBAY_MOTORS_US: 'EBAY_MOTORS',
};
function toEbayInventoryApiMarketplaceId(marketplaceId) {
    const trimmed = marketplaceId.trim();
    return INVENTORY_OFFER_MARKETPLACE[trimmed] ?? trimmed;
}
function resolveMarketplaceId(store) {
    const fromColumn = store.ebayMarketplaceId?.trim();
    if (fromColumn)
        return fromColumn;
    const config = store.config ?? {};
    const fromConfig = typeof config.marketplace === 'string' ? config.marketplace.trim() : '';
    if (fromConfig)
        return fromConfig;
    return 'EBAY_MOTORS_US';
}
function marketplaceRequestHeaders(marketplaceId, config) {
    const locale = config?.locale ?? 'en_US';
    return {
        'Content-Language': toContentLanguage(locale),
        'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
    };
}
//# sourceMappingURL=ebay-marketplace-headers.util.js.map