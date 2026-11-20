"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EBAY_MASTER_SOURCE_URLS_KEY = exports.EBAY_MASTER_URLS_KEY = void 0;
exports.fashionEbayMasterImages = fashionEbayMasterImages;
exports.ebayMasterAttributes = ebayMasterAttributes;
exports.EBAY_MASTER_URLS_KEY = '_ebayMasterUrls';
exports.EBAY_MASTER_SOURCE_URLS_KEY = '_ebayMasterSourceUrls';
function stringArray(value) {
    if (!Array.isArray(value))
        return null;
    return value.every((item) => typeof item === 'string') ? value : null;
}
function fashionEbayMasterImages(product) {
    if (!product || product.vertical !== 'fashion')
        return null;
    const attrs = product.verticalAttributes ?? {};
    const masters = stringArray(attrs[exports.EBAY_MASTER_URLS_KEY]);
    const sources = stringArray(attrs[exports.EBAY_MASTER_SOURCE_URLS_KEY]);
    if (!masters?.length || !sources)
        return null;
    const current = (product.imageUrls ?? []).map((u) => u.trim());
    if (current.length !== sources.length || current.some((u, i) => u !== sources[i]))
        return null;
    return masters;
}
function ebayMasterAttributes(masterUrls, sourceUrls) {
    return {
        [exports.EBAY_MASTER_URLS_KEY]: [...masterUrls],
        [exports.EBAY_MASTER_SOURCE_URLS_KEY]: sourceUrls.map((u) => u.trim()),
    };
}
//# sourceMappingURL=fashion-ebay-images.util.js.map