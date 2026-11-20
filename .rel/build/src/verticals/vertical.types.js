"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PRODUCT_VERTICAL = exports.PRODUCT_VERTICALS = void 0;
exports.isProductVertical = isProductVertical;
exports.normalizeProductVertical = normalizeProductVertical;
exports.PRODUCT_VERTICALS = [
    'automotive',
    'business_industrial',
    'fashion',
];
exports.DEFAULT_PRODUCT_VERTICAL = 'automotive';
function isProductVertical(value) {
    return (typeof value === 'string' &&
        exports.PRODUCT_VERTICALS.includes(value));
}
function normalizeProductVertical(value, fallback = exports.DEFAULT_PRODUCT_VERTICAL) {
    if (isProductVertical(value))
        return value;
    if (typeof value !== 'string')
        return fallback;
    const normalized = value.trim().toLowerCase().replace(/[ -]+/g, '_');
    if (normalized === 'businessandindustrial' ||
        normalized === 'business_industrial') {
        return 'business_industrial';
    }
    if (normalized === 'auto' || normalized === 'motors')
        return 'automotive';
    if (normalized === 'fashion')
        return 'fashion';
    return fallback;
}
//# sourceMappingURL=vertical.types.js.map