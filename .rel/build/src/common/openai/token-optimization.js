"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LOW_VALUE_MAX_PRICE = void 0;
exports.getLowValueMaxPrice = getLowValueMaxPrice;
exports.isLowValueSku = isLowValueSku;
exports.getEnrichmentProfile = getEnrichmentProfile;
exports.compactJson = compactJson;
exports.DEFAULT_LOW_VALUE_MAX_PRICE = 50;
function getLowValueMaxPrice(configured) {
    const n = Number(configured ?? exports.DEFAULT_LOW_VALUE_MAX_PRICE);
    return Number.isNaN(n) ? exports.DEFAULT_LOW_VALUE_MAX_PRICE : n;
}
function isLowValueSku(price, lowValueMaxPrice = exports.DEFAULT_LOW_VALUE_MAX_PRICE) {
    if (price == null || price === '')
        return false;
    const n = typeof price === 'number' ? price : Number(price);
    if (Number.isNaN(n))
        return false;
    return n < lowValueMaxPrice;
}
function getEnrichmentProfile(price, lowValueMaxPrice = exports.DEFAULT_LOW_VALUE_MAX_PRICE) {
    return isLowValueSku(price, lowValueMaxPrice) ? 'compact' : 'full';
}
function compactJson(value) {
    return JSON.stringify(value);
}
//# sourceMappingURL=token-optimization.js.map